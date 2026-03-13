from django.test import TestCase
from rest_framework.test import APIClient

from .models import PlayerProgress


class ApiSmokeTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_endpoint(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')

    def test_progress_upsert_and_fetch(self):
        payload = {
            'user_id': 'player-001',
            'current_level': 'nivel_2',
            'life': 2,
            'allies_rescued': 1,
            'checkpoint': 'cp_comedor_pasillo',
        }

        create_response = self.client.post('/api/progress/', data=payload, format='json')
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(PlayerProgress.objects.count(), 1)

        payload['life'] = 1
        update_response = self.client.post('/api/progress/', data=payload, format='json')
        self.assertEqual(update_response.status_code, 200)

        detail_response = self.client.get('/api/progress/player-001/')
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()['life'], 1)
