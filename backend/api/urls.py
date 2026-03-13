from django.urls import path

from .views import HealthView, SessionCreateView

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    path('sessions/', SessionCreateView.as_view(), name='session-create'),
]
