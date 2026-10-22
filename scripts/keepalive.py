"""Create and optionally push an empty maintenance commit. Uses only Python's stdlib."""

import argparse
from pathlib import Path
import subprocess
import sys

MESSAGE = "chore: weekly schedule keepalive [skip ci]"


def git(repo, *arguments):
    return subprocess.run(
        ["git", "-C", str(repo), *arguments],
        check=True, capture_output=True, text=True, encoding="utf-8",
    ).stdout.strip()


def keepalive(repo, branch=None, push=False):
    current = git(repo, "branch", "--show-current")
    branch = branch or current
    if not current or current != branch:
        raise ValueError("Checkout the intended branch first; detached HEAD is not supported.")
    git(repo, "check-ref-format", "--branch", branch)
    if not push:
        print(f"Dry run: would push an empty keepalive commit to origin/{branch}. No changes made.")
        return
    if git(repo, "status", "--porcelain"):
        raise ValueError("Working tree is not clean. Refusing to include existing changes.")
    git(repo, "remote", "get-url", "origin")
    git(repo, "-c", "user.name=github-actions[bot]", "-c",
        "user.email=41898282+github-actions[bot]@users.noreply.github.com",
        "commit", "--allow-empty", "-m", MESSAGE)
    # Never amend history or force-push. A concurrent branch update safely rejects this push.
    git(repo, "push", "origin", f"HEAD:refs/heads/{branch}")
    print(f"Pushed an empty keepalive commit to {branch}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--branch", help="Expected checked-out branch (defaults to current).")
    parser.add_argument("--push", action="store_true", help="Actually create and push the commit.")
    args = parser.parse_args()
    try:
        keepalive(args.repo, args.branch, args.push)
    except (ValueError, subprocess.CalledProcessError) as error:
        print(f"Keepalive failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
