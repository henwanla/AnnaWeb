#!/usr/bin/env python3
"""Check sitemap image HEAD responses without sending analytics or requests to index."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, ProxyHandler
from xml.etree import ElementTree
import json, sys

ORIGIN = 'https://luvypack.com'
LIMIT = 2_000_000
USER_AGENT = 'LuvyPack-Manual-Image-Check/1.0'

def read_image_urls(opener):
    url = ORIGIN + '/sitemap.xml'
    request = Request(url, headers={'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache'})
    with opener.open(request, timeout=12) as response:
        raw = response.read(LIMIT + 1)
        if response.status != 200 or response.geturl() != url or len(raw) > LIMIT:
            raise ValueError('invalid_sitemap_response')
    root = ElementTree.fromstring(raw)
    ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9', 'i': 'http://www.google.com/schemas/sitemap-image/1.1'}
    locs = [x.text or '' for x in root.findall('s:url/i:image/i:loc', ns)]
    unique = sorted(set(locs))
    if not 1 <= len(unique) <= 300:
        raise ValueError('empty_or_too_many_images')
    for value in unique:
        u = urlsplit(value)
        if (u.scheme != 'https' or u.netloc != 'luvypack.com' or not u.path.startswith('/assets/images/') or
                '..' in u.path.split('/') or u.query or u.fragment):
            raise ValueError('image_url_outside_scope')
    return locs, unique

def image_head(url, opener):
    item = {'url': url, 'ok': False}
    try:
        request = Request(url, method='HEAD', headers={'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache', 'Accept': 'image/*'})
        with opener.open(request, timeout=12) as response:
            item['http_status'] = response.status
            item['content_type'] = response.headers.get_content_type()
            if response.status != 200: item['reason'] = 'unexpected_status'; return item
            if response.geturl() != url: item['reason'] = 'redirect_or_final_url_mismatch'; return item
            if not item['content_type'].startswith('image/'): item['reason'] = 'not_image_content_type'; return item
            if 'noindex' in response.headers.get('X-Robots-Tag', '').lower(): item['reason'] = 'header_noindex'; return item
            item.update(ok=True, reason='head_passed')
    except HTTPError as e:
        item.update(http_status=e.code, reason='http_error')
    except (URLError, TimeoutError, OSError, ValueError) as e:
        item['reason'] = type(e).__name__
    return item

def main():
    result = {'checked_at_utc': datetime.now(timezone.utc).isoformat(), 'scope': 'one GitHub runner, sitemap image HEAD only', 'ok': False}
    try:
        refs, urls = read_image_urls(build_opener(ProxyHandler({})))
        with ThreadPoolExecutor(max_workers=4) as pool:
            checks = list(pool.map(lambda url: image_head(url, build_opener(ProxyHandler({}))), urls))
        failures = [x for x in checks if not x['ok']]
        result.update(references=len(refs), unique_images=len(urls), checked=len(checks), failures=failures, ok=not failures)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, ElementTree.ParseError) as e:
        result['error'] = type(e).__name__
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['ok'] else 1

if __name__ == '__main__': sys.exit(main())
