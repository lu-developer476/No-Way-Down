import os

from django.conf import settings
from django.http import FileResponse, HttpResponse, JsonResponse
from django.views import View


class FrontendIndexView(View):
    """Serve the compiled Vite application entrypoint."""

    def get(self, request, path=''):
        index_path = settings.FRONTEND_DIST_DIR / 'index.html'
        try:
            resolved_index = index_path.resolve(strict=True)
            resolved_dist = settings.FRONTEND_DIST_DIR.resolve(strict=True)
        except FileNotFoundError:
            return HttpResponse(
                'Frontend build not found. Run `npm run build --prefix game` before serving the production app.',
                status=503,
                content_type='text/plain; charset=utf-8',
            )

        if resolved_index.parent != resolved_dist:
            return HttpResponse('Invalid frontend build path.', status=500, content_type='text/plain; charset=utf-8')

        return FileResponse(resolved_index.open('rb'), content_type='text/html')


def api_not_found(request, path=''):
    """Keep unknown API URLs JSON-only instead of leaking into Django's HTML 404."""
    return JsonResponse({'detail': 'API route not found.'}, status=404)


def _build_sha():
    for name in ('NWD_BUILD_SHA', 'GITHUB_SHA', 'RENDER_GIT_COMMIT'):
        value = os.getenv(name, '').strip()
        if value:
            return value
    return 'unknown'


def build_info(request):
    """Expose only non-sensitive deploy identity used by production smoke tests."""
    sha = _build_sha()
    return JsonResponse({
        'status': 'ok',
        'application': 'No Way Down',
        'environment': os.getenv('DJANGO_ENV', 'development'),
        'backendSha': sha,
        'frontendSha': os.getenv('NWD_FRONTEND_SHA', sha),
        'buildId': os.getenv('RENDER_DEPLOY_ID', os.getenv('NWD_BUILT_AT', 'unknown')),
    })
