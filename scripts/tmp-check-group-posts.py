#!/usr/bin/env python3
"""One-off check for new social_posts facebook_group rows."""
import json
from urllib.request import Request, urlopen

env = {}
for line in open('.env.local', encoding='utf-8'):
    line = line.rstrip('\r\n')
    if '=' not in line or line.startswith('#'): continue
    k, v = line.split('=', 1)
    v = v.strip()
    if v.startswith('"') and v.endswith('"'): v = v[1:-1]
    if v.endswith('\\n'): v = v[:-2]
    env[k] = v

url = env['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')
srk = env['SUPABASE_SERVICE_ROLE_KEY']
print(f'url={url}')
print(f'url_len={len(url)} last4={url[-4:]!r}')

q = url + '/rest/v1/social_posts?platform=eq.facebook_group&order=posted_at.desc&limit=10'
req = Request(q, headers={'apikey': srk, 'Authorization': 'Bearer ' + srk, 'Accept': 'application/json'})
rows = json.load(urlopen(req, timeout=10))
print(f'facebook_group rows: {len(rows)}')
for r in rows:
    landing = r.get('landing_url') or '(none)'
    print(f'  - {r["posted_at"]} -> {landing[:80]}')
