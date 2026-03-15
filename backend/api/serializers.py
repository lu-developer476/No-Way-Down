import re

from rest_framework import serializers

from .models import PlayerProgress

CHECKPOINT_PATTERN = re.compile(r'^(?:\d+,\d+|[A-Za-z0-9_-]+)$')


class PlayerProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerProgress
        fields = [
            'user_id',
            'current_level',
            'life',
            'allies_rescued',
            'checkpoint',
            'save_version',
            'campaign_snapshot',
            'updated_at',
            'created_at',
        ]
        read_only_fields = ['updated_at', 'created_at']

    def validate_checkpoint(self, value: str) -> str:
        if not CHECKPOINT_PATTERN.match(value):
            raise serializers.ValidationError('checkpoint debe tener formato "x,y" o identificador simple (ej: cp_comedor_pasillo).')
        return value

    def validate_campaign_snapshot(self, value: object) -> dict:
        if value in (None, {}):
            return {}

        if not isinstance(value, dict):
            raise serializers.ValidationError('campaign_snapshot debe ser un objeto JSON.')

        setup = value.get('setup')
        party = value.get('party')
        progress = value.get('progress')
        narrative = value.get('narrative')
        checkpoints = value.get('checkpoints')

        if not isinstance(setup, dict):
            raise serializers.ValidationError('campaign_snapshot.setup es obligatorio y debe ser un objeto.')
        if not isinstance(party, dict):
            raise serializers.ValidationError('campaign_snapshot.party es obligatorio y debe ser un objeto.')
        if not isinstance(progress, dict):
            raise serializers.ValidationError('campaign_snapshot.progress es obligatorio y debe ser un objeto.')
        if not isinstance(narrative, dict):
            raise serializers.ValidationError('campaign_snapshot.narrative es obligatorio y debe ser un objeto.')
        if not isinstance(checkpoints, dict):
            raise serializers.ValidationError('campaign_snapshot.checkpoints es obligatorio y debe ser un objeto.')

        initial_party = setup.get('initial_party')
        if not isinstance(initial_party, dict):
            raise serializers.ValidationError('campaign_snapshot.setup.initial_party debe ser un objeto.')

        self._validate_list_of_strings(initial_party.get('required'), 'campaign_snapshot.setup.initial_party.required')
        self._validate_list_of_strings(initial_party.get('optional'), 'campaign_snapshot.setup.initial_party.optional')

        for key in ('active', 'dead', 'rescued', 'infected'):
            self._validate_list_of_strings(party.get(key), f'campaign_snapshot.party.{key}')

        if not isinstance(progress.get('level'), str) or not progress.get('level').strip():
            raise serializers.ValidationError('campaign_snapshot.progress.level debe ser un string no vacío.')

        progress_checkpoint = progress.get('checkpoint')
        if not isinstance(progress_checkpoint, str) or not CHECKPOINT_PATTERN.match(progress_checkpoint):
            raise serializers.ValidationError('campaign_snapshot.progress.checkpoint debe tener formato válido.')

        if not isinstance(narrative.get('flags'), dict):
            raise serializers.ValidationError('campaign_snapshot.narrative.flags debe ser un objeto.')

        for key in ('irreversible_events', 'seen_cinematics'):
            self._validate_list_of_strings(narrative.get(key), f'campaign_snapshot.narrative.{key}')

        last_checkpoint = checkpoints.get('last')
        if not isinstance(last_checkpoint, str) or not CHECKPOINT_PATTERN.match(last_checkpoint):
            raise serializers.ValidationError('campaign_snapshot.checkpoints.last debe tener formato válido.')

        visited = checkpoints.get('visited')
        self._validate_list_of_strings(visited, 'campaign_snapshot.checkpoints.visited')
        for visited_checkpoint in visited:
            if not CHECKPOINT_PATTERN.match(visited_checkpoint):
                raise serializers.ValidationError('campaign_snapshot.checkpoints.visited contiene checkpoints inválidos.')

        return value

    def validate(self, attrs: dict) -> dict:
        snapshot = attrs.get('campaign_snapshot')
        if snapshot in (None, {}):
            attrs['campaign_snapshot'] = self._build_legacy_compatible_snapshot(attrs)

        attrs['save_version'] = attrs.get('save_version') or 2
        return attrs

    def _build_legacy_compatible_snapshot(self, attrs: dict) -> dict:
        current_level = attrs.get('current_level')
        checkpoint = attrs.get('checkpoint')
        life = attrs.get('life', 0)
        allies_rescued = attrs.get('allies_rescued', 0)

        return {
            'setup': {
                'protagonist': 'unknown',
                'difficulty': 'unknown',
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
                'level': current_level,
                'checkpoint': checkpoint,
                'life': life,
                'allies_rescued': allies_rescued,
            },
            'narrative': {
                'flags': {},
                'irreversible_events': [],
                'seen_cinematics': [],
            },
            'checkpoints': {
                'last': checkpoint,
                'visited': [checkpoint] if checkpoint else [],
            },
        }

    def _validate_list_of_strings(self, value: object, path: str) -> None:
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            raise serializers.ValidationError(f'{path} debe ser una lista de strings.')
