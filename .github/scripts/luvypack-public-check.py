#!/usr/bin/env python3
"""Read public endpoints once; never submit forms, events or indexing requests."""
import json
import sys
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
        if tag == 'meta' and a.get('name', '').lower() == 'robots': self.robots.append(a.get('content', '').lower())
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

def main():
    urls = [('home', ORIGIN + '/'), ('catalog', ORIGIN + '/products/'), ('robots', ORIGIN + '/robots.txt'),
            ('sitemap', ORIGIN + '/sitemap.xml'), ('fit', ORIGIN + '/tools/packaging-fit/'),
            ('health', ORIGIN + '/api/health'), ('www', 'https://www.luvypack.com/')]
    opener = build_opener(ProxyHandler({}))
    checks = [run(name, url, opener) for name, url in urls]
    result = {'checked_at_utc': datetime.now(timezone.utc).isoformat(), 'scope': 'one GitHub runner; public read-only',
              'checks': checks, 'all_passed': all(x['ok'] for x in checks)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['all_passed'] else 1

if __name__ == '__main__':
    sys.exit(main())
