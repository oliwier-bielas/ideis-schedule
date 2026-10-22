"""Test pushes only against a disposable local repository, never GitHub."""
from pathlib import Path
import subprocess
import tempfile
import unittest

from keepalive import git, keepalive, MESSAGE


class KeepaliveTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        self.remote = root / "remote.git"
        self.repo = root / "checkout"
        subprocess.run(["git", "init", "--bare", str(self.remote)], check=True, capture_output=True)
        subprocess.run(["git", "init", "-b", "main", str(self.repo)], check=True, capture_output=True)
        git(self.repo, "-c", "user.name=Test", "-c", "user.email=test@example.com",
            "commit", "--allow-empty", "-m", "Initial")
        git(self.repo, "remote", "add", "origin", str(self.remote))
        git(self.repo, "push", "origin", "main")

    def test_dry_run_does_not_change_history(self):
        before = git(self.repo, "rev-parse", "HEAD")
        keepalive(self.repo)
        self.assertEqual(git(self.repo, "rev-parse", "HEAD"), before)

    def test_push_creates_an_empty_commit_on_the_same_tree(self):
        before_tree = git(self.repo, "rev-parse", "HEAD^{tree}")
        keepalive(self.repo, "main", push=True)
        self.assertEqual(git(self.repo, "rev-parse", "HEAD^{tree}"), before_tree)
        self.assertEqual(git(self.repo, "log", "-1", "--format=%s"), MESSAGE)
        self.assertEqual(git(self.remote, "rev-parse", "main"), git(self.repo, "rev-parse", "HEAD"))

    def test_existing_changes_and_wrong_branch_are_preserved(self):
        before = git(self.repo, "rev-parse", "HEAD")
        (self.repo / "work.txt").write_text("User work", encoding="utf-8")
        with self.assertRaises(ValueError):
            keepalive(self.repo, "main", push=True)
        with self.assertRaises(ValueError):
            keepalive(self.repo, "other", push=True)
        self.assertEqual(git(self.repo, "rev-parse", "HEAD"), before)


if __name__ == "__main__":
    unittest.main()
