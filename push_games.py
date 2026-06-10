#!/usr/bin/env python3
"""
push_games.py — aggregates new .xlsx game files into data.tsv and pushes to GitHub.

Usage (from repo root):
    python push_games.py
"""

import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.abspath(__file__))

# Maps each game directory to the dashboard root that owns it
DASHBOARDS = {
    os.path.join("2026", "public", "games"):       "2026",
    os.path.join("opponents", "public", "games"):  "opponents",
}

GAME_DIRS = list(DASHBOARDS.keys())


def run(cmd, cwd=ROOT, check=True):
    result = subprocess.run(cmd, cwd=cwd, shell=True, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode != 0:
        print(result.stderr or result.stdout)
        sys.exit(f"Command failed: {cmd}")
    return result.stdout.strip()


def get_new_game_files():
    raw = run("git status --porcelain")
    new_files = []
    for line in raw.splitlines():
        status = line[:2].strip()
        path = line[3:].strip().strip('"')
        if status == "??" and path.endswith(".xlsx"):
            if any(path.replace("\\", "/").startswith(d.replace("\\", "/")) for d in GAME_DIRS):
                new_files.append(path)
    return new_files


files = get_new_game_files()

if not files:
    print("No new game files found. Nothing to push.")
    sys.exit(0)

print("New game files detected:")
for f in files:
    print(f"  {f}")

# Determine which dashboards need re-aggregation
affected = set()
for f in files:
    for game_dir, dashboard in DASHBOARDS.items():
        if f.replace("\\", "/").startswith(game_dir.replace("\\", "/")):
            affected.add(dashboard)

# Re-aggregate each affected dashboard and stage the updated data.tsv
for dashboard in sorted(affected):
    dash_dir = os.path.join(ROOT, dashboard)
    print(f"\nAggregating {dashboard}...")
    run("node scripts/aggregate.js", cwd=dash_dir)
    tsv_path = os.path.join(dashboard, "public", "data.tsv")
    run(f'git add "{tsv_path}"')
    print(f"  Staged {tsv_path}")

# Stage the new game files
for f in files:
    run(f'git add "{f}"')

names = [os.path.splitext(os.path.basename(f))[0].replace("_", " ") for f in files]
summary = ", ".join(names)
commit_msg = f"Add game data: {summary}"

run(f'git commit -m "{commit_msg}"')
print(f"\nCommitted: {commit_msg}")

run("git push")
print("Pushed to GitHub.")
