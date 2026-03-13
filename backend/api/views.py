from datetime import datetime, timezone

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


PROGRESS_SLOTS: dict[str, dict] = {}


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


class ProgressView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, slot_id: str):
        progress = PROGRESS_SLOTS.get(slot_id)

        if not progress:
            return Response(
                {'detail': 'No existe partida guardada para ese slot.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(progress)

    def post(self, request, slot_id: str):
        required_fields = [
            'sceneKey',
            'respawnPoint',
            'playerPositions',
            'teamHealth',
            'zombiesRemaining',
            'currentObjective',
        ]

        missing_fields = [field for field in required_fields if field not in request.data]
        if missing_fields:
            return Response(
                {'detail': f'Faltan campos requeridos: {", ".join(missing_fields)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        snapshot = {
            'sceneKey': request.data['sceneKey'],
            'respawnPoint': request.data['respawnPoint'],
            'checkpoint': request.data.get('checkpoint'),
            'playerPositions': request.data['playerPositions'],
            'teamHealth': request.data['teamHealth'],
            'zombiesRemaining': request.data['zombiesRemaining'],
            'currentObjective': request.data['currentObjective'],
            'savedAt': datetime.now(timezone.utc).isoformat(),
        }

        PROGRESS_SLOTS[slot_id] = snapshot
        return Response(snapshot, status=status.HTTP_201_CREATED)
