from datetime import datetime, timezone

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response(
            {
                'status': 'ok',
                'service': 'no-way-down-backend',
                'timestamp': datetime.now(timezone.utc).isoformat(),
            }
        )


class SessionCreateView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        payload = {
            'session_id': 'local-placeholder-session',
            'max_players': 4,
            'ai_allies_enabled': True,
            'map_id': 'cafeteria_bna_piso_m1',
        }
        return Response(payload, status=status.HTTP_201_CREATED)
