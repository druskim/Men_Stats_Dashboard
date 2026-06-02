#!/usr/bin/env python3
"""
build_local.py  —  creates standalone single-file HTML dashboards for local use.

Usage (from repo root):
    python build_local.py          # builds both 2026 and opponents
    python build_local.py 2026     # builds only 2026
    python build_local.py opp      # builds only opponents
"""

import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))

DASHBOARDS = [
    {
        'key':    '2026',
        'name':   '2026',
        'dir':    os.path.join(ROOT, '2026'),
        'output': os.path.join(ROOT, '2026_local.html'),
    },
    {
        'key':    'opp',
        'name':   'opponents',
        'dir':    os.path.join(ROOT, 'opponents'),
        'output': os.path.join(ROOT, 'opponents_local.html'),
    },
]

# Temp vite config that sets base to './' so all asset URLs are relative.
LOCAL_CONFIG = """\
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
})
"""


def run(cmd, cwd):
    print(f"    $ {cmd}")
    result = subprocess.run(cmd, cwd=cwd, shell=True, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if result.returncode != 0:
        print(result.stdout)
        sys.exit(f"Command failed (exit {result.returncode})")


def build_dashboard(db):
    d = db['dir']
    cfg_path = os.path.join(d, '_vite.config.local.js')
    try:
        with open(cfg_path, 'w', encoding='utf-8') as f:
            f.write(LOCAL_CONFIG)

        # Re-aggregate data so the embedded TSV is always current.
        run('node scripts/aggregate.js', cwd=d)

        # Build with the local config (relative base, no GitHub prefix).
        run('npx vite build --config _vite.config.local.js', cwd=d)
    finally:
        if os.path.exists(cfg_path):
            os.remove(cfg_path)


def inline_dashboard(db):
    d    = db['dir']
    dist = os.path.join(d, 'dist')

    # ── Read built HTML ──────────────────────────────────────────────────────
    with open(os.path.join(dist, 'index.html'), encoding='utf-8') as f:
        html = f.read()

    # ── Inline CSS ───────────────────────────────────────────────────────────
    def replace_css(m):
        href = m.group(1)
        css_path = os.path.join(dist, href.lstrip('./').replace('/', os.sep))
        with open(css_path, encoding='utf-8') as f:
            return f'<style>{f.read()}</style>'

    html = re.sub(
        r'<link[^>]+href="(\./assets/[^"]+\.css)"[^>]*>',
        replace_css, html
    )

    # ── Inline JS ────────────────────────────────────────────────────────────
    def replace_js(m):
        src = m.group(1)
        js_path = os.path.join(dist, src.lstrip('./').replace('/', os.sep))
        with open(js_path, encoding='utf-8') as f:
            return f'<script type="module">{f.read()}</script>'

    html = re.sub(
        r'<script[^>]+src="(\./assets/[^"]+\.js)"[^>]*></script>',
        replace_js, html
    )

    # ── Embed TSV + fetch interceptor ────────────────────────────────────────
    tsv_path = os.path.join(d, 'public', 'data.tsv')
    with open(tsv_path, encoding='utf-8') as f:
        tsv_data = f.read()

    # Intercept any fetch() call whose URL contains 'data.tsv' and return the
    # embedded string instead.  new Response(string) is supported in all
    # modern browsers and gives a .text() method that returns a Promise.
    interceptor = (
        '<script>(function(){'
        f'var d={json.dumps(tsv_data)};'
        'var orig=window.fetch;'
        'window.fetch=function(u,a){'
        'if(String(u).includes("data.tsv"))return Promise.resolve(new Response(d));'
        'return orig.apply(this,arguments);'
        '}})();</script>'
    )
    html = html.replace('</head>', interceptor + '\n</head>')

    # ── Write output ─────────────────────────────────────────────────────────
    with open(db['output'], 'w', encoding='utf-8') as f:
        f.write(html)

    size_mb = os.path.getsize(db['output']) / 1024 / 1024
    print(f"  -> {db['output']}  ({size_mb:.1f} MB)")


# ── Entry point ──────────────────────────────────────────────────────────────

args = sys.argv[1:]
if args:
    selected = [db for db in DASHBOARDS if any(a in (db['key'], db['name']) for a in args)]
    if not selected:
        sys.exit(f"Unknown dashboard(s): {args}. Valid keys: {[d['key'] for d in DASHBOARDS]}")
else:
    selected = DASHBOARDS

for db in selected:
    print(f"\n-- {db['name']} ------------------------------------------")
    build_dashboard(db)
    inline_dashboard(db)

print("\nDone. Open the HTML file(s) directly in your browser.")
