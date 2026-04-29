import os
from datetime import datetime
import time
from bson.objectid import ObjectId


class EmergencyManager:
    def __init__(self, db):
        self.db = db
        self.contacts = db['emergency_contacts']
        self.users = db['users']
        self.active_alert = None

    def get_contacts(self, owner_email='unknown'):
        """Returns list of all emergency contacts for this owner."""
        return list(self.contacts.find({'owner_email': owner_email}))

    def add_contact(self, name, phone, relation, owner_email='unknown'):
        """Adds a new emergency contact."""
        contact = {
            "owner_email": owner_email,
            "name": name,
            "phone": phone,
            "relation": relation,
            "created_at": datetime.now()
        }
        self.contacts.insert_one(contact)
        return True

    def delete_contact(self, contact_id, owner_email='unknown'):
        """Deletes a contact by ID."""
        try:
            res = self.contacts.delete_one({"_id": ObjectId(contact_id), "owner_email": owner_email})
            if res.deleted_count > 0:
                return True
        except:
            pass

        try:
            res = self.contacts.delete_one({"_id": contact_id, "owner_email": owner_email})
            if res and hasattr(res, 'deleted_count'):
                return res.deleted_count > 0
            return True
        except Exception as e:
            print(f"Delete Error: {e}")
            return False

    # ------------------------------------------------------------------ #
    #  WhatsApp Notifications via Twilio                                   #
    # ------------------------------------------------------------------ #

    def send_whatsapp_alert(self, message, numbers):
        """
        Send a WhatsApp message to a list of phone numbers via Twilio.
        Numbers should be in E.164 format e.g. +923001234567
        """
        account_sid = os.environ.get('TWILIO_ACCOUNT_SID', '')
        auth_token = os.environ.get('TWILIO_AUTH_TOKEN', '')
        from_number = os.environ.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')

        if not account_sid or not auth_token:
            print("[WhatsApp] Twilio credentials not configured. Skipping WhatsApp notification.")
            return

        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            for number in numbers:
                if not number:
                    continue
                to = f"whatsapp:{number}" if not number.startswith('whatsapp:') else number
                try:
                    msg = client.messages.create(body=message, from_=from_number, to=to)
                    print(f"[WhatsApp] Alert sent to {number} | SID: {msg.sid}")
                except Exception as e:
                    print(f"[WhatsApp] Failed to send to {number}: {e}")
        except ImportError:
            print("[WhatsApp] Twilio not installed. Run: pip install twilio")
        except Exception as e:
            print(f"[WhatsApp] Error: {e}")

    def get_whatsapp_numbers_for_admin(self, admin_email):
        """
        Returns WhatsApp numbers of all managers and owners
        created by the given admin.
        """
        numbers = []
        try:
            sub_users = list(self.users.find({
                "created_by": admin_email,
                "role": {"$in": ["manager", "owner"]},
                "whatsapp_number": {"$ne": ""}
            }))
            for u in sub_users:
                wn = u.get('whatsapp_number', '').strip()
                if wn:
                    numbers.append(wn)
        except Exception as e:
            print(f"[WhatsApp] Could not fetch sub-user numbers: {e}")
        return numbers

    # ------------------------------------------------------------------ #
    #  Emergency Trigger                                                   #
    # ------------------------------------------------------------------ #

    def trigger_emergency(self, threat_type="Weapon", owner_email='unknown', suspect_name='Unknown'):
        """
        Triggers the alert state and sends WhatsApp messages to
        all managers and owners under this admin account.
        """
        # Debounce: don't re-trigger within 30 seconds
        if self.active_alert and (time.time() - self.active_alert['timestamp']) < 30:
            return self.active_alert

        # Find emergency contacts
        contact_list = self.get_contacts(owner_email)
        target = contact_list[0] if contact_list else {"name": "Emergency Services", "phone": "911"}

        self.active_alert = {
            "active": True,
            "threat": threat_type,
            "calling": target['name'],
            "phone": target['phone'],
            "timestamp": time.time(),
            "message": f"DIALING {target['name']} ({target['phone']})..."
        }

        print(f"!!! EMERGENCY: {threat_type} DETECTED (Suspect: {suspect_name}). DIALING {target['name']} !!!")

        # Send WhatsApp alerts asynchronously
        import threading
        numbers = self.get_whatsapp_numbers_for_admin(owner_email)
        if numbers:
            now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            wa_message = (
                f"🚨 *CRITICAL ALERT — Smart AutoSecure Vision*\n\n"
                f"*Suspect Detected:* {suspect_name}\n"
                f"*Threat Type:* {threat_type}\n"
                f"*Time:* {now_str}\n"
                f"*Account:* {owner_email}\n\n"
                f"Please review the camera footage immediately."
            )
            t = threading.Thread(target=self.send_whatsapp_alert, args=(wa_message, numbers), daemon=True)
            t.start()

        return self.active_alert

    def get_status(self):
        """Returns current alert status. Auto-clears after 15 seconds."""
        if self.active_alert:
            elapsed = time.time() - self.active_alert['timestamp']
            if elapsed > 5:
                self.active_alert['message'] = "CALL CONNECTED - ALERTING SUSPECT DETECTED"
            if elapsed > 15:
                self.active_alert = None
                return {"active": False}
            return self.active_alert
        return {"active": False}
