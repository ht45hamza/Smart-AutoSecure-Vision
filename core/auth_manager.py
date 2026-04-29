import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import MongoClient
import random
import time
from dotenv import load_dotenv
load_dotenv()
from .config import COLLECTION_NAME


# Plain Python User class — no Flask-Login dependency
class User:
    def __init__(self, user_data):
        self.id = str(user_data['_id'])
        self.email = user_data['email']
        self.name = user_data.get('name', 'User')
        self.is_verified = user_data.get('is_verified', False)
        self.role = user_data.get('role', 'admin')  # admin | manager | owner | security_guard
        self.whatsapp_number = user_data.get('whatsapp_number', '')
        # admin_email: for sub-users points to creator; for admins, points to self
        created_by = user_data.get('created_by', '')
        if self.role in ('owner', 'manager', 'security_guard') and created_by:
            self.admin_email = created_by
        else:
            self.admin_email = self.email

    def is_authenticated(self):
        return True

    def is_active(self):
        return True

    def is_anonymous(self):
        return False

    def get_id(self):
        return self.id


class AuthManager:
    def __init__(self, db, app_config=None):
        self.db = db
        self.users = db['users']
        self.config = app_config
        # Email Config
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.smtp_user = os.environ.get('SMTP_USER', 'chatgptpro32123@gmail.com')
        self.smtp_pass = os.environ.get('SMTP_PASS', 'wucgzztvrdnnzpmy')

    def get_user_by_id(self, user_id):
        from bson.objectid import ObjectId
        try:
            data = self.users.find_one({"_id": ObjectId(user_id)})
            if data:
                return User(data)
        except:
            data = self.users.find_one({"_id": user_id})
            if data:
                return User(data)
        return None

    def get_user_role(self, email):
        """Get the role of a user. Defaults to 'admin' for legacy/unset users."""
        user_data = self.users.find_one({"email": email})
        if not user_data:
            return 'admin'
        return user_data.get('role', 'admin')

    # ------------------------------------------------------------------ #
    #  Sub-user management (admin only)                                    #
    # ------------------------------------------------------------------ #

    def create_sub_user(self, name, email, password, role, whatsapp_number='', created_by=''):
        """Admin creates a sub-user with a specific role."""
        existing = self.users.find_one({"email": email})
        if existing:
            return False, "Email already registered."

        valid_roles = ['owner', 'manager', 'security_guard']
        if role not in valid_roles:
            return False, f"Invalid role. Must be one of: {', '.join(valid_roles)}"

        hashed_password = generate_password_hash(password)
        self.users.insert_one({
            "name": name,
            "email": email,
            "password": hashed_password,
            "role": role,
            "whatsapp_number": whatsapp_number,
            "is_verified": True,   # Admin-created users are pre-verified
            "created_by": created_by,
            "otp": None,
            "created_at": time.time()
        })
        return True, f"User '{name}' created successfully with role '{role}'."

    def get_all_sub_users(self, created_by=''):
        """Return all sub-users created by the given admin."""
        users = list(self.users.find({"created_by": created_by}))
        for u in users:
            u['_id'] = str(u['_id'])
            u.pop('password', None)
            u.pop('otp', None)
        return users

    def delete_sub_user(self, user_id, admin_email=''):
        """Delete a sub-user – only the creating admin can delete."""
        from bson.objectid import ObjectId
        try:
            result = self.users.delete_one({"_id": ObjectId(user_id), "created_by": admin_email})
            return result.deleted_count > 0
        except Exception as e:
            print(f"[AuthManager] delete_sub_user error: {e}")
            return False

    def update_sub_user(self, user_id, admin_email, update_fields):
        """Update sub-user info (name, whatsapp, password)."""
        from bson.objectid import ObjectId
        try:
            if 'password' in update_fields and update_fields['password']:
                update_fields['password'] = generate_password_hash(update_fields['password'])
            elif 'password' in update_fields:
                del update_fields['password']
            result = self.users.update_one(
                {"_id": ObjectId(user_id), "created_by": admin_email},
                {"$set": update_fields}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"[AuthManager] update_sub_user error: {e}")
            return False

    # ------------------------------------------------------------------ #
    #  Standard auth                                                       #
    # ------------------------------------------------------------------ #

    def register_user(self, name, email, password):
        user_data = self.users.find_one({"email": email})
        otp = str(random.randint(100000, 999999))
        hashed_password = generate_password_hash(password)

        if user_data:
            if user_data.get('is_verified', False):
                return False, "Email already registered and verified."
            else:
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
            self.users.insert_one({
                "name": name,
                "email": email,
                "password": hashed_password,
                "role": "admin",   # Self-registered users become admins
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

        if not check_password_hash(user_data.get('password', ''), password):
            return None, "Invalid password"

        if not user_data.get('is_verified', False):
            return None, "Email not verified. Please check your inbox for the OTP."

        return User(user_data), "Success"

    def verify_email(self, email, otp):
        user_data = self.users.find_one({"email": email})
        if not user_data:
            return False, "User not found"

        if user_data.get('otp') == otp:
            self.users.update_one({"email": email}, {"$set": {"is_verified": True, "otp": None}})
            return True, "Email verified!"
        return False, "Invalid OTP"

    def forgot_password_request(self, email):
        user_data = self.users.find_one({"email": email})
        if not user_data:
            return False, "Email not found"

        otp = str(random.randint(100000, 999999))
        self.users.update_one({"email": email}, {"$set": {"otp": otp, "otp_time": time.time()}})
        self.send_otp_email(email, otp, subject="Password Reset OTP")
        return True, "OTP sent to email"

    def reset_password(self, email, otp, new_password):
        user_data = self.users.find_one({"email": email})
        if not user_data:
            return False, "Error"

        if user_data.get('otp') == otp:
            hashed = generate_password_hash(new_password)
            self.users.update_one({"email": email}, {"$set": {"password": hashed, "otp": None}})
            return True, "Password reset successful"
        return False, "Invalid OTP"

    def login_google_user(self, email, name):
        """Finds or creates a user for Google OAuth. Google users are auto-verified."""
        user_data = self.users.find_one({"email": email})

        if not user_data:
            user_id = self.users.insert_one({
                "name": name,
                "email": email,
                "password": "",
                "is_verified": True,
                "role": "admin",   # Google sign-in users are admins
                "auth_provider": "google",
                "otp": None,
                "created_at": time.time()
            }).inserted_id
            user_data = self.users.find_one({"_id": user_id})
        else:
            self.users.update_one(
                {"email": email},
                {"$set": {"name": name, "is_verified": True, "auth_provider": "google"}}
            )
            user_data = self.users.find_one({"email": email})

        return User(user_data), "Success"

    def send_otp_email(self, to_email, otp, subject="Your Verification Code"):
        print(f"\n[EMAIL] To: {to_email} | Subject: {subject} | OTP: {otp}\n")
        try:
            msg = MIMEMultipart()
            msg['From'] = f"Smart AutoSecure Vision <{self.smtp_user}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            body = (
                f"Hello,\n\n"
                f"Thank you for using Smart AutoSecure Vision.\n\n"
                f"Your security code is: {otp}\n\n"
                f"This code is valid for 10 minutes. Please do not share it.\n\n"
                f"Best regards,\n"
                f"Smart AutoSecure Vision Team"
            )
            msg.attach(MIMEText(body, 'plain'))

            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.smtp_user, self.smtp_pass)
            server.sendmail(self.smtp_user, to_email, msg.as_string())
            server.quit()
            print(f"[EMAIL] Sent successfully to {to_email}")
        except Exception as e:
            print(f"[EMAIL] SMTP Error (OTP printed above as fallback): {e}")
