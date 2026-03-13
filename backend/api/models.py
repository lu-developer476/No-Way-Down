from django.db import models


class PlaceholderModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
