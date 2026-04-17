#!/usr/bin/env python3
"""One-off: query social_posts to see Make.com actual firing pattern.
Strips the literal backslash-n that vercel env pull appends inside quoted env values."""
import json, os, sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from collections import Counter
from datetime import datetime

env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
env = {}
with open(env_path, encoding='utf-8') as f:
    for line in f:
        line = line.rstrip('\r\n')
        if '=' not in line or line.startswith('#'):
            continue
        k, v = line.split('=', 1)
        v = v.strip()
        if v.startswith('"') and v.endswith('"'):
            v = v[1:-1]
        # strip literal 2-char \n suffix that vercel env pull appends
        if v.endswith('\\n'):
            v = v[:-2]
        env[k] = v

url_base = env.get('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
srk = env.get('SUPABASE_SERVICE_ROLE_KEY', '')
print(f'url={url_base}')
print(f'srk_len={len(srk)} srk_last6={srk[-6:]!r}')

q = url_base + '/rest/v1/social_posts?platform=eq.facebook_page&select=posted_at,caption_hash&order=posted_at.desc&limit=100'
req = Request(q, headers={'apikey': srk, 'Authorization': f'Bearer {srk}', 'Accept': 'application/json'})
try:
    with urlopen(req, timeout=10) as resp:
        data = json.load(resp)
except HTTPError as e:
    print(f'HTTP {e.code}: {e.read()[:300]!r}')
    sys.exit(1)

if not isinstance(data, list):
    print('non-list:', str(data)[:300])
    sys.exit(1)
print(f'total_rows={len(data)}')
if not data:
    sys.exit(0)
print(f'most_recent={data[0]["posted_at"]}')
print(f'oldest_in_window={data[-1]["posted_at"]}')
by_hour = Counter()
for r in data:
    t = datetime.fromisoformat(r['posted_at'].replace('Z', '+00:00'))
    by_hour[t.strftime('%Y-%m-%d %H UTC')] += 1
print('by_hour (recent first):')
for h in sorted(by_hour.keys(), reverse=True)[:24]:
    print(f'  {h}: {by_hour[h]} posts')
