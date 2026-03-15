import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DatabaseError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def json_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        return response

    if isinstance(exc, DjangoValidationError):
        logger.warning('Validación no controlada en API: %s', exc)
        return Response({'detail': 'Solicitud inválida.'}, status=status.HTTP_400_BAD_REQUEST)

    if isinstance(exc, DatabaseError):
        logger.exception('Error de base de datos no controlado en API')
        return Response(
            {'detail': 'Servicio temporalmente no disponible por base de datos.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    logger.exception('Error interno no controlado en API')
    return Response({'detail': 'Error interno del servidor.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
