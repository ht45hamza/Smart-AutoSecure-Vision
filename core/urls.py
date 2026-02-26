from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    
    # Auth
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('verify_email/', views.verify_email, name='verify_email'),
    path('forgot_password/', views.forgot_password, name='forgot_password'),
    path('logout/', views.logout_view, name='logout'),
    
    # Camera / API
    path('video_feed/<int:device_id>/', views.video_feed, name='video_feed'),
    path('cameras/', views.get_cameras, name='get_cameras'),
    path('api/added_cameras/', views.get_added_cameras, name='get_added_cameras'),
    path('add_camera/', views.add_camera, name='add_camera'),
    path('set_main/<int:device_id>/', views.set_main, name='set_main'),
    path('api/set_roi/', views.set_roi, name='set_roi'),
    path('api/stats/', views.get_stats, name='get_stats'),
    path('api/emergency_status/', views.get_emergency_status, name='get_emergency_status'),
    path('api/simulate_threat/', views.simulate_threat, name='simulate_threat'),
    
    # New React APIs
    path('api/persons/', views.get_persons_api, name='get_persons_api'),
    path('api/contacts/', views.get_contacts_api, name='get_contacts_api'),
    path('api/logs/', views.get_logs_api, name='get_logs_api'),
    
    # Admin
    path('admin/', views.admin_panel, name='admin_panel'),
    path('admin/contacts/', views.contacts_panel, name='contacts_panel'),
    path('admin/logs/', views.logs_panel, name='logs_panel'),
    
    # Actions
    path('admin/add/', views.add_person, name='add_person'),
    path('admin/register_samples/', views.register_samples, name='register_samples'),
    path('admin/delete/<int:serial_no>/', views.delete_person, name='delete_person'),
    path('admin/update/<int:serial_no>/', views.update_person, name='update_person'),
    
    # React / REST API
    path('api/login/', views.api_login, name='api_login'),
    path('api/register/', views.api_register, name='api_register'),
    path('api/add_contact/', views.api_add_contact, name='api_add_contact'),
    path('api/delete_contact/<contact_id>/', views.api_delete_contact, name='api_delete_contact'),
    path('api/delete_log/<str:log_id>/', views.api_delete_log, name='api_delete_log'),
]
