import os
import cv2
import threading
import base64
import time
import json
from datetime import datetime
from pymongo import MongoClient
from pymongo.errors import ConfigurationError, ConnectionFailure, ServerSelectionTimeoutError
from bson.objectid import ObjectId

from django.shortcuts import render, redirect
from django.http import HttpResponse, StreamingHttpResponse, JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.urls import reverse

# Import core modules (moved inside core app)
from .config import MONGODB_URI, DATABASE_NAME, COLLECTION_NAME
from .json_db import JsonDB
from .camera_manager import CameraManager, CameraStream
from .auth_manager import AuthManager

# Setup Global State
cameras = {}
main_camera_id = None
lock = threading.Lock()

# DB Config
# DB Config
import certifi

try:
    print("Attempting to connect to MongoDB Atlas...")
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())
    client.admin.command('ping') 
    print("Connected to MongoDB (Primary - Certifi)")
    db = client[DATABASE_NAME]
    persons = db[COLLECTION_NAME]
except (ConfigurationError, ConnectionFailure, ServerSelectionTimeoutError) as e:
    print(f"Warning: Primary connection failed ({e}). Trying Unverified SSL...")
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000, tls=True, tlsAllowInvalidCertificates=True)
        client.admin.command('ping')
        print("Connected to MongoDB (Atlas - Unverified SSL)")
        db = client[DATABASE_NAME]
        persons = db[COLLECTION_NAME]
    except Exception as e_ssl:
        print(f"Warning: SSL connection failed ({e_ssl}). Trying Localhost...")
        try:
             client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
             client.admin.command('ping')
             print("Connected to MongoDB (Localhost)")
             db = client[DATABASE_NAME]
             persons = db[COLLECTION_NAME]
        except Exception as e2:
             print(f"Info: Localhost MongoDB not available. Using Built-in Local Storage (json_db).")
             db = JsonDB("smart_vision") 
             persons = db[COLLECTION_NAME]

# App Config Shim
class AppConfig:
    def __init__(self):
        # Point to static/uploads in root
        self.config = {
            'UPLOAD_FOLDER': os.path.join(settings.BASE_DIR, 'static', 'uploads')
        }
    
    def __getitem__(self, key):
        return self.config[key]

app_shim = AppConfig()
os.makedirs(app_shim['UPLOAD_FOLDER'], exist_ok=True)

# Initialize Manager
camera_manager = CameraManager(app_shim.config, db)
auth_manager = AuthManager(db, app_shim.config)

# --- VIEWS ---

def index(request):
    return render(request, 'index.html')

# Streaming Generator
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
            
            ret, buffer = cv2.imencode('.jpg', frame)
            if ret:
                yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        
        time.sleep(0.03)

def video_feed(request, device_id):
    return StreamingHttpResponse(generate_frames(device_id), content_type='multipart/x-mixed-replace; boundary=frame')

def get_cameras(request):
    """
    Scans for available cameras (0-9) that are NOT already added to the system.
    Returns a list of available camera info.
    """
    available = []
    # Simple scan of first 5 indexes
    for i in range(5):
        # Skip if already added
        if i in cameras:
            continue
            
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                available.append({'id': i, 'label': f'Camera {i}'})
            cap.release()
    return JsonResponse(available, safe=False)

def get_added_cameras(request):
    active_list = []
    with lock:
        for cam_id, cam_data in cameras.items():
            active_list.append({
                'id': cam_id,
                'label': cam_data['label'],
                'main': cam_data.get('main', False)
            })
    return JsonResponse(active_list, safe=False)

@csrf_exempt
def add_camera(request):
    global main_camera_id
    if request.method == 'POST':
        data = json.loads(request.body)
        device_id = data['id']
        with lock:
            if device_id in cameras:
                if cameras[device_id]['stream'].grabbed:
                    if main_camera_id is None:
                         main_camera_id = device_id
                         cameras[device_id]['main'] = True
                    return JsonResponse({'success': True, 'main': main_camera_id, 'id': device_id, 'message': 'Camera already active'})
                else:
                    cameras[device_id]['stream'].stop()
                    del cameras[device_id]

            try:
                # Ensure source is integer for local webcams
                source = device_id
                if isinstance(source, str) and source.isdigit():
                    source = int(source)

                stream = CameraStream(source, data['label'])
                # Start stream first to establish connection
                stream.start()
                
                # Check for initial grab
                time.sleep(1.0) # slightly longer wait
                if not stream.grabbed:
                     stream.stop()
                     return JsonResponse({'success': False, 'message': 'Cannot open camera/stream - Check connection'})

                # Only assign callback if stream is valid
                stream.set_pipeline(
                    detector=camera_manager.detect_task,
                    drawer=camera_manager.draw_task
                )

                cameras[device_id] = {'stream': stream, 'label': data['label'], 'main': False}
                if main_camera_id is None:
                    main_camera_id = device_id
                    cameras[device_id]['main'] = True
            except Exception as e:
                print(f"Error adding camera: {e}")
                return JsonResponse({'success': False, 'message': str(e)})
        return JsonResponse({'success': True, 'main': main_camera_id, 'id': device_id})
    return JsonResponse({'error': 'POST required'}, status=400)

def set_main(request, device_id):
    global main_camera_id
    with lock:
        if device_id in cameras:
            if main_camera_id is not None:
                cameras[main_camera_id]['main'] = False
            main_camera_id = device_id
            cameras[device_id]['main'] = True
    return JsonResponse({'success': True})

@csrf_exempt
def set_roi(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        device_id = data.get('id')
        roi_data = data.get('roi')
        
        with lock:
            if camera_manager.set_camera_roi(device_id, roi_data, cameras):
                return JsonResponse({'success': True})
            else:
                return JsonResponse({'success': False, 'message': 'Camera not found'})
    return JsonResponse({'error': 'POST required'}, status=400)

def get_stats(request):
    return JsonResponse(camera_manager.get_stats())

def get_emergency_status(request):
    return JsonResponse(camera_manager.emergency.get_status())

@csrf_exempt
def simulate_threat(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        threat_type = data.get('type', 'Simulated Threat')
        
        camera_manager.log_event("System", f"Simulated: {threat_type}", "Medical/Test")
        alert = camera_manager.emergency.trigger_emergency(threat_type)
        
        return JsonResponse({'success': True, 'alert': alert})
    return JsonResponse({'error': 'POST required'}, status=400)

# --- AUTH ---
# Keeping custom auth logic but wrapping in Django views
# Assuming user session management via django sessions or simplified

def login_view(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        user, msg = auth_manager.login_user(email, password)
        if user:
            # Simplified Session Logic (Not using full Django Auth User Model to avoid migration complexity)
            request.session['user_id'] = str(user['_id'])
            request.session['user_email'] = email
            return redirect('index')
        return render(request, 'login.html', {'error': msg})
    return render(request, 'login.html')

def register_view(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        email = request.POST.get('email')
        password = request.POST.get('password')
        success, msg = auth_manager.register_user(name, email, password)
        if success:
            return redirect(reverse('verify_email') + f'?email={email}')
        return render(request, 'register.html', {'error': msg})
    return render(request, 'register.html')

def verify_email(request):
    email = request.GET.get('email') or request.POST.get('email')
    if request.method == 'POST':
        otp = request.POST.get('otp')
        success, msg = auth_manager.verify_email(email, otp)
        if success:
            return render(request, 'login.html', {'msg': "Verification Successful! Please login."})
        return render(request, 'verify_email.html', {'email': email, 'error': msg})
    return render(request, 'verify_email.html', {'email': email})

def forgot_password(request):
    if request.method == 'POST':
        step = request.POST.get('step')
        email = request.POST.get('email')
        
        if step == '1': # Request OTP
            success, msg = auth_manager.forgot_password_request(email)
            if success:
                return render(request, 'forgot_password.html', {'step': 2, 'email': email})
            return render(request, 'forgot_password.html', {'step': 1, 'error': msg})
            
        elif step == '2': # Reset
            otp = request.POST.get('otp')
            password = request.POST.get('password')
            success, msg = auth_manager.reset_password(email, otp, password)
            if success:
                return render(request, 'login.html', {'msg': "Password changed successfully."})
            return render(request, 'forgot_password.html', {'step': 2, 'email': email, 'error': msg})
            
    return render(request, 'forgot_password.html', {'step': 1})

def logout_view(request):
    request.session.flush()
    return redirect('login')


# --- ADMIN ---

def admin_panel(request):
    all_persons = list(persons.find().sort("serial_no", -1))
    return render(request, 'admin.html', {'persons': all_persons})

def contacts_panel(request):
    contacts = camera_manager.emergency.get_contacts()
    return render(request, 'contacts.html', {'contacts': contacts})

def logs_panel(request):
    logs = camera_manager.get_stats().get('suspect_logs', [])
    return render(request, 'logs.html', {'logs': logs})

@csrf_exempt
def add_contact(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        phone = request.POST.get('phone')
        relation = request.POST.get('relation')
        camera_manager.emergency.add_contact(name, phone, relation)
        return redirect('contacts_panel')

def delete_contact(request, contact_id):
    camera_manager.emergency.delete_contact(contact_id)
    return redirect('contacts_panel')

@csrf_exempt
def add_person(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        
        # Check for existing
        existing = persons.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
        if existing:
            return JsonResponse({"success": False, "message": f"Person with name '{name}' already exists!"})

        relation = request.POST.get('relation')
        phone = request.POST.get('phone')
        address = request.POST.get('address')
        
        last = persons.find_one(sort=[("serial_no", -1)])
        serial_no = (last['serial_no'] + 1) if last else 1001
        
        photo_path = "default.jpg"
        photo_bin = None
        if 'photo' in request.FILES:
            file = request.FILES['photo']
            if file.name:
                photo_path = f"{serial_no}_{file.name}"
                # Read binary content
                photo_bin = file.read()
                # Save manually to disk (optional but kept for compatibility)
                with open(os.path.join(app_shim['UPLOAD_FOLDER'], photo_path), 'wb+') as destination:
                    destination.write(photo_bin)
        
        persons.insert_one({
            "serial_no": serial_no,
            "name": name,
            "relation": relation,
            "phone": phone,
            "address": address,
            "photo": photo_path,
            "photo_bin": photo_bin, # Store binary
            "created_at": datetime.now()
        })
        
        new_person = {
            "name": name,
            "relation": relation,
            "photo": photo_path
        }
        camera_manager.add_person_to_memory(new_person)
        
        return JsonResponse({"success": True})
    return JsonResponse({'error': 'POST required'}, status=400)


@csrf_exempt
def delete_person(request, serial_no):
    p = persons.find_one({"serial_no": int(serial_no)})
    if p:
        name = p['name']
        persons.delete_one({"serial_no": int(serial_no)})
        camera_manager.remove_person_from_memory(name)
        return JsonResponse({"success": True})
    return JsonResponse({"success": False, "message": "Person not found"})

@csrf_exempt
def register_samples(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        name = data['name']
        relation = data['relation']
        phone = data['phone']
        address = data['address']
        images = data['images'] # List of base64 strings
        
        # Check for existing person
        existing_person = persons.find_one({"name": name})
        
        if existing_person:
            serial_no = existing_person['serial_no']
            if 'photo_dir' in existing_person and existing_person['photo_dir']:
                dir_name = existing_person['photo_dir'].split('/')[-1]
                save_dir = os.path.join(app_shim['UPLOAD_FOLDER'], existing_person['photo_dir'])
            else:
                clean_name = "".join([c for c in name if c.isalnum() or c in (' ', '-', '_')]).strip().replace(' ', '_')
                dir_name = f"{serial_no}_{clean_name}"
                save_dir = os.path.join(app_shim['UPLOAD_FOLDER'], 'known', dir_name)
        else:
            last = persons.find_one(sort=[("serial_no", -1)])
            serial_no = (last['serial_no'] + 1) if last else 1001
            
            clean_name = "".join([c for c in name if c.isalnum() or c in (' ', '-', '_')]).strip().replace(' ', '_')
            dir_name = f"{serial_no}_{clean_name}"
            save_dir = os.path.join(app_shim['UPLOAD_FOLDER'], 'known', dir_name)

        os.makedirs(save_dir, exist_ok=True)
        
        first_image_path = None
        first_image_bin = None
        
        for idx, img_data in enumerate(images):
            if ',' in img_data: img_data = img_data.split(',')[1]
            try:
                img_bytes = base64.b64decode(img_data)
                ts = int(time.time() * 1000)
                filename = f"sample_{ts}_{idx}.jpg"
                filepath = os.path.join(save_dir, filename)
                with open(filepath, "wb") as f:
                     f.write(img_bytes)
                
                if idx == 0: 
                    first_image_path = f"known/{dir_name}/{filename}"
                    first_image_bin = img_bytes # Keep for binary storage
            except Exception as e:
                print(f"Error saving image: {e}")

        if existing_person:
            update_fields = {
                "relation": relation,
                "phone": phone,
                "address": address,
                "photo_dir": f"known/{dir_name}"
            }
            if existing_person.get('photo', 'default.jpg') == 'default.jpg' and first_image_path:
                 update_fields['photo'] = first_image_path
                 update_fields['photo_bin'] = first_image_bin
                 
            persons.update_one({"_id": existing_person['_id']}, {"$set": update_fields})
        else:
            persons.insert_one({
                "serial_no": serial_no,
                "name": name,
                "relation": relation,
                "phone": phone,
                "address": address,
                "photo": first_image_path if first_image_path else "default.jpg",
                "photo_bin": first_image_bin if first_image_path else None,
                "photo_dir": f"known/{dir_name}",
                "created_at": datetime.now()
            })
        
        if existing_person:
            camera_manager.add_person_to_memory({
                "name": name,
                "relation": relation,
                "photo_dir": f"known/{dir_name}" 
            })
        else:
            camera_manager.add_person_to_memory({
                "name": name,
                "relation": relation,
                "photo_dir": f"known/{dir_name}"
            })

        return JsonResponse({"success": True})
    return JsonResponse({'error': 'POST required'}, status=400)

@csrf_exempt
def update_person(request, serial_no):
    if request.method == 'POST':
        data = {
            "name": request.POST.get('name'),
            "relation": request.POST.get('relation'),
            "phone": request.POST.get('phone'),
            "address": request.POST.get('address')
        }
        if 'photo' in request.FILES:
            file = request.FILES['photo']
            if file.name:
                photo_path = f"{serial_no}_{file.name}"
                with open(os.path.join(app_shim['UPLOAD_FOLDER'], photo_path), 'wb+') as dest:
                    for chunk in file.chunks():
                        dest.write(chunk)
                data["photo"] = photo_path
        
        persons.update_one({"serial_no": int(serial_no)}, {"$set": data})
        camera_manager.load_known_faces()
        return JsonResponse({"success": True})
    return JsonResponse({"success": False, "message": "POST required"}, status=400)

# --- API AUTH & ACTIONS ---
@csrf_exempt
def api_login(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')
        user, msg = auth_manager.login_user(email, password)
        if user:
            request.session['user_id'] = str(user.id)
            return JsonResponse({'success': True, 'user': {'name': user.name, 'email': user.email}})
        return JsonResponse({'success': False, 'message': msg})
    return JsonResponse({'error': 'POST required'}, status=400)

@csrf_exempt
def api_register(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        success, msg = auth_manager.register_user(data.get('name'), data.get('email'), data.get('password'))
        return JsonResponse({'success': success, 'message': msg})
    return JsonResponse({'error': 'POST required'}, status=400)

@csrf_exempt
def api_add_contact(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        success = camera_manager.emergency.add_contact(data.get('name'), data.get('phone'), data.get('relation'))
        return JsonResponse({'success': success})
    return JsonResponse({'error': 'POST required'}, status=400)

@csrf_exempt
def api_delete_contact(request, contact_id):
    if request.method == 'DELETE':
        success = camera_manager.emergency.delete_contact(contact_id)
        return JsonResponse({'success': success})
    return JsonResponse({'error': 'DELETE required'}, status=400)

# API Endpoints for React
def get_persons_api(request):
    all_persons = list(persons.find().sort("serial_no", -1))
    for p in all_persons:
        if '_id' in p:
            p['_id'] = str(p['_id'])
        
        # Handle binary image data if present
        if 'photo_bin' in p and isinstance(p['photo_bin'], bytes):
            b64 = base64.b64encode(p['photo_bin']).decode('utf-8')
            p['image'] = f"data:image/png;base64,{b64}"
            # Remove binary from response to save bandwidth
            del p['photo_bin']
            
    return JsonResponse(all_persons, safe=False)

def get_contacts_api(request):
    contacts = camera_manager.emergency.get_contacts()
    for c in contacts:
        if '_id' in c:
            c['_id'] = str(c['_id'])
    return JsonResponse(contacts, safe=False)

def get_logs_api(request):
    # Fetch from MongoDB instead of memory
    try:
        logs = list(db['suspect_logs'].find().sort("timestamp", -1).limit(100))
        for log in logs:
            if '_id' in log: log['_id'] = str(log['_id'])
    except:
        logs = []
    return JsonResponse(logs, safe=False)

@csrf_exempt
def api_delete_log(request, log_id):
    if request.method == 'DELETE':
        try:
            result = db['suspect_logs'].delete_one({'_id': ObjectId(log_id)})
            if result.deleted_count > 0:
                # Also remove from memory history if needed, but CameraManager usually re-reads or appends.
                # However, get_stats() returns history from memory. We might need to sync.
                # For now, just DB deletion. The frontend re-fetches or updates local state.
                return JsonResponse({'success': True})
            return JsonResponse({'success': False, 'message': 'Log not found'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})
    return JsonResponse({'error': 'DELETE required'}, status=400)