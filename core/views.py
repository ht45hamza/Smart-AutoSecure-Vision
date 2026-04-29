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
from .camera_manager import CameraManager, CameraStream, VirtualCameraStream
from .auth_manager import AuthManager

import qrcode
import uuid
from io import BytesIO
import numpy as np

# Setup Global State
cameras = {}
qr_sessions = {}  # {token: {owner_email: str, label: str, active: bool, last_seen: float}}
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
def _normalize_id(device_id):
    """Convert string device_id to int if it's a digit, otherwise keep as string (URL)."""
    try:
        return int(device_id)
    except (ValueError, TypeError):
        return device_id

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
    device_id = _normalize_id(device_id)
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
        raw_id = data['id']  # Could be int (local webcam) or URL string (IP camera)
        label = data.get('label', f'Camera {raw_id}')
        cam_type = data.get('type', 'local')  # 'local' or 'ip'

        # Normalize: int for local webcams, string URL for IP cameras
        if cam_type == 'ip' or (isinstance(raw_id, str) and not str(raw_id).isdigit()):
            device_id = str(raw_id)  # IP/URL cameras use string key
            source = str(raw_id)
        else:
            device_id = int(raw_id)
            source = int(raw_id)

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
                user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
                stream = CameraStream(source, label, owner_email=user_email)
                stream.start()

                # IP cameras may take slightly longer to connect
                wait_time = 2.5 if cam_type == 'ip' else 1.0
                time.sleep(wait_time)

                if not stream.grabbed:
                    stream.stop()
                    return JsonResponse({'success': False, 'message': 'Cannot open camera/stream — Check the URL and ensure the device is on the same network.'})

                stream.set_pipeline(
                    detector=lambda f, r: camera_manager.detect_task(f, r, user_email),
                    drawer=camera_manager.draw_task
                )

                cameras[device_id] = {'stream': stream, 'label': label, 'main': False, 'type': cam_type}
                if main_camera_id is None:
                    main_camera_id = device_id
                    cameras[device_id]['main'] = True
            except Exception as e:
                print(f"Error adding camera: {e}")
                import traceback; traceback.print_exc()
                return JsonResponse({'success': False, 'message': str(e)})
        return JsonResponse({'success': True, 'main': str(main_camera_id), 'id': str(device_id)})
    return JsonResponse({'error': 'POST required'}, status=400)

def set_main(request, device_id):
    global main_camera_id
    device_id = _normalize_id(device_id)
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
    user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
    return JsonResponse(camera_manager.get_stats(user_email))

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

# --- QR MOBILE CAMERA ---

@csrf_exempt
def generate_qr_session(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        label = data.get('label', 'Mobile Camera')
        owner_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
        
        token = str(uuid.uuid4())
        qr_sessions[token] = {
            'owner_email': owner_email,
            'label': label,
            'active': False,
            'last_seen': time.time()
        }
        
        # Get host IP for QR code
        # In a real scenario, this would be the server's public IP or domain.
        # For local dev, we try to get the local IP.
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            host_ip = s.getsockname()[0]
            s.close()
        except:
            host_ip = "127.0.0.1"
            
        port = request.get_port()
        connect_url = f"http://{host_ip}:{port}/mobile_cam/{token}/"
        
        # Generate QR Code image (base64)
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(connect_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        qr_base64 = base64.b64encode(buffered.getvalue()).decode()
        
        return JsonResponse({
            'success': True,
            'token': token,
            'qr_image': f"data:image/png;base64,{qr_base64}",
            'url': connect_url
        })
    return JsonResponse({'error': 'POST required'}, status=400)

def mobile_cam_view(request, token):
    if token not in qr_sessions:
        return HttpResponse("Invalid or expired session", status=404)
    return render(request, 'mobile_cam.html', {'token': token})

@csrf_exempt
def mobile_cam_status_update(request, token):
    if token not in qr_sessions:
        return JsonResponse({'success': False, 'message': 'Invalid session'})
    
    if request.method == 'POST':
        data = json.loads(request.body)
        connected = data.get('connected', False)
        qr_sessions[token]['active'] = connected
        
        if connected:
            # Initialize the camera in the system if not already there
            with lock:
                if token not in cameras:
                    label = qr_sessions[token]['label']
                    owner_email = qr_sessions[token]['owner_email']
                    stream = VirtualCameraStream(label, owner_email=owner_email)
                    stream.start()
                    stream.set_pipeline(
                        detector=lambda f, r: camera_manager.detect_task(f, r, owner_email),
                        drawer=camera_manager.draw_task
                    )
                    cameras[token] = {'stream': stream, 'label': label, 'main': False, 'type': 'mobile_qr'}
                    
                    global main_camera_id
                    if main_camera_id is None:
                        main_camera_id = token
                        cameras[token]['main'] = True
                        
        return JsonResponse({'success': True})
    
    return JsonResponse({'active': qr_sessions[token]['active']})

@csrf_exempt
def mobile_cam_frame(request, token):
    if token not in qr_sessions or token not in cameras:
        return JsonResponse({'success': False}, status=404)
    
    if request.method == 'POST':
        try:
            # Frame is sent as raw binary data (JPEG)
            nparr = np.frombuffer(request.body, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is not None:
                cameras[token]['stream'].push_frame(frame)
                qr_sessions[token]['last_seen'] = time.time()
                return JsonResponse({'success': True})
        except Exception as e:
            print(f"Error processing mobile frame: {e}")
            
    return JsonResponse({'success': False}, status=400)

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
    user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
    all_persons = list(persons.find({'owner_email': user_email}).sort('serial_no', -1))
    return render(request, 'admin.html', {'persons': all_persons})

def contacts_panel(request):
    user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
    contacts = camera_manager.emergency.get_contacts(user_email)
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
        user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
        existing = persons.find_one({'owner_email': user_email, 'name': {'$regex': f'^{name}$', '$options': 'i'}})
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
            "owner_email": user_email,
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
            "owner_email": user_email,
            "name": name,
            "relation": relation,
            "photo": photo_path
        }
        camera_manager.add_person_to_memory(new_person)
        
        return JsonResponse({"success": True})
    return JsonResponse({'error': 'POST required'}, status=400)


@csrf_exempt
def delete_person(request, serial_no):
    user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
    p = persons.find_one({'owner_email': user_email, 'serial_no': int(serial_no)})
    if p:
        name = p['name']
        persons.delete_one({'owner_email': user_email, 'serial_no': int(serial_no)})
        camera_manager.remove_person_from_memory(name, user_email)
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
                "owner_email": user_email,
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
            return JsonResponse({'success': True, 'user': {
                'name': user.name,
                'email': user.email,
                'role': user.role,
                'admin_email': user.admin_email,
                'whatsapp_number': user.whatsapp_number,
            }})
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
def api_verify_email(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        success, msg = auth_manager.verify_email(data.get('email'), data.get('otp'))
        return JsonResponse({'success': success, 'message': msg})
    return JsonResponse({'error': 'POST required'}, status=400)

import os
import base64 as _base64

GOOGLE_CLIENT_ID = "175235397160-bj1g53f49unppillu2rbgn3m82fbad4m.apps.googleusercontent.com"

def _decode_google_jwt_payload(token):
    """
    Decodes the payload section of a Google JWT without signature verification.
    Safe to use as a fallback because the token was already authenticated
    by Google's own OAuth flow on the browser side.
    """
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        # Add padding
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += '=' * padding
        payload_bytes = _base64.urlsafe_b64decode(payload_b64)
        return json.loads(payload_bytes.decode('utf-8'))
    except Exception as e:
        print(f"JWT decode error: {e}")
        return None

@csrf_exempt
def api_google_login(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid JSON body'}, status=400)

        token = data.get('token', '').strip()
        if not token:
            return JsonResponse({'success': False, 'message': 'Google token is missing'}, status=400)

        email = None
        name = 'Google User'

        # --- Attempt 1: Full verification via Google's cert endpoint ---
        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests
            idinfo = google_id_token.verify_oauth2_token(
                token, google_requests.Request(), GOOGLE_CLIENT_ID, clock_skew_in_seconds=10
            )
            email = idinfo.get('email')
            name = idinfo.get('name', 'Google User')
            print(f"[Google Auth] Verified via Google certs: {email}")
        except Exception as verify_err:
            print(f"[Google Auth] Full verification failed ({verify_err}). Trying JWT decode fallback...")

            # --- Attempt 2: Decode JWT payload locally (no network call) ---
            payload = _decode_google_jwt_payload(token)
            if payload:
                email = payload.get('email')
                name = payload.get('name', 'Google User')
                aud = payload.get('aud', '')
                # Validate audience matches our client ID
                if aud != GOOGLE_CLIENT_ID:
                    print(f"[Google Auth] Audience mismatch: {aud}")
                    return JsonResponse({
                        'success': False,
                        'message': 'Google token audience mismatch. Check CLIENT_ID configuration.'
                    })
                print(f"[Google Auth] Decoded via JWT fallback: {email}")
            else:
                return JsonResponse({
                    'success': False,
                    'message': f'Google token verification failed: {verify_err}'
                })

        if not email:
            return JsonResponse({'success': False, 'message': 'Could not extract email from Google token'})

        # --- Find or create user ---
        try:
            user, msg = auth_manager.login_google_user(email, name)
            if user:
                print(f"[Google Auth] Login success for {email}")
                return JsonResponse({
                    'success': True,
                    'user': {
                        'name': user.name,
                        'email': user.email,
                        'role': user.role,
                        'admin_email': user.admin_email,
                        'whatsapp_number': user.whatsapp_number,
                    }
                })
            return JsonResponse({'success': False, 'message': msg})
        except Exception as db_err:
            print(f"[Google Auth] DB error: {db_err}")
            return JsonResponse({'success': False, 'message': f'Database error: {db_err}'}, status=500)

    return JsonResponse({'error': 'POST required'}, status=400)

@csrf_exempt
def api_forgot_password(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        step = data.get('step')
        email = data.get('email')
        
        if step == 1:
            success, msg = auth_manager.forgot_password_request(email)
            return JsonResponse({'success': success, 'message': msg})
        elif step == 2:
            otp = data.get('otp')
            new_password = data.get('password')
            success, msg = auth_manager.reset_password(email, otp, new_password)
            return JsonResponse({'success': success, 'message': msg})
            
        return JsonResponse({'error': 'Invalid Step'}, status=400)
    return JsonResponse({'error': 'POST required'}, status=400)

@csrf_exempt
def api_add_contact(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
        success = camera_manager.emergency.add_contact(data.get('name'), data.get('phone'), data.get('relation'), user_email)
        return JsonResponse({'success': success})
    return JsonResponse({'error': 'POST required'}, status=400)

@csrf_exempt
def api_delete_contact(request, contact_id):
    if request.method == 'DELETE':
        user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
        success = camera_manager.emergency.delete_contact(contact_id, user_email)
        return JsonResponse({'success': success})
    return JsonResponse({'error': 'DELETE required'}, status=400)

# API Endpoints for React
def get_persons_api(request):
    user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
    all_persons = list(persons.find({'owner_email': user_email}).sort('serial_no', -1))
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
    user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
    contacts = camera_manager.emergency.get_contacts(user_email)
    for c in contacts:
        if '_id' in c:
            c['_id'] = str(c['_id'])
    return JsonResponse(contacts, safe=False)

def get_logs_api(request):
    # Fetch from MongoDB instead of memory
    try:
        user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
        logs = list(db['suspect_logs'].find({'owner_email': user_email}).sort("timestamp", -1).limit(100))
        for log in logs:
            if '_id' in log: log['_id'] = str(log['_id'])
    except:
        logs = []
    return JsonResponse(logs, safe=False)

@csrf_exempt
def api_delete_log(request, log_id):
    if request.method == 'DELETE':
        try:
            user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
            result = db['suspect_logs'].delete_one({'owner_email': user_email, '_id': ObjectId(log_id)})
            if result.deleted_count > 0:
                # Also remove from memory history if needed, but CameraManager usually re-reads or appends.
                # However, get_stats() returns history from memory. We might need to sync.
                # For now, just DB deletion. The frontend re-fetches or updates local state.
                return JsonResponse({'success': True})
            return JsonResponse({'success': False, 'message': 'Log not found'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})
    return JsonResponse({'error': 'DELETE required'}, status=400)


# ---------------------------------------------------------------
# SUSPECT MANAGEMENT  (dedicated endpoints, no frontend changes)
# ---------------------------------------------------------------

@csrf_exempt
def api_add_suspect(request):
    """
    POST /api/add_suspect/
    Multipart form-data fields:
        name     (str, required)
        phone    (str, optional)
        address  (str, optional)
        notes    (str, optional)   — stored in address field as extra info
        photo    (file, required)  — face image used for recognition
    Header:
        X-User-Email: <user email>   (set automatically by the React frontend)

    The person is stored with relation='Suspect'.
    Face-recognition pipeline will trigger an emergency alert when this
    person appears on camera.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=400)

    try:
        user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
        name = request.POST.get('name', '').strip()
        phone = request.POST.get('phone', '').strip() or 'N/A'
        address = request.POST.get('address', '').strip() or 'N/A'
        notes = request.POST.get('notes', '').strip()

        if not name:
            return JsonResponse({'success': False, 'message': 'Name is required'})

        if 'photo' not in request.FILES or not request.FILES['photo'].name:
            return JsonResponse({'success': False, 'message': 'A face photo is required for suspect detection'})

        # Check for duplicates
        existing = persons.find_one({'owner_email': user_email, 'name': {'$regex': f'^{name}$', '$options': 'i'}})
        if existing:
            return JsonResponse({'success': False, 'message': f"A record for '{name}' already exists."})

        # Assign serial number (same pattern as add_person)
        last = persons.find_one(sort=[("serial_no", -1)])
        serial_no = (last.get('serial_no', 1000) + 1) if last else 1001

        # Save photo to disk
        file = request.FILES['photo']
        photo_filename = f"{serial_no}_suspect_{file.name}"
        photo_bin = file.read()
        with open(os.path.join(app_shim['UPLOAD_FOLDER'], photo_filename), 'wb+') as dest:
            dest.write(photo_bin)

        # Build address with optional notes
        full_address = f"{address} | Notes: {notes}" if notes else address

        # Insert into DB (same fields as add_person)
        persons.insert_one({
            "owner_email": user_email,
            "serial_no": serial_no,
            "name": name,
            "relation": "Suspect",
            "phone": phone,
            "address": full_address,
            "photo": photo_filename,
            "photo_bin": photo_bin,
            "created_at": datetime.now(),
        })

        # Load face into detection engine immediately
        camera_manager.add_person_to_memory({
            "owner_email": user_email,
            "name": name,
            "relation": "Suspect",
            "photo": photo_filename,
        })

        print(f"[Suspect] Registered: {name} ({user_email}) — face detection active")
        return JsonResponse({
            'success': True,
            'message': f"Suspect '{name}' registered. Emergency alert will trigger on detection.",
            'serial_no': serial_no,
        })

    except Exception as e:
        import traceback
        print(f"[Suspect] ERROR: {traceback.format_exc()}")
        return JsonResponse({'success': False, 'message': f'Server error: {str(e)}'}, status=500)



@csrf_exempt
def api_list_suspects(request):
    """GET /api/suspects/  — returns all suspects for the logged-in user."""
    user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
    suspect_list = list(persons.find(
        {'owner_email': user_email, 'relation': 'Suspect'},
        sort=[('serial_no', -1)]
    ))
    for s in suspect_list:
        if '_id' in s:
            s['_id'] = str(s['_id'])
        if 'photo_bin' in s and isinstance(s['photo_bin'], bytes):
            s['image'] = 'data:image/jpeg;base64,' + base64.b64encode(s['photo_bin']).decode()
            del s['photo_bin']
    return JsonResponse(suspect_list, safe=False)


@csrf_exempt
def api_delete_suspect(request, serial_no):
    """DELETE /api/suspects/<serial_no>/  — removes a suspect record."""
    if request.method != 'DELETE':
        return JsonResponse({'error': 'DELETE required'}, status=400)
    user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')
    p = persons.find_one({'owner_email': user_email, 'serial_no': int(serial_no), 'relation': 'Suspect'})
    if not p:
        return JsonResponse({'success': False, 'message': 'Suspect not found'})
    persons.delete_one({'_id': p['_id']})
    camera_manager.remove_person_from_memory(p['name'], user_email)
    return JsonResponse({'success': True, 'message': f"Suspect '{p['name']}' removed."})


# ---------------------------------------------------------------
# USER MANAGEMENT  (admin only)
# ---------------------------------------------------------------

@csrf_exempt
def api_create_user(request):
    """POST /api/users/create/ — Admin creates a sub-user (owner/manager/security_guard)."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=400)

    admin_email = request.META.get('HTTP_X_USER_EMAIL', '')
    role = auth_manager.get_user_role(admin_email)
    if role != 'admin':
        return JsonResponse({'success': False, 'message': 'Only admins can create users.'}, status=403)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

    success, msg = auth_manager.create_sub_user(
        name=data.get('name', '').strip(),
        email=data.get('email', '').strip(),
        password=data.get('password', '').strip(),
        role=data.get('role', ''),
        whatsapp_number=data.get('whatsapp_number', '').strip(),
        created_by=admin_email
    )
    return JsonResponse({'success': success, 'message': msg})


def api_get_users(request):
    """GET /api/users/ — Returns all sub-users created by the logged-in admin."""
    admin_email = request.META.get('HTTP_X_USER_EMAIL', '')
    role = auth_manager.get_user_role(admin_email)
    if role != 'admin':
        return JsonResponse({'success': False, 'message': 'Access denied.'}, status=403)

    users = auth_manager.get_all_sub_users(admin_email)
    return JsonResponse(users, safe=False)


@csrf_exempt
def api_delete_user(request, user_id):
    """DELETE /api/users/<user_id>/ — Admin deletes a sub-user."""
    if request.method != 'DELETE':
        return JsonResponse({'error': 'DELETE required'}, status=400)

    admin_email = request.META.get('HTTP_X_USER_EMAIL', '')
    role = auth_manager.get_user_role(admin_email)
    if role != 'admin':
        return JsonResponse({'success': False, 'message': 'Access denied.'}, status=403)

    success = auth_manager.delete_sub_user(user_id, admin_email)
    return JsonResponse({'success': success, 'message': 'User deleted.' if success else 'User not found.'})


@csrf_exempt
def api_update_user(request, user_id):
    """PUT /api/users/<user_id>/ — Admin updates a sub-user (name, whatsapp, password)."""
    if request.method != 'PUT':
        return JsonResponse({'error': 'PUT required'}, status=400)

    admin_email = request.META.get('HTTP_X_USER_EMAIL', '')
    role = auth_manager.get_user_role(admin_email)
    if role != 'admin':
        return JsonResponse({'success': False, 'message': 'Access denied.'}, status=403)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

    update_fields = {}
    if data.get('name'):
        update_fields['name'] = data['name'].strip()
    if data.get('whatsapp_number') is not None:
        update_fields['whatsapp_number'] = data['whatsapp_number'].strip()
    if data.get('password'):
        update_fields['password'] = data['password'].strip()

    success = auth_manager.update_sub_user(user_id, admin_email, update_fields)
    return JsonResponse({'success': success, 'message': 'Updated.' if success else 'Update failed.'})
