import re

from rest_framework import serializers

from .models import PlayerProgress

CHECKPOINT_PATTERN = re.compile(r'^\d+,\d+$')


class PlayerProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerProgress
        fields = [
            'user_id',
            'current_level',
            'life',
            'allies_rescued',
            'checkpoint',
            'updated_at',
            'created_at',
        ]
        read_only_fields = ['updated_at', 'created_at']

    def validate_checkpoint(self, value: str) -> str:
        if not CHECKPOINT_PATTERN.match(value):
            raise serializers.ValidationError('checkpoint debe tener formato "x,y".')
        return value
