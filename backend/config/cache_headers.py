import re

HASHED_VITE_ASSET = re.compile(r'/assets/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$')


def add_frontend_cache_headers(headers, path, url):
    """Keep deploy identity fresh while retaining immutable Vite chunk caching."""
    if url.endswith('/build-info.json') or url.endswith('/index.html'):
        headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
        headers['Pragma'] = 'no-cache'
        headers['Expires'] = '0'
    elif HASHED_VITE_ASSET.search(url):
        headers['Cache-Control'] = 'public, max-age=31536000, immutable'
