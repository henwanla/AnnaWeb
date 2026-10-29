#!/usr/bin/env python3
"""Read public endpoints once; never submit forms, events or indexing requests."""
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, ProxyHandler
from xml.etree import ElementTree

ORIGIN = 'https://luvypack.com'
LIMIT = 2_000_000

class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.robots = []
        self.title = ''
        self.in_title = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'title': self.in_title = True
        if tag == 'link' and 'canonical' in a.get('rel', '').split(): self.canonicals.append(a.get('href'))
        if tag == 'meta' and a.get('name', '').lower() in ('robots', 'googlebot', 'bingbot'): self.robots.append(a.get('content', '').lower())
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
    def handle_data(self, text):
        if self.in_title: self.title += text

def inspect(name, body, final_url, content_type):
    u = urlsplit(final_url)
    if (u.scheme, u.netloc) != ('https', 'luvypack.com'):
        return False, 'unexpected_final_origin'
    if name in ('home', 'catalog', 'fit', 'www'):
        expected = {'home': '/', 'catalog': '/products/', 'fit': '/tools/packaging-fit/', 'www': '/'}[name]
        parser = Head(); parser.feed(body.decode('utf-8'))
        if u.path != expected or parser.canonicals != [ORIGIN + expected] or 'luvypack' not in parser.title.lower():
            return False, 'html_identity_or_canonical_mismatch'
        if any('noindex' in item for item in parser.robots): return False, 'html_noindex'
        return True, 'html_identity_passed'
    if name == 'robots':
        return (b'Sitemap: https://luvypack.com/sitemap.xml' in body, 'robots_sitemap_reference')
    if name == 'sitemap':
        tree = ElementTree.fromstring(body)
        ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        locs = [x.text for x in tree.findall('s:url/s:loc', ns)]
        valid = bool(locs) and all(x and x.startswith(ORIGIN + '/') for x in locs)
        return valid, 'sitemap_urls_' + str(len(locs))
    if name == 'health':
        value = json.loads(body)
        valid = (isinstance(value, dict) and content_type == 'application/json' and value.get('ok') is True and
                 value.get('site_id') == 'luvypack' and value.get('data_environment') == 'production' and
                 value.get('scope') == 'read_only' and value.get('checks') == {'database_read': 'passed'})
        return valid, 'health_read_only'
    raise ValueError('unknown check')

def run(name, url, opener):
    result = {'target': name, 'ok': False}
    try:
        req = Request(url, headers={'User-Agent': 'LuvyPack-Manual-Public-Check/1.0', 'Cache-Control': 'no-cache'})
        with opener.open(req, timeout=15) as response:
            body = response.read(LIMIT + 1)
            result['http_status'] = response.status
            u = urlsplit(response.geturl())
            result['final_origin_and_path'] = u.scheme + '://' + u.netloc + u.path
            if response.status != 200 or len(body) > LIMIT:
                result['reason'] = 'http_or_size'; return result
            result['ok'], result['reason'] = inspect(name, body, response.geturl(), response.headers.get_content_type())
    except HTTPError as e:
        result.update(http_status=e.code, reason='http_error')
    except (URLError, TimeoutError, OSError, ValueError, UnicodeError, ElementTree.ParseError) as e:
        result['reason'] = type(e).__name__
    return result

def check_sitemap_page(url, opener):
    """Check the served HTML, not whether a search engine indexed it."""
    out = {'url': url, 'ok': False}
    try:
        req = Request(url, headers={'User-Agent': 'LuvyPack-Manual-Public-Check/1.0', 'Cache-Control': 'no-cache'})
        with opener.open(req, timeout=12) as response:
            out['http_status'] = response.status
            body = response.read(LIMIT + 1)
            if response.status != 200 or len(body) > LIMIT:
                out['reason'] = 'http_or_size'; return out
            if response.geturl() != url:
                out['reason'] = 'redirect_or_final_url_mismatch'; return out
            if response.headers.get_content_type() != 'text/html':
                out['reason'] = 'unexpected_content_type'; return out
            if 'noindex' in response.headers.get('X-Robots-Tag', '').lower():
                out['reason'] = 'header_noindex'; return out
            head = Head(); head.feed(body.decode('utf-8'))
            if head.canonicals != [url] or not head.title:
                out['reason'] = 'missing_title_or_wrong_canonical'; return out
            if any('noindex' in item for item in head.robots):
                out['reason'] = 'meta_noindex'; return out
            out.update(ok=True, reason='indexability_conditions_passed')
    except HTTPError as e:
        out.update(http_status=e.code, reason='http_error')
    except (URLError, TimeoutError, OSError, ValueError, UnicodeError, ElementTree.ParseError) as e:
        out['reason'] = type(e).__name__
    return out


def check_sitemap_pages(opener):
    try:
        req = Request(ORIGIN + '/sitemap.xml', headers={'User-Agent': 'LuvyPack-Manual-Public-Check/1.0', 'Cache-Control': 'no-cache'})
        with opener.open(req, timeout=12) as response:
            body = response.read(LIMIT + 1)
            if response.status != 200 or response.geturl() != ORIGIN + '/sitemap.xml' or len(body) > LIMIT:
                return {'ok': False, 'error': 'sitemap_response_invalid'}
        tree = ElementTree.fromstring(body)
        ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        urls = [element.text or '' for element in tree.findall('s:url/s:loc', ns)]
        if not 1 <= len(urls) <= 100 or len(set(urls)) != len(urls):
            return {'ok': False, 'error': 'sitemap_empty_duplicate_or_limit'}
        for url in urls:
            u = urlsplit(url)
            if u.scheme != 'https' or u.netloc != 'luvypack.com' or not u.path.startswith('/') or u.query or u.fragment or '..' in u.path.split('/'):
                return {'ok': False, 'error': 'sitemap_url_outside_scope'}
        with ThreadPoolExecutor(max_workers=4) as executor:
            pages = list(executor.map(lambda url: check_sitemap_page(url, build_opener(ProxyHandler({}))), urls))
        failures = [item for item in pages if not item['ok']]
        return {'ok': not failures, 'sitemap_urls': len(urls), 'pages_checked': len(pages), 'failures': failures}
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, ElementTree.ParseError) as e:
        return {'ok': False, 'error': type(e).__name__}


def main():
    urls = [('home', ORIGIN + '/'), ('catalog', ORIGIN + '/products/'), ('robots', ORIGIN + '/robots.txt'),
            ('sitemap', ORIGIN + '/sitemap.xml'), ('fit', ORIGIN + '/tools/packaging-fit/'),
            ('health', ORIGIN + '/api/health'), ('www', 'https://www.luvypack.com/')]
    opener = build_opener(ProxyHandler({}))
    checks = [run(name, url, opener) for name, url in urls]
    sitemap_pages = check_sitemap_pages(opener)
    result = {'checked_at_utc': datetime.now(timezone.utc).isoformat(), 'scope': 'one GitHub runner; public read-only',
              'checks': checks, 'sitemap_pages': sitemap_pages,
              'all_passed': all(x['ok'] for x in checks) and sitemap_pages['ok']}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['all_passed'] else 1

if __name__ == '__main__':
    sys.exit(main())
