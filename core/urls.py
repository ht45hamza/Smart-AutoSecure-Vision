from django.urls import path
from . import views

urlpatterns = [
    # Mobile QR Camera
    path('api/qrcode_gen/', views.generate_qr_session, name='generate_qr_session'),
    path('mobile_cam/<str:token>/', views.mobile_cam_view, name='mobile_cam_view'),
    path('api/mobile_cam/frame/<str:token>/', views.mobile_cam_frame, name='mobile_cam_frame'),
    path('api/mobile_cam/status_update/<str:token>/', views.mobile_cam_status_update, name='mobile_cam_status_update'),

    path('', views.index, name='index'),
    
    # Auth
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('verify_email/', views.verify_email, name='verify_email'),
    path('forgot_password/', views.forgot_password, name='forgot_password'),
    path('logout/', views.logout_view, name='logout'),
    
    # Camera / API
    path('video_feed/<str:device_id>/', views.video_feed, name='video_feed'),
    path('cameras/', views.get_cameras, name='get_cameras'),
    path('api/added_cameras/', views.get_added_cameras, name='get_added_cameras'),
    path('add_camera/', views.add_camera, name='add_camera'),
    path('set_main/<str:device_id>/', views.set_main, name='set_main'),
    path('api/set_roi/', views.set_roi, name='set_roi'),
    path('api/stats/', views.get_stats, name='get_stats'),
    path('api/emergency_status/', views.get_emergency_status, name='get_emergency_status'),
    path('api/simulate_threat/', views.simulate_threat, name='simulate_threat'),
    
    # React Data APIs
    path('api/persons/', views.get_persons_api, name='get_persons_api'),
    path('api/contacts/', views.get_contacts_api, name='get_contacts_api'),
    path('api/logs/', views.get_logs_api, name='get_logs_api'),
    
    # Admin (template-based)
    path('admin/', views.admin_panel, name='admin_panel'),
    path('admin/contacts/', views.contacts_panel, name='contacts_panel'),
    path('admin/logs/', views.logs_panel, name='logs_panel'),
    
    # Person Actions
    path('admin/add/', views.add_person, name='add_person'),
    path('admin/register_samples/', views.register_samples, name='register_samples'),
    path('admin/delete/<int:serial_no>/', views.delete_person, name='delete_person'),
    path('admin/update/<int:serial_no>/', views.update_person, name='update_person'),
    
    # React / REST Auth API
    path('api/login/', views.api_login, name='api_login'),
    path('api/register/', views.api_register, name='api_register'),
    path('api/verify_email/', views.api_verify_email, name='api_verify_email'),
    path('api/google_login/', views.api_google_login, name='api_google_login'),
    path('api/forgot_password/', views.api_forgot_password, name='api_forgot_password'),
    path('api/add_contact/', views.api_add_contact, name='api_add_contact'),
    path('api/delete_contact/<contact_id>/', views.api_delete_contact, name='api_delete_contact'),
    path('api/delete_log/<str:log_id>/', views.api_delete_log, name='api_delete_log'),

    # Suspect Management
    path('api/add_suspect/', views.api_add_suspect, name='api_add_suspect'),
    path('api/suspects/', views.api_list_suspects, name='api_list_suspects'),
    path('api/suspects/<int:serial_no>/', views.api_delete_suspect, name='api_delete_suspect'),

    # User Management (admin only)
    path('api/users/', views.api_get_users, name='api_get_users'),
    path('api/users/create/', views.api_create_user, name='api_create_user'),
    path('api/users/<str:user_id>/', views.api_delete_user, name='api_delete_user'),
    path('api/users/<str:user_id>/update/', views.api_update_user, name='api_update_user'),

]
