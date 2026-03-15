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
            'save_version': 2,
            'campaign_snapshot': {
                'setup': {
                    'protagonist': 'giovanna',
                    'difficulty': 'pesadilla',
                    'initial_party': {
                        'required': ['Damián', 'Nahir', 'Lorena', 'Selene'],
                        'optional': ['Celestino', 'Yamil'],
                    },
                },
                'party': {
                    'active': ['Giovanna', 'Damián', 'Nahir', 'Celestino'],
                    'dead': ['Selene'],
                    'rescued': ['Lorena'],
                    'infected': ['Yamil'],
                },
                'progress': {
                    'level': 'nivel_2',
                    'checkpoint': 'cp_comedor_pasillo',
                    'segment': 'llegada_a_cocina',
                    'life': 2,
                    'allies_rescued': 1,
                },
                'narrative': {
                    'flags': {'vio_intro': True, 'llave_mantenimiento': 1},
                    'irreversible_events': ['alarma_activada'],
                    'seen_cinematics': ['intro_comedor'],
                },
                'checkpoints': {
                    'last': 'cp_comedor_pasillo',
                    'visited': ['cp_inicio', 'cp_comedor_pasillo'],
                },
            },
        }

        create_response = self.client.post('/api/progress/', data=payload, format='json')
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(PlayerProgress.objects.count(), 1)

        payload['life'] = 1
        payload['campaign_snapshot']['progress']['life'] = 1
        update_response = self.client.post('/api/progress/', data=payload, format='json')
        self.assertEqual(update_response.status_code, 200)

        detail_response = self.client.get('/api/progress/player-001/')
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()['life'], 1)
        self.assertEqual(detail_response.json()['campaign_snapshot']['setup']['difficulty'], 'pesadilla')

    def test_legacy_payload_builds_compatible_snapshot(self):
        payload = {
            'user_id': 'legacy-player',
            'current_level': 'GameScene',
            'life': 3,
            'allies_rescued': 0,
            'checkpoint': '120,330',
        }

        response = self.client.post('/api/progress/', data=payload, format='json')
        self.assertEqual(response.status_code, 201)

        progress = PlayerProgress.objects.get(user_id='legacy-player')
        self.assertEqual(progress.save_version, 2)
        self.assertEqual(progress.campaign_snapshot['progress']['level'], 'GameScene')
        self.assertEqual(progress.campaign_snapshot['setup']['protagonist'], 'unknown')

    def test_rejects_invalid_snapshot(self):
        payload = {
            'user_id': 'player-invalid',
            'current_level': 'GameScene',
            'life': 3,
            'allies_rescued': 0,
            'checkpoint': '120,330',
            'campaign_snapshot': {
                'setup': {
                    'protagonist': 'giovanna',
                    'difficulty': 'complejo',
                    'initial_party': {
                        'required': [],
                        'optional': [],
                    },
                },
                'party': {
                    'active': [],
                    'dead': [],
                    'rescued': [],
                    'infected': [],
                },
                'progress': {
                    'level': 'GameScene',
                    'checkpoint': 'invalid*checkpoint',
                    'life': 3,
                    'allies_rescued': 0,
                },
                'narrative': {
                    'flags': {},
                    'irreversible_events': [],
                    'seen_cinematics': [],
                },
                'checkpoints': {
                    'last': '120,330',
                    'visited': ['120,330'],
                },
            },
        }

        response = self.client.post('/api/progress/', data=payload, format='json')
        self.assertEqual(response.status_code, 400)
