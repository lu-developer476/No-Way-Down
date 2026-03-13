from django.contrib import admin

from .models import PlayerProgress


@admin.register(PlayerProgress)
class PlayerProgressAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'current_level', 'life', 'allies_rescued', 'checkpoint', 'updated_at')
    search_fields = ('user_id', 'current_level', 'checkpoint')
