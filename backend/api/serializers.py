from rest_framework import serializers

from .models import PlayerProgress


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
