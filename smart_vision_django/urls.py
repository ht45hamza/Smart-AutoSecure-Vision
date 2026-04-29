"""
URL configuration for smart_vision_django project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('django-admin/', admin.site.urls),  # Renamed to avoid conflict with core admin
    path('', include('core.urls')),
]

# Serve static files (includes React build + uploaded images) during development
if settings.DEBUG:
    urlpatterns += static(
        settings.STATIC_URL,
        document_root=settings.STATICFILES_DIRS[0]
    )
    # Also serve media (uploaded photos) via /media/
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )
