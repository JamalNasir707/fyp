#!/usr/bin/env python3
"""
backdate_commits.py

Creates N commits on a test file with random timestamps between a start date
(default: 2026-09-01) and now. Commits are made in chronological order so the
history stays linear and clean.

Usage examples:
    python backdate_commits.py -n 40
    python backdate_commits.py -n 100 --start 2026-09-10 --end 2026-10-30
    python backdate_commits.py -n 25 --repo ./my-test-repo --push
    python backdate_commits.py -n 30 --dry-run

Run it inside a git repo (or pass --repo). If the folder isn't a repo yet,
the script will run `git init` for you.
"""

import argparse
import os
import random
import subprocess
import sys
from datetime import datetime, timedelta, timezone

# Asia/Karachi (UTC+05:00). Change if you want another offset.
TZ = timezone(timedelta(hours=5))

MESSAGES = [
    "update test file",
    "add more content",
    "fix typo",
    "refactor notes",
    "tweak formatting",
    "add new line",
    "minor cleanup",
    "improve wording",
    "save progress",
    "small update",
    "add example text",
    "clean up whitespace",
    "update notes",
    "work in progress",
    "polish content",
]


def run(cmd, cwd, env=None, check=True):
    return subprocess.run(
        cmd, cwd=cwd, env=env, check=check,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )


def ensure_repo(repo):
    os.makedirs(repo, exist_ok=True)
    inside = run(["git", "rev-parse", "--is-inside-work-tree"], repo, check=False)
    if inside.returncode != 0:
        print(f"[info] {repo} is not a git repo, running git init")
        run(["git", "init"], repo)


def random_timestamps(n, start, end):
    """Return n random datetimes in [start, end], sorted oldest to newest."""
    span = int((end - start).total_seconds())
    if span <= 0:
        sys.exit("[error] start date must be before end date")
    stamps = [start + timedelta(seconds=random.randint(0, span)) for _ in range(n)]
    stamps.sort()
    return stamps


def parse_date(value, end_of_day=False):
    d = datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=TZ)
    return d + timedelta(hours=23, minutes=59, seconds=59) if end_of_day else d


def main():
    p = argparse.ArgumentParser(description="Create backdated commits on a test file.")
    p.add_argument("-n", "--commits", type=int, required=True,
                   help="number of commits to create")
    p.add_argument("--start", default="2026-09-01",
                   help="start date YYYY-MM-DD (default: 2026-09-01)")
    p.add_argument("--end", default=None,
                   help="end date YYYY-MM-DD (default: now)")
    p.add_argument("--repo", default=".", help="path to the repo (default: .)")
    p.add_argument("--file", default="test.txt", help="file to modify (default: test.txt)")
    p.add_argument("--push", action="store_true", help="git push after committing")
    p.add_argument("--dry-run", action="store_true",
                   help="only print the timestamps, make no commits")
    args = p.parse_args()

    if args.commits < 1:
        sys.exit("[error] --commits must be at least 1")

    now = datetime.now(TZ)
    start = parse_date(args.start)
    end = parse_date(args.end, end_of_day=True) if args.end else now
    if end > now:          # never create commits in the future
        end = now

    stamps = random_timestamps(args.commits, start, end)

    if args.dry_run:
        print(f"[dry-run] {args.commits} commits between {start:%Y-%m-%d} and {end:%Y-%m-%d %H:%M}")
        for s in stamps:
            print("  ", s.strftime("%Y-%m-%d %H:%M:%S %z"))
        return

    repo = os.path.abspath(args.repo)
    ensure_repo(repo)
    target = os.path.join(repo, args.file)

    for i, ts in enumerate(stamps, 1):
        iso = ts.strftime("%Y-%m-%dT%H:%M:%S%z")
        with open(target, "a", encoding="utf-8") as f:
            f.write(f"Entry {i} - {iso} - {random.randint(1000, 9999)}\n")

        env = os.environ.copy()
        env["GIT_AUTHOR_DATE"] = iso
        env["GIT_COMMITTER_DATE"] = iso

        run(["git", "add", args.file], repo)
        msg = random.choice(MESSAGES)
        result = run(["git", "commit", "-m", msg], repo, env=env, check=False)
        if result.returncode != 0:
            print(f"[error] commit {i} failed:\n{result.stderr or result.stdout}")
            sys.exit(1)
        print(f"[{i}/{args.commits}] {iso}  {msg}")

    print(f"\nDone: {args.commits} commits created.")

    if args.push:
        print("[info] pushing...")
        push = run(["git", "push"], repo, check=False)
        print(push.stdout or push.stderr)
        if push.returncode != 0:
            print("[hint] if the push was rejected, try: git push --force-with-lease")
    else:
        print("Review with `git log --format='%h %ad %s' --date=iso`, then `git push`.")


if __name__ == "__main__":
    main()
