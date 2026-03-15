from django.db import models


class PlayerProgress(models.Model):
    user_id = models.CharField(max_length=120, unique=True)
    current_level = models.CharField(max_length=120)
    life = models.PositiveSmallIntegerField(default=3)
    allies_rescued = models.PositiveIntegerField(default=0)
    checkpoint = models.CharField(max_length=120)
    save_version = models.PositiveSmallIntegerField(default=2)
    campaign_snapshot = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self) -> str:
        return f'{self.user_id} - {self.current_level}'
