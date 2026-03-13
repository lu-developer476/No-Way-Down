from django.urls import path

from .views import HealthView, ProgressView, SessionCreateView

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    path('sessions/', SessionCreateView.as_view(), name='session-create'),
    path('progress/<str:slot_id>/', ProgressView.as_view(), name='progress'),
]
