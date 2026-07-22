from django.contrib import admin
from django.urls import include, path, re_path

from config.views import FrontendIndexView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('', FrontendIndexView.as_view(), name='frontend-index'),
    re_path(r'^(?!(?:api|admin|static|assets)(?:/|$)).*$', FrontendIndexView.as_view(), name='frontend-catch-all'),
]
