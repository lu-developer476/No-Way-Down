from django.test import TestCase
from rest_framework.test import APIClient


class ApiSmokeTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_endpoint(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')

    def test_create_session(self):
        response = self.client.post('/api/sessions/', data={}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['max_players'], 4)
