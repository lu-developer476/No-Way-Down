import os
import json

from django.conf import settings
from django.http import FileResponse, HttpResponse, JsonResponse
from django.views import View

def _set_no_cache(response, frontend_sha=None):
    response['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    if frontend_sha:
        response['X-NWD-Frontend-SHA'] = frontend_sha
    return response


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

        return _set_no_cache(FileResponse(resolved_index.open('rb'), content_type='text/html'), _build_sha())


def frontend_build_info(request):
    """Serve the generated frontend identity without allowing stale caches."""
    path = settings.FRONTEND_DIST_DIR / 'build-info.json'
    if not path.is_file():
        return JsonResponse({'detail': 'Frontend build identity not found.'}, status=503)
    response = FileResponse(path.open('rb'), content_type='application/json')
    return _set_no_cache(response, _build_sha())


def api_not_found(request, path=''):
    """Keep unknown API URLs JSON-only instead of leaking into Django's HTML 404."""
    return JsonResponse({'detail': 'API route not found.'}, status=404)


def _build_sha():
    for name in ('NWD_SOURCE_SHA', 'NWD_BUILD_SHA', 'GITHUB_SHA', 'RENDER_GIT_COMMIT'):
        value = os.getenv(name, '').strip()
        if value:
            return value
    return 'unknown'


def build_info(request):
    """Expose only non-sensitive deploy identity used by production smoke tests."""
    sha = _build_sha()
    frontend_info = {}
    try:
        frontend_info = json.loads((settings.FRONTEND_DIST_DIR / 'build-info.json').read_text(encoding='utf-8'))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        pass
    source_sha = os.getenv('NWD_SOURCE_SHA', frontend_info.get('sourceSha', sha))
    frontend_sha = os.getenv('NWD_FRONTEND_SHA', frontend_info.get('frontendSha', source_sha))
    deploy_commit = os.getenv('NWD_DEPLOY_COMMIT', os.getenv('RENDER_GIT_COMMIT', frontend_info.get('deployCommit', sha)))
    response = JsonResponse({
        'status': 'ok', 'application': 'No Way Down', 'environment': os.getenv('DJANGO_ENV', 'development'),
        'backendSha': source_sha, 'frontendSha': frontend_sha, 'sourceSha': source_sha,
        'deployCommit': deploy_commit, 'renderCommit': os.getenv('RENDER_GIT_COMMIT', deploy_commit),
        'repositoryProvider': os.getenv('NWD_REPOSITORY_PROVIDER', frontend_info.get('repositoryProvider', 'unknown')),
        'branch': os.getenv('NWD_BRANCH', os.getenv('RENDER_GIT_BRANCH', frontend_info.get('branch', 'local'))),
        'buildId': os.getenv('RENDER_DEPLOY_ID', frontend_info.get('buildId', os.getenv('NWD_BUILT_AT', 'unknown'))),
        'builtAt': os.getenv('NWD_BUILT_AT', frontend_info.get('builtAt', 'unknown')),
        'canonicalNodeCount': frontend_info.get('canonicalNodeCount', 35),
    })
    _set_no_cache(response, frontend_sha)
    response['X-NWD-Backend-SHA'] = sha
    return response
