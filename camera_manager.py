import cv2
import face_recognition
import numpy as np
import os
import threading
import time
import pickle
from datetime import datetime
from config import MONGODB_URI, DATABASE_NAME, COLLECTION_NAME
from pymongo import MongoClient
from ultralytics import YOLO
from emergency_manager import EmergencyManager

class CameraStream:
    def __init__(self, src, name, process_callback=None):
        self.src = src
        self.name = name
        self.process_callback = process_callback
        # Initialize
        self.stream = cv2.VideoCapture(self.src, cv2.CAP_DSHOW)
        (self.grabbed, self.frame) = self.stream.read()
        self.started = False
        self.read_lock = threading.Lock()
        self.output_frame = None
        self.roi_mask = None # For ROI
        if self.grabbed:
            self.output_frame = self.frame.copy()

    def set_roi(self, roi_data):
        """
        Sets the Region of Interest (ROI) mask.
        roi_data: {'type': 'rect'|'circle'|'poly'|'freehand', 'points': [...]} (normalized 0.0-1.0)
        """
        with self.read_lock:
            if roi_data is None:
                self.roi_mask = None
                return

            if self.frame is None: return

            h, w = self.frame.shape[:2]
            mask = np.zeros((h, w), dtype=np.uint8)
            
            points = roi_data.get('points')
            shape_type = roi_data.get('type')
            
            try:
                if shape_type == 'rect':
                    # [x, y, w, h]
                    x, y, rw, rh = points
                    x, y, rw, rh = int(x*w), int(y*h), int(rw*w), int(rh*h)
                    cv2.rectangle(mask, (x, y), (x+rw, y+rh), 255, -1)
                    
                elif shape_type == 'circle':
                    # [cx, cy, r]
                    cx, cy, r = points
                    cx, cy, r = int(cx*w), int(cy*h), int(r*w)
                    cv2.circle(mask, (cx, cy), r, 255, -1)
                    
                elif shape_type in ['poly', 'freehand']:
                    # [[x, y], [x, y], ...]
                    pts = np.array([ [int(p[0]*w), int(p[1]*h)] for p in points ], np.int32)
                    pts = pts.reshape((-1, 1, 2))
                    cv2.fillPoly(mask, [pts], 255)
                
                self.roi_mask = mask
                print(f"ROI Set for {self.name}: {shape_type}")
            except Exception as e:
                print(f"Error setting ROI: {e}")

    def start(self):
        if self.started: return self
        self.started = True
        self.thread = threading.Thread(target=self.update, args=())
        self.thread.daemon = True
        self.thread.start()
        return self

    def update(self):
        while self.started:
            try:
                (grabbed, frame) = self.stream.read()
                self.grabbed = grabbed
                if not grabbed:
                    # Retry logic: Re-open if possible or wait
                    time.sleep(0.5)
                    try:
                         # Attempt reconnect
                         self.stream.release()
                         self.stream = cv2.VideoCapture(self.src, cv2.CAP_DSHOW)
                    except: pass
                    continue
                
                # Process frame
                if self.process_callback:
                    try:
                        # We pass the metadata to the callback, not apply it here blindly
                        # Pass the mask separately ? 
                        # Actually process_frame is decoupled.
                        # We should just make sure self.roi_mask is accessible or passed.
                        pass
                        
                        frame = self.process_callback(frame)
                    except Exception as e:
                        print(f"Error processing callback: {e}") 
                        # If processing fails, still show raw frame!
                
                with self.read_lock:
                    self.output_frame = frame.copy()
            
            except Exception as e:
                print(f"Stream Error: {e}")
                time.sleep(0.5)

            # Cap at ~30 FPS to save CPU
            time.sleep(0.03)

    def read(self):
        with self.read_lock:
            return self.output_frame if self.output_frame is not None else None

    def stop(self):
        self.started = False
        if hasattr(self, 'thread') and self.thread.is_alive():
             self.thread.join(timeout=1.0)
        self.stream.release()

class CameraManager:
    def __init__(self, app_config, db):
        self.app_config = app_config
        self.db = db
        self.persons = self.db[COLLECTION_NAME]
        
        # Initialize Emergency Manager
        self.emergency = EmergencyManager(self.db)
        
        # Initialize YOLO
        print("Loading YOLOv8 model...")
        self.model = YOLO('yolov8n.pt') 
        # Standard COCO classes: 43=knife, 76=scissors. 
        # Extended & Proxy Classes:
        # 34=Bat, 39=Bottle (Real)
        # 65=Remote (Handgun Proxy), 25=Umbrella (Rifle Proxy)
        # 67=Cell Phone (Simulated Trigger)
        self.threat_classes = {
            43: "Knife", 76: "Scissors",
            34: "Baseball Bat", 39: "Glass Bottle",
            65: "Handgun (Glock)", 25: "Rifle (AK47/M4)", 
            67: "Simulated Trigger"
        }
        self.class_names = self.model.names

        self.known_face_encodings = []
        self.known_face_names = []
        self.known_face_relations = [] # To store relation (e.g. employee, family)
        
        # Stats
        self.stats = {
            "suspects": 0,
            "unknown": 0,
            "known": 0,
            "traffic": 0,
            "history": [] # Simple log
        }
        self.stats_lock = threading.Lock()
        
        # Auto-Registration Counter
        # Check highest "Unknown X" in DB to resume numbering
        last_unknown = self.persons.find_one({"name": {"$regex": "^Unknown \d+"}}, sort=[("created_at", -1)])
        self.auto_id_counter = 1
        if last_unknown:
            try:
                self.auto_id_counter = int(last_unknown['name'].split(" ")[1]) + 1
            except: pass
        
        # Ensure captures dir exists
        self.captures_dir = os.path.join(app_config['UPLOAD_FOLDER'], 'captures')
        os.makedirs(self.captures_dir, exist_ok=True)
        
        # Optimization: Cache results per camera to decouple detection FPS from Video FPS
        self.camera_states = {} # {id: {'last_detect': 0, 'results': []}}
        
        self.load_known_faces()

    def set_camera_roi(self, device_id, roi_data, cameras_dict):
        """Sets ROI for a specific camera in the cameras dict"""
        if device_id in cameras_dict:
             stream = cameras_dict[device_id]['stream']
             stream.set_roi(roi_data)
             return True
        return False

        if len(self.known_face_names) == 0:
            print(f"Warning: No known faces loaded. Detection will only show 'Unknown'.")



    def _load_cache(self):
        cache_path = "encodings_cache.pkl"
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'rb') as f:
                    return pickle.load(f)
            except Exception as e:
                print(f"Warning: Cache corrupted or unreadable ({e}). Ignoring.")
        return {}

    def _save_cache(self, cache):
        try:
            with open("encodings_cache.pkl", 'wb') as f:
                pickle.dump(cache, f)
        except Exception as e:
            print(f"Warning: Could not save cache: {e}")

    def load_known_faces(self):
        """Loads known faces from database with caching to improve performance."""
        print("Loading known faces...")
        self.known_face_encodings = []
        self.known_face_names = []
        self.known_face_relations = []
        
        cache = self._load_cache()
        new_cache = {}
        
        all_persons = list(self.persons.find())
        
        def get_encoding(path):
            # 1. Check Cache
            if path in cache:
                new_cache[path] = cache[path]
                return cache[path]
            
            # 2. Compute
            if not os.path.exists(path): return None
            try:
                image = face_recognition.load_image_file(path)
                encs = face_recognition.face_encodings(image)
                if len(encs) > 0:
                    new_cache[path] = encs[0]
                    return encs[0]
            except Exception as e:
                print(f"Error processing {path}: {e}")
            return None

        for person in all_persons:
            encodings_found = 0
            
            # 1. Try Directory
            if 'photo_dir' in person and person['photo_dir']:
                 dir_path = os.path.join(self.app_config['UPLOAD_FOLDER'], person['photo_dir'])
                 if os.path.exists(dir_path):
                     for fname in os.listdir(dir_path):
                         # skip non-images simple check
                         if not fname.lower().endswith(('.jpg', '.jpeg', '.png')): continue
                         
                         full_path = os.path.join(dir_path, fname)
                         enc = get_encoding(full_path)
                         if enc is not None:
                             self.known_face_encodings.append(enc)
                             self.known_face_names.append(person['name'])
                             self.known_face_relations.append(person['relation'])
                             encodings_found += 1
            
            # 2. Try Single File (Legacy)
            if encodings_found == 0:
                photo_path = os.path.join(self.app_config['UPLOAD_FOLDER'], person['photo'])
                enc = get_encoding(photo_path)
                if enc is not None:
                    self.known_face_encodings.append(enc)
                    self.known_face_names.append(person['name'])
                    self.known_face_relations.append(person['relation'])


        self._save_cache(new_cache)
        print(f"Loaded {len(self.known_face_names)} faces.")

    def add_person_to_memory(self, person_data):
        """Incrementally adds a new person to memory without full reload."""
        print(f"Adding person incrementally: {person_data['name']}")
        
        # Determine encoding source
        encodings_to_add = []
        
        # 1. Try Directory
        if 'photo_dir' in person_data and person_data['photo_dir']:
             dir_path = os.path.join(self.app_config['UPLOAD_FOLDER'], person_data['photo_dir'])
             if os.path.exists(dir_path):
                 for fname in os.listdir(dir_path):
                     if not fname.lower().endswith(('.jpg', '.jpeg', '.png')): continue
                     full_path = os.path.join(dir_path, fname)
                     try:
                         image = face_recognition.load_image_file(full_path)
                         encs = face_recognition.face_encodings(image)
                         if encs: encodings_to_add.append(encs[0])
                     except: pass
        
        # 2. Try Single File if none found
        if not encodings_to_add and 'photo' in person_data:
             photo_path = os.path.join(self.app_config['UPLOAD_FOLDER'], person_data['photo'])
             try:
                 image = face_recognition.load_image_file(photo_path)
                 encs = face_recognition.face_encodings(image)
                 if encs: encodings_to_add.append(encs[0])
             except: pass

        if encodings_to_add:
            for enc in encodings_to_add:
                self.known_face_encodings.append(enc)
                self.known_face_names.append(person_data['name'])
                self.known_face_relations.append(person_data['relation'])
        else:
            print("Warning: No valid face encoding found for new person.")

    def remove_person_from_memory(self, name):
        """Incrementally removes a person from memory by name."""
        print(f"Removing person incrementally: {name}")
        
        # Iterate backwards to safely remove items
        # Find all indices with this name
        indices_to_remove = [i for i, n in enumerate(self.known_face_names) if n == name]
        
        for index in sorted(indices_to_remove, reverse=True):
            del self.known_face_encodings[index]
            del self.known_face_names[index]
            del self.known_face_relations[index]




    def process_frame(self, frame, device_id=None, roi_mask=None):
        """
        Processes frame with rate-limiting for AI detection.
        Refactored for smooth streaming.
        """
        if frame is None or frame.size == 0:
             return frame

        # If no device_id provided (legacy), just run full detection (slow)
        if device_id is None:
             overlays = self._detect_faces_and_objects(frame)
             return self._draw_overlays(frame, overlays)

        # Initialize state
        if device_id not in self.camera_states:
             self.camera_states[device_id] = {'last_detect': 0, 'results': []}
        
        state = self.camera_states[device_id]
        now = time.time()
        
        # Rate Limit Detection to ~10 FPS (every 0.1s)
        if (now - state['last_detect']) > 0.1:
             try:
                 # Apply ROI Mask ONLY for detection
                 detect_frame = frame.copy()
                 if roi_mask is not None:
                      try:
                          detect_frame = cv2.bitwise_and(detect_frame, detect_frame, mask=roi_mask)
                      except: pass
                 
                 overlays = self._detect_faces_and_objects(detect_frame)
                 state['results'] = overlays
                 state['last_detect'] = now
             except Exception as e:
                 print(f"Detection Error: {e}")
        
        # Draw cached results on current FULL frame
        # Also Draw ROI Border
        frame = self._draw_overlays(frame, state['results'])
        
        if roi_mask is not None:
             # Find contours of mask to draw border
             contours, _ = cv2.findContours(roi_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
             cv2.drawContours(frame, contours, -1, (0, 255, 255), 1) # Yellow 1px border
             
             # Optional: Darken outside area slightly?
             # mask_inv = cv2.bitwise_not(roi_mask)
             # darker = cv2.addWeighted(frame, 0.5, np.zeros(frame.shape, frame.dtype), 0, 0)
             # frame = cv2.bitwise_and(frame, frame, mask=roi_mask) + cv2.bitwise_and(darker, darker, mask=mask_inv)
             # Keeping it simple for now as requested (just border).

        return frame

    def _detect_faces_and_objects(self, frame):
        """Runs heavy AI detection and returns list of overlay data"""
        overlays = []
        
        # Resize frame of video to 1/2 size (improved from 1/4) for better face recognition logic
        # Standard FaceNet/dlib usage
        small_frame = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
        rgb_small_frame = small_frame[:, :, ::-1]

        # --- FACE RECOGNITION ---
        # Using HOG model (default) or 'cnn' if GPU available (but assuming CPU for now for safety)
        face_locations = face_recognition.face_locations(rgb_small_frame)
        face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

        current_frame_stats = {"known": 0, "unknown": 0, "suspects": 0}

        for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
            # Scale back up (since we used 0.5x, we multiply by 2)
            top *= 2; right *= 2; bottom *= 2; left *= 2

            # Compare (Tolerance: Lower is stricter. Default is 0.6)
            # User experiencing "not recognized" -> 0.6 is standard.
            # Using distance to find best match is more reliable than strict boolean.
            matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding, tolerance=0.55)
            name = "Unknown"
            relation = "Stranger"

            face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
            if len(face_distances) > 0:
                best_match_index = np.argmin(face_distances)
                if matches[best_match_index]:
                    name = self.known_face_names[best_match_index]
                    relation = self.known_face_relations[best_match_index]
            
            # Auto Registration Logic (Simplified for copy/paste safety - same as before)
            if name == "Unknown":
                try:
                    new_name = f"Unknown {self.auto_id_counter}"
                    self.auto_id_counter += 1
                    relation = "Auto-Detected"
                    
                    # Scaling: 'top', 'right' etc are ALREADY scaled to original size in the loop above.
                    # So we just use them directly.
                    h, w, _ = frame.shape
                    top_f = max(0, top); left_f = max(0, left); bottom_f = min(h, bottom); right_f = min(w, right)
                    face_img_save = frame[top_f:bottom_f, left_f:right_f].copy()
                    
                    if face_img_save.size > 0:
                        filename = f"{new_name.replace(' ', '_')}.jpg"
                        save_path = os.path.join(self.app_config['UPLOAD_FOLDER'], 'known', filename)
                        os.makedirs(os.path.dirname(save_path), exist_ok=True)
                        cv2.imwrite(save_path, face_img_save)
                        
                        self.persons.insert_one({
                            "serial_no": 9000 + self.auto_id_counter,
                            "name": new_name,
                            "relation": relation,
                            "phone": "N/A",
                            "address": "Auto-Captured",
                            "photo": f"known/{filename}",
                            "created_at": datetime.now()
                        })
                        self.known_face_encodings.append(face_encoding)
                        self.known_face_names.append(new_name)
                        self.known_face_relations.append(relation)
                        name = new_name
                        print(f"Auto-Registered: {name}")
                except Exception as e: print(f"Auto-reg error: {e}")

            # Stats & Trigger
            if relation == "Auto-Detected" or name.startswith("Unknown"):
                 current_frame_stats["unknown"] += 1
            else:
                 current_frame_stats["known"] += 1
                 
            if "suspect" in relation.lower():
                 self.emergency.trigger_emergency("Known Suspect")

            # Capture Snapshot Logic
            # Coordinates are already scaled back to 1.0 (original frame) at the start of loop.
            
            # Log Event
            h, w, _ = frame.shape
            c_top = max(0, top); c_left = max(0, left); c_bottom = min(h, bottom); c_right = min(w, right)
            face_img = frame[c_top:c_bottom, c_left:c_right]
            if face_img.size > 0:
                 self.log_event(name, "Detected", relation, face_img)

            # Add to overlays
            color = (0, 0, 255) if name.startswith("Unknown") else (0, 255, 0)
            if "suspect" in relation.lower(): color = (0, 165, 255)
            
            overlays.append({
                'type': 'box',
                'coords': (left, top, right, bottom),
                'color': color,
                'label': f"{name} ({relation})",
                'filled': True # Bottom label bar
            })

        # --- YOLO OBJECT DETECTION ---
        results = self.model(rgb_small_frame, verbose=False, iou=0.5, conf=0.4)
        person_boxes = []

        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls = int(box.cls[0])
                if cls == 0: # Person
                     x1, y1, x2, y2 = box.xyxy[0]
                     x1, y1, x2, y2 = int(x1*4), int(y1*4), int(x2*4), int(y2*4)
                     person_boxes.append((x1, y1, x2, y2))
                     continue

                if cls in self.threat_classes:
                    x1, y1, x2, y2 = box.xyxy[0]
                    x1, y1, x2, y2 = int(x1*4), int(y1*4), int(x2*4), int(y2*4)
                    label = self.threat_classes[cls]
                    
                    self.emergency.trigger_emergency(f"Weapon ({label})")
                    
                    # Log to Tracking
                    h, w, _ = frame.shape
                    # Clamp coordinates
                    cy1, cx1 = max(0, y1), max(0, x1)
                    cy2, cx2 = min(h, y2), min(w, x2)
                    weapon_img = frame[cy1:cy2, cx1:cx2].copy()
                    
                    self.log_event("System", f"Weapon: {label}", "Suspect", weapon_img)

                    overlays.append({
                        'type': 'box',
                        'coords': (x1, y1, x2, y2),
                        'color': (0, 0, 255),
                        'label': f"THREAT: {label}", 
                        'thick': 3
                    })

        # --- FIGHT DETECTION ---
        if len(person_boxes) >= 2:
            import itertools
            for (box1, box2) in itertools.combinations(person_boxes, 2):
                xA = max(box1[0], box2[0]); yA = max(box1[1], box2[1])
                xB = min(box1[2], box2[2]); yB = min(box1[3], box2[3])
                interArea = max(0, xB - xA) * max(0, yB - yA)
                box1Area = (box1[2] - box1[0]) * (box1[3] - box1[1])
                box2Area = (box2[2] - box2[0]) * (box2[3] - box2[1])
                iou = interArea / float(box1Area + box2Area - interArea)
                
                if iou > 0.35:
                     fx1 = min(box1[0], box2[0]); fy1 = min(box1[1], box2[1])
                     fx2 = max(box1[2], box2[2]); fy2 = max(box1[3], box2[3])
                     
                     self.log_event("System", "Violence Detected", "Suspect")
                     self.emergency.trigger_emergency("Violence / Fighting")
                     
                     overlays.append({
                        'type': 'box',
                        'coords': (fx1, fy1, fx2, fy2),
                        'color': (128, 0, 128),
                        'label': "VIOLENCE DETECTED",
                        'thick': 4
                     })
                     
        return overlays

    def _draw_overlays(self, frame, overlays):
        """Draws cached overlays on the frame"""
        for item in overlays:
            try:
                if item['type'] == 'box':
                    l, t, r, b = item['coords']
                    c = item['color']
                    thick = item.get('thick', 2)
                    
                    cv2.rectangle(frame, (l, t), (r, b), c, thick)
                    
                    if item.get('filled'):
                        cv2.rectangle(frame, (l, b - 35), (r, b), c, cv2.FILLED)
                        cv2.putText(frame, item['label'], (l + 6, b - 6), 
                                    cv2.FONT_HERSHEY_DUPLEX, 0.6, (255, 255, 255), 1)
                    else:
                        cv2.putText(frame, item['label'], (l, t - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, c, 2)
            except: pass
        return frame

    def log_event(self, name, action, relation="Visitor", face_img=None):
        """Adds an event to the history log"""
        # Limit log size
        if len(self.stats["history"]) > 20: # Increased log size
            self.stats["history"].pop(0)
            
        # Avoid duplicate consecutive logs (debounce 2 seconds)
        now = datetime.now()
        if self.stats["history"]:
            last = self.stats["history"][-1]
            last_time = datetime.strptime(last['time'], "%H:%M:%S")
            seconds_diff = abs((now - now.replace(hour=last_time.hour, minute=last_time.minute, second=last_time.second)).total_seconds())
            
            # Same name/action debounce
            if last['name'] == name and last['action'] == action and seconds_diff < 3: 
                return

        # Increment Stats (Event Based)
        with self.stats_lock:
            if name == "System": # System events (Weapons)
                self.stats["suspects"] += 1
            elif name == "Unknown":
                self.stats["unknown"] += 1
            else:
                self.stats["known"] += 1

        # Save Image if provided
        snap_rel_path = "default_avatar.png"
        if face_img is not None:
            clean_name = "".join([c for c in name if c.isalnum() or c in (' ', '-', '_')]).strip().replace(' ', '_')
            ts = now.strftime("%Y%m%d_%H%M%S")
            filename = f"{ts}_{clean_name}.jpg"
            save_path = os.path.join(self.captures_dir, filename)
            try:
                cv2.imwrite(save_path, face_img)
                # Client needs path relative to 'static'. 
                # UPLOAD_FOLDER is 'static/uploads'.
                # So we want 'uploads/captures/filename'.
                snap_rel_path = f"uploads/captures/{filename}"
            except Exception as e:
                print(f"Failed to save snap: {e}")

        log_entry = {
            "name": name,
            "action": action,
            "relation": relation,
            "image": snap_rel_path,
            "time": now.strftime("%H:%M:%S"),
            "date": now.strftime("%Y-%m-%d")
        }
        
        self.stats["history"].append(log_entry)
        
        # Permanent Log for "Suspects Log" page
        if name == "System" or "Suspect" in relation or name == "Unknown":
             if "suspect_logs" not in self.stats: self.stats["suspect_logs"] = []
             # Prepend to show newest first
             self.stats["suspect_logs"].insert(0, log_entry)
             # Limit to 100 for now
             if len(self.stats["suspect_logs"]) > 100:
                 self.stats["suspect_logs"].pop()


    def get_stats(self):
        with self.stats_lock:
            return self.stats
