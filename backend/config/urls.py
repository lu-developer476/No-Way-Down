from django.contrib import admin
from django.urls import include, path, re_path

from config.views import FrontendIndexView, api_not_found, build_info, frontend_build_info

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('api/build-info/', build_info, name='build-info'),
    path('build-info.json', frontend_build_info, name='frontend-build-info'),
    re_path(r'^api(?:/.*)?$', api_not_found, name='api-not-found'),
    path('', FrontendIndexView.as_view(), name='frontend-index'),
    re_path(r'^(?!(?:api|admin|static|assets)(?:/|$)).*$', FrontendIndexView.as_view(), name='frontend-catch-all'),
]
