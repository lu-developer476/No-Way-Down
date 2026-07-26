from pathlib import Path
from tempfile import TemporaryDirectory

from django.test import TestCase, override_settings


class FrontendRoutingTests(TestCase):
    def test_build_info_is_json_and_exposes_only_public_identity(self):
        response = self.client.get('/api/build-info/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Content-Type'], 'application/json')
        payload = response.json()
        self.assertEqual(payload['status'], 'ok')
        self.assertEqual(
            set(payload),
            {'status', 'application', 'environment', 'backendSha', 'frontendSha', 'buildId'},
        )
        serialized = response.content.lower()
        for sensitive in (b'secret', b'token', b'password', b'database_url', b'internal path'):
            self.assertNotIn(sensitive, serialized)

    def test_root_serves_frontend_when_index_exists(self):
        with TemporaryDirectory() as temp_dir:
            dist_dir = Path(temp_dir)
            (dist_dir / 'index.html').write_text('<!doctype html><div id="app">No Way Down</div>', encoding='utf-8')

            with override_settings(FRONTEND_DIST_DIR=dist_dir, WHITENOISE_ROOT=dist_dir):
                response = self.client.get('/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Content-Type'], 'text/html')
        self.assertIn(b'No Way Down', b''.join(response.streaming_content))

    def test_api_health_still_returns_json(self):
        response = self.client.get('/api/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Content-Type'], 'application/json')
        self.assertEqual(response.json()['status'], 'ok')

    def test_catch_all_does_not_capture_api_routes(self):
        response = self.client.get('/api/not-found/')

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.headers['Content-Type'], 'application/json')

    def test_missing_frontend_build_returns_clear_response(self):
        with TemporaryDirectory() as temp_dir:
            dist_dir = Path(temp_dir) / 'missing-dist'

            with override_settings(FRONTEND_DIST_DIR=dist_dir, WHITENOISE_ROOT=dist_dir):
                response = self.client.get('/')

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers['Content-Type'], 'text/plain; charset=utf-8')
        self.assertIn(b'Frontend build not found', response.content)
