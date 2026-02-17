from pymongo import MongoClient
from core.config import MONGODB_URI, DATABASE_NAME

try:
    client = MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]

    print(f"Connected to {DATABASE_NAME}")
    print("Collections found:", db.list_collection_names())
    
    # Check counts
    print(f"Users: {db.users.count_documents({})}")
    print(f"Suspect Logs: {db.suspect_logs.count_documents({})}")
    print(f"Emergency Contacts: {db.emergency_contacts.count_documents({})}")
    print(f"Known Persons: {db.known_persons.count_documents({})}")
    
except Exception as e:
    print(f"Error: {e}")
