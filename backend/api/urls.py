from django.urls import path

from .views import HealthView, PlayerProgressDetailView, PlayerProgressUpsertView

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    path('progress/', PlayerProgressUpsertView.as_view(), name='progress-upsert'),
    path('progress/<str:user_id>/', PlayerProgressDetailView.as_view(), name='progress-detail'),
]
