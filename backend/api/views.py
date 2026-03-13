from datetime import datetime, timezone

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PlayerProgress
from .serializers import PlayerProgressSerializer


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


class PlayerProgressUpsertView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        instance = PlayerProgress.objects.filter(user_id=user_id).first()
        serializer = PlayerProgressSerializer(instance=instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        response_status = status.HTTP_200_OK if instance else status.HTTP_201_CREATED
        return Response(serializer.data, status=response_status)


class PlayerProgressDetailView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, user_id):
        instance = get_object_or_404(PlayerProgress, user_id=user_id)
        serializer = PlayerProgressSerializer(instance)
        return Response(serializer.data)
