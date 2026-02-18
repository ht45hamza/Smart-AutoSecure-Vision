import cv2
import face_recognition
import numpy as np
import os
import threading
import time
import pickle
from datetime import datetime
from .config import MONGODB_URI, DATABASE_NAME, COLLECTION_NAME
from pymongo import MongoClient
from ultralytics import YOLO
import torch 
from .emergency_manager import EmergencyManager

class CameraStream:
    def __init__(self, src, name):
        self.src = src
        self.name = name
        
        # Initialize Stream
        self.stream = cv2.VideoCapture(self.src, cv2.CAP_DSHOW)
        (self.grabbed, self.frame) = self.stream.read()
        self.started = False
        self.read_lock = threading.Lock()
        self.output_frame = None
        self.roi_mask = None # For ROI
        
        if self.grabbed:
            self.output_frame = self.frame.copy()

        # Async Processing State
        self.latest_overlays = []
        self.overlay_lock = threading.Lock()
        
        # Pipeline Functions
        self.detector_func = None
        self.drawer_func = None

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

    def set_pipeline(self, detector, drawer):
        """Sets the detection and drawing functions"""
        self.detector_func = detector
        self.drawer_func = drawer

    def start(self):
        if self.started: return self
        self.started = True
        
        # Start Frame Grabber & Drawer Thread
        self.thread = threading.Thread(target=self.update, args=())
        self.thread.daemon = True
        self.thread.start()
        
        # Start AI Detection Thread
        self.detect_thread = threading.Thread(target=self.run_detection, args=())
        self.detect_thread.daemon = True
        self.detect_thread.start()
        
        return self

    def run_detection(self):
        """Background thread for heavy AI processing"""
        while self.started:
            if self.detector_func and self.frame is not None:
                try:
                    # Use a copy of the frame to avoid tearing/race conditions
                    detect_frame = self.frame.copy()
                    
                    # Run Detection (Slow)
                    results = self.detector_func(detect_frame, self.roi_mask)
                    
                    # Update Overlays safely
                    with self.overlay_lock:
                        self.latest_overlays = results
                        
                except Exception as e:
                    print(f"Detection Thread Error: {e}")
            
            # Rate limit detection (e.g., 10-15 FPS is enough for detection)
            time.sleep(0.08)

    def update(self):
        """Main loop for grabbing frames and drawing overlays (Fast)"""
        while self.started:
            try:
                (grabbed, frame) = self.stream.read()
                self.grabbed = grabbed
                if not grabbed:
                    # Retry logic
                    time.sleep(0.5)
                    try:
                         self.stream.release()
                         self.stream = cv2.VideoCapture(self.src, cv2.CAP_DSHOW)
                    except: pass
                    continue
                
                self.frame = frame
                
                # Draw Overlays (Fast)
                if self.drawer_func:
                    # Get latest cached overlays
                    with self.overlay_lock:
                        current_overlays = self.latest_overlays
                    
                    # Render
                    try:
                        self.output_frame = self.drawer_func(frame.copy(), current_overlays, self.roi_mask)
                    except Exception as e:
                        self.output_frame = frame
                else:
                    self.output_frame = frame
                
                # Cap Video FPS slightly to save resources, but keep it smooth
                time.sleep(0.01)
            
            except Exception as e:
                print(f"Stream Error: {e}")
                time.sleep(0.5)

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
        try:
            import ultralytics
            torch.serialization.add_safe_globals([ultralytics.nn.tasks.DetectionModel])
        except:
            pass
            
        self.model = YOLO('yolov8n.pt') 
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
            "history": [], 
            "suspect_logs": []
        }
        
        # Hydrate stats from DB
        try:
            recent_logs = list(self.db['suspect_logs'].find().sort("timestamp", -1).limit(20))
            for log in recent_logs:
                if '_id' in log: del log['_id'] 
                if 'timestamp' in log: del log['timestamp']
            self.stats['history'] = recent_logs
            self.stats['suspect_logs'] = recent_logs 
        except Exception as e:
            print(f"Error hydrating stats: {e}")
        self.stats_lock = threading.Lock()
        
        # Auto-Registration Counter
        last_unknown = self.persons.find_one({"name": {"$regex": r"^Unknown \d+"}}, sort=[("created_at", -1)])
        self.auto_id_counter = 1
        if last_unknown:
            try:
                self.auto_id_counter = int(last_unknown['name'].split(" ")[1]) + 1
            except: pass
        
        self.captures_dir = os.path.join(app_config['UPLOAD_FOLDER'], 'captures')
        os.makedirs(self.captures_dir, exist_ok=True)
        
        self.load_known_faces()

    def set_camera_roi(self, device_id, roi_data, cameras_dict):
        """Sets ROI for a specific camera in the cameras dict"""
        if device_id in cameras_dict:
             stream = cameras_dict[device_id]['stream']
             stream.set_roi(roi_data)
             return True
        return False

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
            if path in cache:
                new_cache[path] = cache[path]
                return cache[path]
            
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
            
            # Directory
            if 'photo_dir' in person and person['photo_dir']:
                 dir_path = os.path.join(self.app_config['UPLOAD_FOLDER'], person['photo_dir'])
                 if os.path.exists(dir_path):
                     for fname in os.listdir(dir_path):
                         if not fname.lower().endswith(('.jpg', '.jpeg', '.png')): continue
                         full_path = os.path.join(dir_path, fname)
                         enc = get_encoding(full_path)
                         if enc is not None:
                             self.known_face_encodings.append(enc)
                             self.known_face_names.append(person['name'])
                             self.known_face_relations.append(person['relation'])
                             encodings_found += 1
            
            # Single File
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
        print(f"Adding person incrementally: {person_data['name']}")
        encodings_to_add = []
        
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

    def remove_person_from_memory(self, name):
        """Incrementally removes a person from memory by name."""
        indices_to_remove = [i for i, n in enumerate(self.known_face_names) if n == name]
        for index in sorted(indices_to_remove, reverse=True):
            del self.known_face_encodings[index]
            del self.known_face_names[index]
            del self.known_face_relations[index]

    # --- NEW ARCHITECTURE METHODS ---
    
    def detect_task(self, frame, roi_mask=None):
        """Task that runs detection and returns overlays (runs in BG thread)"""
        # Apply ROI ONLY for detection
        detect_frame = frame
        if roi_mask is not None:
            try:
                detect_frame = cv2.bitwise_and(frame, frame, mask=roi_mask)
            except: pass
            
        return self._detect_faces_and_objects(detect_frame)

    def draw_task(self, frame, overlays, roi_mask=None):
        """Task that draws overlays on the frame (runs in Main Stream thread)"""
        frame = self._draw_overlays(frame, overlays)
        
        if roi_mask is not None:
            contours, _ = cv2.findContours(roi_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(frame, contours, -1, (0, 255, 255), 1)
            
        return frame

    def _detect_faces_and_objects(self, frame):
        """Runs heavy AI detection and returns list of overlay data"""
        overlays = []
        
        # Resize for speed
        h, w = frame.shape[:2]
        small_frame = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
        rgb_small_frame = small_frame[:, :, ::-1]

        # --- FACE RECOGNITION ---
        face_locations = face_recognition.face_locations(rgb_small_frame)
        face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

        for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
            top *= 2; right *= 2; bottom *= 2; left *= 2

            # Tolerance adjusted for "Proper Detection" (0.55 is good, maybe 0.6 if user complains of misses)
            matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding, tolerance=0.55)
            name = "Unknown"
            relation = "Stranger"

            face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
            if len(face_distances) > 0:
                best_match_index = np.argmin(face_distances)
                if matches[best_match_index]:
                    name = self.known_face_names[best_match_index]
                    relation = self.known_face_relations[best_match_index]
            
            # Auto Registration
            if name == "Unknown":
                try:
                    new_name = f"Unknown {self.auto_id_counter}"
                    self.auto_id_counter += 1
                    relation = "Auto-Detected"
                    
                    face_img_save = frame[max(0,top):min(h,bottom), max(0,left):min(w,right)].copy()
                    
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
                except Exception as e: print(f"Auto-reg error: {e}")

            # Triggers
            if "suspect" in relation.lower():
                 self.emergency.trigger_emergency("Known Suspect")

            # Log
            self.log_event(name, "Detected", relation, frame.copy())

            # Add to overlays
            color = (0, 0, 255) if name.startswith("Unknown") else (0, 255, 0)
            if "suspect" in relation.lower(): color = (0, 165, 255) # Orange for suspect
            
            overlays.append({
                'type': 'box',
                'coords': (left, top, right, bottom),
                'color': color,
                'label': f"{name} ({relation})",
                'filled': True
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
                     x1, y1, x2, y2 = int(x1*2), int(y1*2), int(x2*2), int(y2*2) # Scale 2x (since 0.5x)
                     person_boxes.append((x1, y1, x2, y2))
                     continue

                if cls in self.threat_classes:
                    x1, y1, x2, y2 = box.xyxy[0]
                    x1, y1, x2, y2 = int(x1*2), int(y1*2), int(x2*2), int(y2*2) # Scale 2x
                    label = self.threat_classes[cls]
                    
                    self.emergency.trigger_emergency(f"Weapon ({label})")
                    self.log_event("System", f"Weapon: {label}", "Suspect", frame.copy())

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
                     
                     self.log_event("System", "Violence Detected", "Suspect", frame.copy())
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
        """Adds an event to the history log and persists to MongoDB"""
        
        # Debounce (Memory check)
        now = datetime.now()
        if self.stats["history"]:
            last = self.stats["history"][-1]
            try:
                last_time_str = last.get('time') 
                if last_time_str:
                    last_time = datetime.strptime(last_time_str, "%H:%M:%S")
                    pass # logic is complicated to reconstruct from snippet, assuming standard compare
                    # Reusing previous logic, but fixing datetime
                    last_time = now.replace(hour=last_time.hour, minute=last_time.minute, second=last_time.second)
                    seconds_diff = abs((now - last_time).total_seconds())
                    if last['name'] == name and last['action'] == action and seconds_diff < 3: 
                        return
            except: pass

        # Increment Stats
        with self.stats_lock:
            if name == "System": 
                self.stats["suspects"] += 1
            elif name == "Unknown":
                self.stats["unknown"] += 1
            else:
                self.stats["known"] += 1

        # Save Image
        snap_rel_path = "default_avatar.png"
        if face_img is not None:
            clean_name = "".join([c for c in name if c.isalnum() or c in (' ', '-', '_')]).strip().replace(' ', '_')
            ts = now.strftime("%Y%m%d_%H%M%S")
            filename = f"{ts}_{clean_name}.jpg"
            save_path = os.path.join(self.captures_dir, filename)
            try:
                cv2.imwrite(save_path, face_img)
                snap_rel_path = f"uploads/captures/{filename}"
            except Exception as e:
                print(f"Failed to save snap: {e}")

        log_entry = {
            "name": name,
            "action": action,
            "relation": relation,
            "image": snap_rel_path,
            "time": now.strftime("%H:%M:%S"),
            "date": now.strftime("%Y-%m-%d"),
            "timestamp": now
        }
        
        # In-Memory
        self.stats["history"].append(log_entry)
        if len(self.stats["history"]) > 20: 
            self.stats["history"].pop(0)

        # MongoDB
        try:
             self.db['suspect_logs'].insert_one(log_entry.copy())
        except Exception as e:
             print(f"DB Log Error: {e}")

    def get_stats(self):
        try:
            today = datetime.now().strftime("%Y-%m-%d")
            
            known_count = self.db['suspect_logs'].count_documents({
                "date": today,
                "name": {"$not": {"$regex": "^Unknown"}, "$ne": "System"}
            })
            
            unknown_count = self.db['suspect_logs'].count_documents({
                "date": today,
                "name": {"$regex": "^Unknown"}
            })
            
            suspect_count = self.db['suspect_logs'].count_documents({
                "date": today,
                "$or": [
                    {"name": "System"},
                    {"relation": {"$regex": "Suspect"}}
                ]
            })
            
            with self.stats_lock:
                self.stats["known"] = known_count
                self.stats["unknown"] = unknown_count
                self.stats["suspects"] = suspect_count
                
                # Refresh history from DB to reflect deletions
                recent_logs = list(self.db['suspect_logs'].find().sort("timestamp", -1).limit(20))
                cleaned_history = []
                for log in recent_logs:
                    if '_id' in log: log['_id'] = str(log['_id'])
                    if 'timestamp' in log and isinstance(log['timestamp'], datetime):
                         log['timestamp'] = log['timestamp'].isoformat()
                    cleaned_history.append(log)
                self.stats["history"] = cleaned_history
                
            return self.stats
        except Exception as e:
            print(f"Stats Error: {e}")
            return self.stats

