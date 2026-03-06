import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from pymongo import MongoClient
import random
import time
from .config import COLLECTION_NAME

class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data['_id'])
        self.email = user_data['email']
        self.name = user_data.get('name', 'User')
        self.is_verified = user_data.get('is_verified', False)

class AuthManager:
    def __init__(self, db, app_config=None):
        self.db = db
        self.users = db['users']
        self.config = app_config
        # Email Config (Using placeholders, user expects dummy or needs to provide)
        # Assuming user will provide or we use a console logger for now
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.smtp_user = "chatgptpro32123@gmail.com"
        self.smtp_pass = "wucgzztvrdnnzpmy" 

    def get_user_by_id(self, user_id):
        from bson.objectid import ObjectId
        try:
            data = self.users.find_one({"_id": ObjectId(user_id)})
            if data: return User(data)
        except: 
            # Fallback for JsonDB non-objectid
            data = self.users.find_one({"_id": user_id})
            if data: return User(data)
        return None

    def register_user(self, name, email, password):
        user_data = self.users.find_one({"email": email})
        otp = str(random.randint(100000, 999999))
        hashed_password = generate_password_hash(password)

        if user_data:
            if user_data.get('is_verified', False):
                return False, "Email already registered and verified."
            else:
                # Update existing unverified user
                self.users.update_one(
                    {"email": email},
                    {"$set": {
                        "name": name,
                        "password": hashed_password,
                        "otp": otp,
                        "otp_time": time.time()
                    }}
                )
        else:
            # Create new user
            self.users.insert_one({
                "name": name,
                "email": email,
                "password": hashed_password,
                "is_verified": False,
                "otp": otp,
                "otp_time": time.time(),
                "created_at": time.time()
            })
        
        self.send_otp_email(email, otp)
        return True, "Registration successful. Please verify your email."

    def login_user(self, email, password):
        user_data = self.users.find_one({"email": email})
        if not user_data:
            return None, "Email not found"
        
        if not check_password_hash(user_data['password'], password):
            return None, "Invalid password"
            
        if not user_data.get('is_verified', False):
            # Resend OTP if needed?
            return None, "Email not verified"
            
        return User(user_data), "Success"

    def verify_email(self, email, otp):
        user_data = self.users.find_one({"email": email})
        if not user_data: return False, "User not found"
        
        if user_data.get('otp') == otp:
            self.users.update_one({"email": email}, {"$set": {"is_verified": True, "otp": None}})
            return True, "Email verified!"
        return False, "Invalid OTP"

    def forgot_password_request(self, email):
        user_data = self.users.find_one({"email": email})
        if not user_data: return False, "Email not found"
        
        otp = str(random.randint(100000, 999999))
        self.users.update_one({"email": email}, {"$set": {"otp": otp, "otp_time": time.time()}})
        self.send_otp_email(email, otp, subject="Password Reset OTP")
        return True, "OTP sent to email"

    def reset_password(self, email, otp, new_password):
        user_data = self.users.find_one({"email": email})
        if not user_data: return False, "Error"
        
        if user_data.get('otp') == otp:
            hashed = generate_password_hash(new_password)
            self.users.update_one({"email": email}, {"$set": {"password": hashed, "otp": None}})
            return True, "Password reset successful"
        return False, "Invalid OTP"

    def login_google_user(self, email, name):
        user_data = self.users.find_one({"email": email})
        
        if not user_data:
            # Register new Google user implicitly
            user_id = self.users.insert_one({
                "name": name,
                "email": email,
                "password": "", # No password needed for Google Auth
                "is_verified": True, # Implicitly verified
                "otp": None,
                "created_at": time.time()
            }).inserted_id
            
            user_data = self.users.find_one({"_id": user_id})
            
        return User(user_data), "Success"

    def send_otp_email(self, to_email, otp, subject="Your Verification Code"):
        # For demonstration without valid SMTP creds, we PRINT the OTP
        print(f"\n[EMAIL MOCK] To: {to_email} | Subject: {subject} | Body: Your OTP is {otp}\n")
        
        try:
            msg = MIMEMultipart()
            msg['From'] = f"Smart AutoSecure Vision <{self.smtp_user}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            body = (
                f"Hello,\n\n"
                f"Thank you for using Smart AutoSecure Vision.\n\n"
                f"Your security code is: {otp}\n\n"
                f"This code is valid for 10 minutes. Please do not share it with anyone.\n\n"
                f"Best regards,\n"
                f"Smart AutoSecure Vision Team"
            )
            msg.attach(MIMEText(body, 'plain'))
            
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.smtp_user, self.smtp_pass)
            text = msg.as_string()
            server.sendmail(self.smtp_user, to_email, text)
            server.quit()
        except Exception as e:
            print(f"SMTP Error: {e}")
