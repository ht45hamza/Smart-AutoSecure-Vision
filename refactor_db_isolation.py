import re

def refactor_views():
    with open('d:/FINAL-PROJECT/smart autosecure vision/core/views.py', 'r', encoding='utf-8') as f:
        code = f.read()

    # get_persons_api
    code = code.replace(
        'all_persons = list(persons.find().sort("serial_no", -1))',
        "user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')\n    all_persons = list(persons.find({'owner_email': user_email}).sort('serial_no', -1))"
    )

    # get_contacts_api
    code = code.replace(
        'contacts = camera_manager.emergency.get_contacts()',
        "user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')\n    contacts = camera_manager.emergency.get_contacts(user_email)"
    )

    # get_logs_api
    code = code.replace(
        "logs = list(db['suspect_logs'].find().sort(\"timestamp\", -1).limit(100))",
        "user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')\n        logs = list(db['suspect_logs'].find({'owner_email': user_email}).sort(\"timestamp\", -1).limit(100))"
    )

    # add_camera
    code = code.replace(
        "stream = CameraStream(source, data['label'])",
        "user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')\n                stream = CameraStream(source, data['label'], owner_email=user_email)"
    )
    code = code.replace(
        "detector=camera_manager.detect_task,",
        "detector=lambda f, r: camera_manager.detect_task(f, r, user_email),"
    )

    # api_add_contact
    code = code.replace(
        "success = camera_manager.emergency.add_contact(data.get('name'), data.get('phone'), data.get('relation'))",
        "user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')\n        success = camera_manager.emergency.add_contact(data.get('name'), data.get('phone'), data.get('relation'), user_email)"
    )

    # api_delete_contact
    code = code.replace(
        "success = camera_manager.emergency.delete_contact(contact_id)",
        "user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')\n        success = camera_manager.emergency.delete_contact(contact_id, user_email)"
    )

    # add_person
    code = code.replace(
        'existing = persons.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})',
        "user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')\n        existing = persons.find_one({'owner_email': user_email, 'name': {'$regex': f'^{name}$', '$options': 'i'}})"
    )
    code = code.replace(
        '"serial_no": serial_no,',
        '"owner_email": user_email,\n            "serial_no": serial_no,'
    )
    code = code.replace(
        'new_person = {\n            "name": name,',
        "new_person = {\n            \"owner_email\": user_email,\n            \"name\": name,"
    )

    # update_person
    code = code.replace(
        'p = persons.find_one({"serial_no": int(serial_no)})',
        "user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')\n    p = persons.find_one({'owner_email': user_email, 'serial_no': int(serial_no)})"
    )

    # delete_person
    code = code.replace(
        'p = persons.find_one({"serial_no": int(serial_no)})',
        "user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')\n    p = persons.find_one({'owner_email': user_email, 'serial_no': int(serial_no)})"
    )
    code = code.replace(
        'persons.delete_one({"serial_no": int(serial_no)})',
        "persons.delete_one({'owner_email': user_email, 'serial_no': int(serial_no)})"
    )
    code = code.replace(
        'camera_manager.remove_person_from_memory(name)',
        'camera_manager.remove_person_from_memory(name, user_email)'
    )

    # api_delete_log
    code = code.replace(
        "result = db['suspect_logs'].delete_one({'_id': ObjectId(log_id)})",
        "user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')\n            result = db['suspect_logs'].delete_one({'owner_email': user_email, '_id': ObjectId(log_id)})"
    )

    # get_stats
    code = code.replace(
        "return JsonResponse(camera_manager.get_stats())",
        "user_email = request.META.get('HTTP_X_USER_EMAIL', 'unknown')\n    return JsonResponse(camera_manager.get_stats(user_email))"
    )

    with open('d:/FINAL-PROJECT/smart autosecure vision/core/views.py', 'w', encoding='utf-8') as f:
        f.write(code)

def refactor_emergency():
    with open('d:/FINAL-PROJECT/smart autosecure vision/core/emergency_manager.py', 'r', encoding='utf-8') as f:
        code = f.read()

    code = code.replace(
        "def get_contacts(self):",
        "def get_contacts(self, owner_email='unknown'):"
    )
    code = code.replace(
        "return list(self.contacts.find())",
        "return list(self.contacts.find({'owner_email': owner_email}))"
    )

    code = code.replace(
        "def add_contact(self, name, phone, relation):",
        "def add_contact(self, name, phone, relation, owner_email='unknown'):"
    )
    code = code.replace(
        '"name": name,',
        '"owner_email": owner_email,\n            "name": name,'
    )

    code = code.replace(
        "def delete_contact(self, contact_id):",
        "def delete_contact(self, contact_id, owner_email='unknown'):"
    )
    code = code.replace(
        'res = self.contacts.delete_one({"_id": ObjectId(contact_id)})',
        'res = self.contacts.delete_one({"_id": ObjectId(contact_id), "owner_email": owner_email})'
    )
    code = code.replace(
        'res = self.contacts.delete_one({"_id": contact_id})',
        'res = self.contacts.delete_one({"_id": contact_id, "owner_email": owner_email})'
    )

    with open('d:/FINAL-PROJECT/smart autosecure vision/core/emergency_manager.py', 'w', encoding='utf-8') as f:
        f.write(code)

def refactor_camera():
    with open('d:/FINAL-PROJECT/smart autosecure vision/core/camera_manager.py', 'r', encoding='utf-8') as f:
        code = f.read()

    # CameraStream update
    code = code.replace(
        "def __init__(self, src, name):",
        "def __init__(self, src, name, owner_email='unknown'):"
    )
    code = code.replace(
        "self.name = name",
        "self.name = name\n        self.owner_email = owner_email"
    )

    # Manager detect_task update
    code = code.replace(
        "def detect_task(self, frame, roi_mask=None):",
        "def detect_task(self, frame, roi_mask=None, owner_email='unknown'):"
    )
    code = code.replace(
        "return self._detect_faces_and_objects(detect_frame)",
        "return self._detect_faces_and_objects(detect_frame, owner_email)"
    )
    code = code.replace(
        "def _detect_faces_and_objects(self, frame):",
        "def _detect_faces_and_objects(self, frame, owner_email='unknown'):"
    )

    # Add face matching filter logic via replace
    code = code.replace("self.known_face_relations = [] # To store relation (e.g. employee, family)", 
                        "self.known_face_relations = []\n        self.known_face_owners = []")
    
    code = code.replace("""                         if enc is not None:
                             self.known_face_encodings.append(enc)
                             self.known_face_names.append(person['name'])
                             self.known_face_relations.append(person['relation'])
                             encodings_found += 1""", 
                        """                         if enc is not None:
                             self.known_face_encodings.append(enc)
                             self.known_face_names.append(person['name'])
                             self.known_face_relations.append(person['relation'])
                             self.known_face_owners.append(person.get('owner_email', 'unknown'))
                             encodings_found += 1""")

    code = code.replace("""                if enc is not None:
                    self.known_face_encodings.append(enc)
                    self.known_face_names.append(person['name'])
                    self.known_face_relations.append(person['relation'])""",
                        """                if enc is not None:
                    self.known_face_encodings.append(enc)
                    self.known_face_names.append(person['name'])
                    self.known_face_relations.append(person['relation'])
                    self.known_face_owners.append(person.get('owner_email', 'unknown'))""")

    code = code.replace("""            for enc in encodings_to_add:
                self.known_face_encodings.append(enc)
                self.known_face_names.append(person_data['name'])
                self.known_face_relations.append(person_data['relation'])""",
                        """            for enc in encodings_to_add:
                self.known_face_encodings.append(enc)
                self.known_face_names.append(person_data['name'])
                self.known_face_relations.append(person_data['relation'])
                self.known_face_owners.append(person_data.get('owner_email', 'unknown'))""")

    code = code.replace("def remove_person_from_memory(self, name):", "def remove_person_from_memory(self, name, owner_email='unknown'):")
    code = code.replace("indices_to_remove = [i for i, n in enumerate(self.known_face_names) if n == name]",
                        "indices_to_remove = [i for i, n in enumerate(self.known_face_names) if n == name and self.known_face_owners[i] == owner_email]")
    code = code.replace("del self.known_face_relations[index]", "del self.known_face_relations[index]\n            del self.known_face_owners[index]")

    
    # Matching logic replacement
    old_match = """            face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
            if len(face_distances) > 0:
                best_match_index = np.argmin(face_distances)
                if matches[best_match_index]:
                    name = self.known_face_names[best_match_index]
                    relation = self.known_face_relations[best_match_index]"""
    new_match = """            face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
            if len(face_distances) > 0:
                best_match_index = -1
                best_distance = 999
                for i, d in enumerate(face_distances):
                    if self.known_face_owners[i] == owner_email and d < 0.55:
                        if d < best_distance:
                            best_distance = d
                            best_match_index = i
                if best_match_index != -1:
                    name = self.known_face_names[best_match_index]
                    relation = self.known_face_relations[best_match_index]"""
    code = code.replace(old_match, new_match)

    # Auto Reg
    code = code.replace('self.persons.insert_one({\n                            "serial_no": 9000 + self.auto_id_counter,',
                        'self.persons.insert_one({\n                            "owner_email": owner_email,\n                            "serial_no": 9000 + self.auto_id_counter,')
    code = code.replace('self.known_face_relations.append(relation)\n                        name = new_name',
                        'self.known_face_relations.append(relation)\n                        self.known_face_owners.append(owner_email)\n                        name = new_name')

    # log_event owner_email
    code = code.replace('self.log_event("System", f"Weapon: {label}", "Suspect", frame.copy())', 'self.log_event("System", f"Weapon: {label}", "Suspect", frame.copy(), owner_email)')
    code = code.replace('self.log_event("System", "Violence Detected", "Suspect", frame.copy())', 'self.log_event("System", "Violence Detected", "Suspect", frame.copy(), owner_email)')
    code = code.replace('self.log_event(name, "Detected", relation, frame.copy())', 'self.log_event(name, "Detected", relation, frame.copy(), owner_email)')

    code = code.replace('def log_event(self, name, action, relation="Visitor", face_img=None):', 'def log_event(self, name, action, relation="Visitor", face_img=None, owner_email="unknown"):')
    code = code.replace('"timestamp": now\n        }', '"timestamp": now,\n            "owner_email": owner_email\n        }')
    
    code = code.replace('def get_stats(self):', 'def get_stats(self, owner_email="unknown"):')
    
    code = code.replace('known_count = self.db[\'suspect_logs\'].count_documents({\n                "date": today,\n                "name": {"$not": {"$regex": "^Unknown"}, "$ne": "System"}\n            })', 
                        'known_count = self.db[\'suspect_logs\'].count_documents({\n                "date": today,\n                "owner_email": owner_email,\n                "name": {"$not": {"$regex": "^Unknown"}, "$ne": "System"}\n            })')

    code = code.replace('unknown_count = self.db[\'suspect_logs\'].count_documents({\n                "date": today,\n                "name": {"$regex": "^Unknown"}\n            })',
                        'unknown_count = self.db[\'suspect_logs\'].count_documents({\n                "date": today,\n                "owner_email": owner_email,\n                "name": {"$regex": "^Unknown"}\n            })')

    code = code.replace('suspect_count = self.db[\'suspect_logs\'].count_documents({\n                "date": today,\n                "$or": [\n                    {"name": "System"},\n                    {"relation": {"$regex": "Suspect"}}\n                ]\n            })',
                        'suspect_count = self.db[\'suspect_logs\'].count_documents({\n                "date": today,\n                "owner_email": owner_email,\n                "$or": [\n                    {"name": "System"},\n                    {"relation": {"$regex": "Suspect"}}\n                ]\n            })')

    code = code.replace('recent_logs = list(self.db[\'suspect_logs\'].find().sort("timestamp", -1).limit(20))',
                        'recent_logs = list(self.db[\'suspect_logs\'].find({"owner_email": owner_email}).sort("timestamp", -1).limit(20))')

    with open('d:/FINAL-PROJECT/smart autosecure vision/core/camera_manager.py', 'w', encoding='utf-8') as f:
        f.write(code)

if __name__ == '__main__':
    refactor_views()
    refactor_emergency()
    refactor_camera()
    print("Done refactoring backend for user data isolation!")
