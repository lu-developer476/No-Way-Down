import logging
from datetime import datetime, timezone

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from django.db import DatabaseError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PlayerProgress
from .serializers import PlayerProgressSerializer

logger = logging.getLogger(__name__)


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

        try:
            serializer.is_valid(raise_exception=True)
            serializer.save()
        except DjangoValidationError as exc:
            logger.warning('Error de validación en progreso para user_id=%s: %s', user_id, exc)
            return Response({'detail': 'Datos de progreso inválidos.'}, status=status.HTTP_400_BAD_REQUEST)
        except DatabaseError:
            logger.exception('Error de base de datos al guardar progreso para user_id=%s', user_id)
            return Response(
                {'detail': 'No se pudo guardar el progreso por un problema interno de datos.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        response_status = status.HTTP_200_OK if instance else status.HTTP_201_CREATED
        return Response(serializer.data, status=response_status)


class PlayerProgressDetailView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, user_id):
        try:
            instance = get_object_or_404(PlayerProgress, user_id=user_id)
        except DatabaseError:
            logger.exception('Error de base de datos al leer progreso para user_id=%s', user_id)
            return Response(
                {'detail': 'No se pudo consultar el progreso por un problema interno de datos.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = PlayerProgressSerializer(instance)
        return Response(serializer.data)
