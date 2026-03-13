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

    def test_save_and_load_progress(self):
        payload = {
            'sceneKey': 'GameScene',
            'respawnPoint': {'x': 140, 'y': 400},
            'checkpoint': {'x': 500, 'y': 400},
            'playerPositions': [{'x': 140, 'y': 400, 'health': 100}],
            'teamHealth': 100,
            'zombiesRemaining': 3,
            'currentObjective': 'Eliminar zombies',
        }

        save_response = self.client.post('/api/progress/slot-principal/', data=payload, format='json')
        self.assertEqual(save_response.status_code, 201)
        self.assertEqual(save_response.json()['sceneKey'], 'GameScene')

        load_response = self.client.get('/api/progress/slot-principal/')
        self.assertEqual(load_response.status_code, 200)
        self.assertEqual(load_response.json()['currentObjective'], 'Eliminar zombies')

    def test_load_progress_not_found(self):
        response = self.client.get('/api/progress/slot-inexistente/')
        self.assertEqual(response.status_code, 404)

    def test_save_progress_requires_fields(self):
        response = self.client.post('/api/progress/slot-principal/', data={'sceneKey': 'GameScene'}, format='json')
        self.assertEqual(response.status_code, 400)
