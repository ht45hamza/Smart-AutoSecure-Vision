# app.py
from flask import Flask, render_template, Response, jsonify, request, redirect, url_for, send_from_directory
import cv2
import os
import threading
import base64
import time
from datetime import datetime
from pymongo import MongoClient
from pymongo.errors import ConfigurationError, ConnectionFailure, ServerSelectionTimeoutError
from bson.objectid import ObjectId
from json_db import JsonDB
from config import MONGODB_URI, DATABASE_NAME, COLLECTION_NAME
from camera_manager import CameraManager, CameraStream
from auth_manager import AuthManager
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
import time

app = Flask(__name__)
app.secret_key = "super_secret_key"
app.config['UPLOAD_FOLDER'] = 'static/uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# MongoDB Connection
try:
    # Try connecting with a timeout
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    client.admin.command('ping') # Trigger connection check
    print("Connected to MongoDB (Primary)")
    db = client[DATABASE_NAME]
    persons = db[COLLECTION_NAME]
except (ConfigurationError, ConnectionFailure, ServerSelectionTimeoutError) as e:
    print(f"Warning: Could not connect to primary MongoDB ({e}). Trying Localhost...")
    try:
        client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
        client.admin.command('ping')
        print("Connected to MongoDB (Localhost)")
        db = client[DATABASE_NAME]
        persons = db[COLLECTION_NAME]
    except Exception as e2:
        print(f"Info: Localhost MongoDB not available. Using Built-in Local Storage (json_db).")
        # Fallback to JSON DB
        db = JsonDB("smart_vision") # Acts as Database
        persons = db[COLLECTION_NAME] # Acts as Collection

# Initialize Camera Manager
camera_manager = CameraManager(app.config, db)

# Auth Setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

auth_manager = AuthManager(db, app.config)

@login_manager.user_loader
def load_user(user_id):
    return auth_manager.get_user_by_id(user_id)

# Camera System (unchanged)
cameras = {}
main_camera_id = None
lock = threading.Lock()

def generate_frames(device_id):
    while True:
        stream = None
        with lock:
            if device_id in cameras:
                stream = cameras[device_id]['stream']
        
        if stream:
            frame = stream.read()
            if frame is None:
                time.sleep(0.01)
                continue
            
            # Frame is already processed in background thread?
            # We designed CameraStream to take a callback. 
            # So `frame` here is ALREADY processed.
            
            ret, buffer = cv2.imencode('.jpg', frame)
            if ret:
                yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        
        time.sleep(0.03) # Limit sending rate to ~30 FPS

@app.route('/')
 
def index():
    return render_template('index.html')

# --- AUTH ROUTES ---
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user, msg = auth_manager.login_user(email, password)
        if user:
            login_user(user)
            return redirect(url_for('index'))
        return render_template('login.html', error=msg)
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        success, msg = auth_manager.register_user(name, email, password)
        if success:
            return redirect(url_for('verify_email', email=email))
        return render_template('register.html', error=msg)
    return render_template('register.html')

@app.route('/verify_email', methods=['GET', 'POST'])
def verify_email():
    email = request.args.get('email') or request.form.get('email')
    if request.method == 'POST':
        otp = request.form.get('otp')
        success, msg = auth_manager.verify_email(email, otp)
        if success:
            return render_template('login.html', msg="Verification Successful! Please login.")
        return render_template('verify_email.html', email=email, error=msg)
    return render_template('verify_email.html', email=email)

@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        step = request.form.get('step')
        email = request.form.get('email')
        
        if step == '1': # Request OTP
            success, msg = auth_manager.forgot_password_request(email)
            if success:
                return render_template('forgot_password.html', step=2, email=email)
            return render_template('forgot_password.html', step=1, error=msg)
            
        elif step == '2': # Reset
            otp = request.form.get('otp')
            password = request.form.get('password')
            success, msg = auth_manager.reset_password(email, otp, password)
            if success:
                return render_template('login.html', msg="Password changed successfully.")
            return render_template('forgot_password.html', step=2, email=email, error=msg)
            
    return render_template('forgot_password.html', step=1)

@app.route('/logout')
 
def logout():
    logout_user()
    return redirect(url_for('login'))

# --- CAMERA ROUTES ---
@app.route('/video_feed/<int:device_id>')
 
def video_feed(device_id):
    return Response(generate_frames(device_id), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/cameras')
def get_cameras():
    available = []
    # Simplified scan
    for i in range(2):
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                available.append({'id': i, 'label': f'Camera {i+1}'})
            cap.release()
    return jsonify(available)

@app.route('/add_camera', methods=['POST'])
def add_camera():
    global main_camera_id
    data = request.json
    device_id = data['id']
    with lock:
        # Check if camera is already active
        if device_id in cameras:
            # Check if likely healthy
            if cameras[device_id]['stream'].grabbed:
                print(f"Info: Camera {device_id} already active.")
                if main_camera_id is None:
                     main_camera_id = device_id
                     cameras[device_id]['main'] = True
                return jsonify({'success': True, 'main': main_camera_id, 'id': device_id, 'message': 'Camera already active'})
            else:
                # Cleanup dead camera
                cameras[device_id]['stream'].stop()
                del cameras[device_id]

        # Init new stream
        try:
            # Pass device_id to process_frame for rate-limiting
            # IMPORTANT: stream is defined here, but lambda binds `stream` by reference if we aren't careful?
            # Actually, `stream` variable inside lambda will point to the local variable.
            # But we must be careful.
            # Better to define a helper function or assume `stream` is available.
            # Creating stream first.
            stream = CameraStream(device_id, data['label'])
            stream.process_callback = lambda f: camera_manager.process_frame(f, device_id, stream.roi_mask)
            stream.start()
            
            # Wait a bit to check if it started
            time.sleep(0.5)
            if not stream.grabbed:
                 stream.stop()
                 return jsonify({'success': False, 'message': 'Cannot open camera/stream'})

            cameras[device_id] = {'stream': stream, 'label': data['label'], 'main': False}
            if main_camera_id is None:
                main_camera_id = device_id
                cameras[device_id]['main'] = True
        except Exception as e:
            print(f"Error adding camera: {e}")
            return jsonify({'success': False, 'message': str(e)})
    return jsonify({'success': True, 'main': main_camera_id, 'id': device_id})

@app.route('/set_main/<int:device_id>')
def set_main(device_id):
    global main_camera_id
    with lock:
        if device_id in cameras:
            if main_camera_id is not None:
                cameras[main_camera_id]['main'] = False
            main_camera_id = device_id
            cameras[device_id]['main'] = True
    return jsonify({'success': True})

@app.route('/api/set_roi', methods=['POST'])
def set_roi():
    data = request.json
    device_id = data.get('id')
    roi_data = data.get('roi') # {'type':..., 'points':...}
    
    with lock:
        if camera_manager.set_camera_roi(device_id, roi_data, cameras):
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': 'Camera not found'})

@app.route('/api/stats')
def get_stats():
    return jsonify(camera_manager.get_stats())

@app.route('/api/emergency_status')
def get_emergency_status():
    return jsonify(camera_manager.emergency.get_status())

@app.route('/api/simulate_threat', methods=['POST'])
def simulate_threat():
    data = request.json
    threat_type = data.get('type', 'Simulated Threat')
    
    # Log and Trigger
    camera_manager.log_event("System", f"Simulated: {threat_type}", "Medical/Test")
    alert = camera_manager.emergency.trigger_emergency(threat_type)
    
    return jsonify({'success': True, 'alert': alert})


# --- ADMIN PANEL ROUTES ---
@app.route('/admin')
 
def admin_panel():
    all_persons = list(persons.find().sort("serial_no", -1))
    return render_template('admin.html', persons=all_persons)

@app.route('/admin/contacts')
 
def contacts_panel():
    contacts = camera_manager.emergency.get_contacts()
    return render_template('contacts.html', contacts=contacts)

@app.route('/admin/add_contact', methods=['POST'])
 
def add_contact():
    name = request.form['name']
    phone = request.form['phone']
    relation = request.form['relation']
    camera_manager.emergency.add_contact(name, phone, relation)
    return redirect(url_for('contacts_panel'))

@app.route('/admin/delete_contact/<contact_id>')
 
def delete_contact(contact_id):
    camera_manager.emergency.delete_contact(contact_id)
    return redirect(url_for('contacts_panel'))

@app.route('/admin/add', methods=['POST'])
 
def add_person():
    name = request.form['name']
    relation = request.form['relation']
    phone = request.form['phone']
    address = request.form['address']
    
    # Generate unique serial number
    last = persons.find_one(sort=[("serial_no", -1)])
    serial_no = (last['serial_no'] + 1) if last else 1001
    
    photo_path = "default.jpg"
    if 'photo' in request.files and request.files['photo'].filename:
        file = request.files['photo']
        photo_path = f"{serial_no}_{file.filename}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], photo_path))
    
    persons.insert_one({
        "serial_no": serial_no,
        "name": name,
        "relation": relation,
        "phone": phone,
        "address": address,
        "photo": photo_path,
        "created_at": datetime.now()
    })
    
    # Optimization: Incremental Update
    # camera_manager.load_known_faces() # Reload to update cache
    new_person = {
        "name": name,
        "relation": relation,
        "photo": photo_path
    }
    camera_manager.add_person_to_memory(new_person)
    
    return redirect(url_for('admin_panel'))

@app.route('/admin/register_samples', methods=['POST'])
 
def register_samples():
    data = request.json
    name = data['name']
    relation = data['relation']
    phone = data['phone']
    address = data['address']
    images = data['images'] # List of base64 strings
    
    # Check for existing person
    existing_person = persons.find_one({"name": name})
    
    if existing_person:
        # MERGE / UPDATE
        serial_no = existing_person['serial_no']
        
        # Ensure photo_dir exists
        if 'photo_dir' in existing_person and existing_person['photo_dir']:
            dir_name = existing_person['photo_dir'].split('/')[-1] # extraction
            save_dir = os.path.join(app.config['UPLOAD_FOLDER'], existing_person['photo_dir'])
        else:
            # Migration: Create missing dir for existing user
            clean_name = "".join([c for c in name if c.isalnum() or c in (' ', '-', '_')]).strip().replace(' ', '_')
            dir_name = f"{serial_no}_{clean_name}"
            save_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'known', dir_name)
    else:
        # CREATE NEW
        last = persons.find_one(sort=[("serial_no", -1)])
        serial_no = (last['serial_no'] + 1) if last else 1001
        
        clean_name = "".join([c for c in name if c.isalnum() or c in (' ', '-', '_')]).strip().replace(' ', '_')
        dir_name = f"{serial_no}_{clean_name}"
        save_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'known', dir_name)

    os.makedirs(save_dir, exist_ok=True)
    
    # Save Images
    existing_files_count = len(os.listdir(save_dir))
    first_image_path = None
    
    for idx, img_data in enumerate(images):
        if ',' in img_data: img_data = img_data.split(',')[1]
        try:
            img_bytes = base64.b64decode(img_data)
            # Use timestamp to avoid collisions
            ts = int(time.time() * 1000)
            filename = f"sample_{ts}_{idx}.jpg"
            filepath = os.path.join(save_dir, filename)
            with open(filepath, "wb") as f:
                 f.write(img_bytes)
            
            if idx == 0: 
                first_image_path = f"known/{dir_name}/{filename}"
        except Exception as e:
            print(f"Error saving image: {e}")

    # DB Update or Insert
    if existing_person:
        update_fields = {
            "relation": relation,
            "phone": phone,
            "address": address,
            "photo_dir": f"known/{dir_name}" # Ensure prompt update if missing
        }
        # Only update main photo if it was default or missing
        if existing_person.get('photo', 'default.jpg') == 'default.jpg' and first_image_path:
             update_fields['photo'] = first_image_path
             
        persons.update_one({"_id": existing_person['_id']}, {"$set": update_fields})
    else:
        persons.insert_one({
            "serial_no": serial_no,
            "name": name,
            "relation": relation,
            "phone": phone,
            "address": address,
            "photo": first_image_path if first_image_path else "default.jpg",
            "photo_dir": f"known/{dir_name}",
            "created_at": datetime.now()
        })
    
    
    # Validation / Optimization
    if existing_person:
        camera_manager.add_person_to_memory({
            "name": name,
            "relation": relation,
            "photo_dir": f"known/{dir_name}" 
        })
    else:
        # New Person
        camera_manager.add_person_to_memory({
            "name": name,
            "relation": relation,
            "photo_dir": f"known/{dir_name}"
        })

    # camera_manager.load_known_faces()
    return jsonify({"success": True})

@app.route('/admin/delete/<serial_no>')
 
def delete_person(serial_no):
    # Fetch name before delete to remove from memory
    p = persons.find_one({"serial_no": int(serial_no)})
    if p:
        name = p['name']
        persons.delete_one({"serial_no": int(serial_no)})
        
        # Incremental Remove
        camera_manager.remove_person_from_memory(name)
        # camera_manager.load_known_faces() # Reload
        
    return redirect(url_for('admin_panel'))

@app.route('/admin/update/<serial_no>', methods=['POST'])
 
def update_person(serial_no):
    data = {
        "name": request.form['name'],
        "relation": request.form['relation'],
        "phone": request.form['phone'],
        "address": request.form['address']
    }
    if 'photo' in request.files and request.files['photo'].filename:
        file = request.files['photo']
        photo_path = f"{serial_no}_{file.filename}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], photo_path))
        data["photo"] = photo_path
    
    persons.update_one({"serial_no": int(serial_no)}, {"$set": data})
    camera_manager.load_known_faces() # Reload
    return redirect(url_for('admin_panel'))

@app.route('/static/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
