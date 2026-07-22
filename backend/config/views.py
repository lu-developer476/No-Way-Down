from django.conf import settings
from django.http import FileResponse, HttpResponse
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
