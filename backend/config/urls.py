from django.contrib import admin
from django.urls import include, path

from api.views import HealthView

urlpatterns = [
    path('', HealthView.as_view(), name='root-health'),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]
