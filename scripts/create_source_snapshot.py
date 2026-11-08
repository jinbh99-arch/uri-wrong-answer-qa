#!/usr/bin/env python3
"""Create a checked source-only archive for the public isolated QA repository.

No browser IndexedDB, child records, photos, passwords, credentials or runtime
directories are included. This is NOT an application-data backup.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile
from datetime import datetime, timezone


def allowed(path: str) -> bool:
    if path in {"index.html", "check.html", "README.md"}:
        return True
    if re.fullmatch(r"QA[0-9]+[^/]*\.md", path):
        return True
    if re.fullmatch(r"tests/[A-Za-z0-9_.-]+\.(?:mjs|py)", path):
        return True
    if re.fullmatch(r"scripts/[A-Za-z0-9_.-]+\.(?:py|mjs)", path):
        return True
    if re.fullmatch(r"data/[A-Za-z0-9_.-]+\.json", path):
        return True
    if re.fullmatch(r"db/[A-Za-z0-9_.-]+\.sql", path):
        return True
    if re.fullmatch(r"docs/[^/\x00]+\.md", path):
        return True
    if re.fullmatch(r"\.github/workflows/[A-Za-z0-9_.-]+\.ya?ml", path):
        return True
    return False


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=root)


def collect(root: Path) -> list[tuple[str, bytes]]:
    tracked = git(root, "ls-files", "-z").split(b"\0")
    result: list[tuple[str, bytes]] = []
    total = 0
    for raw in tracked:
        if not raw:
            continue
        name = os.fsdecode(raw).replace("\\", "/")
        if not allowed(name):
            continue
        source = root / name
        if source.is_symlink() or not source.is_file():
            raise RuntimeError("Missing/unsafe tracked source file: " + name)
        if source.stat().st_size > 16 * 1024 * 1024:
            raise RuntimeError("Unexpectedly large source file: " + name)
        body = source.read_bytes()
        total += len(body)
        if total > 40 * 1024 * 1024:
            raise RuntimeError("Source archive exceeds safe maximum")
        result.append((name, body))
    names = {name for name, _ in result}
    required = {"index.html", "check.html", "README.md", "tests/qa-e2e.mjs",
                "scripts/qa-family-gateway.mjs", "scripts/qa-inapp-sync-bridge.mjs",
                "scripts/qa-family-merge-preflight.mjs",
                "db/qa39_family_rls.sql", "scripts/qa39-tenant-store.mjs",
                "tests/qa39-postgres-tenant.mjs",
                "docs/QA39_G15_PostgreSQL_가족격리_실운영인계_v0.1.md",
                "docs/QA39_G16_학습효과_사전등록_검토본_v0.2.md",
                "scripts/qa40-oidc-resolver.mjs", "tests/qa40-oidc-postgres.mjs",
                "docs/QA40_G15_서명JWT_보호자RLS_연동검증_v0.1.md"}
    if not required.issubset(names):
        raise RuntimeError("Required application/test files missing: " + str(required - names))
    return sorted(result)


def create(root: Path, dest: Path) -> Path:
    items = collect(root)
    commit = git(root, "rev-parse", "HEAD").decode("ascii").strip()
    title = (root / "index.html").read_text(encoding="utf-8", errors="replace")[:2000]
    matched = re.search(r"<title[^>]*>[^<]*?(v\d+(?:\.\d+)+)", title, re.I)
    version = matched.group(1) if matched else "unknown-version"
    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%d")
    dest.mkdir(parents=True, exist_ok=True)
    output = dest / f"uri-wrong-answer-qa_source_{version}_{stamp}_{commit[:12]}.zip"
    details = [{"path": name, "size": len(body), "sha256": sha256(body)} for name, body in items]
    manifest = {
        "schema": "source-snapshot-v1",
        "project": "uri-wrong-answer-qa",
        "source_commit": commit,
        "version_in_page_title": version,
        "captured_at_utc": now.isoformat(),
        "source_file_count": len(items),
        "files": details,
        "important": "Source-only public isolated QA archive. NOT a backup of IndexedDB, photos or real student records.",
    }
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    checksums = "".join(f"{row['sha256']}  source/{row['path']}\n" for row in details).encode("utf-8")
    readme = (
        "ISOLATED QA SOURCE SNAPSHOT — NOT USER DATA\n"
        "Restore safely: extract into a separate directory, verify each source file\n"
        "against MANIFEST.json/SHA256SUMS.txt, review the code and rerun QA tests.\n"
        "Never overwrite a running Netlify service or browser data without approval.\n"
        "GitHub Actions artifact copies expire; also store a downloaded ZIP outside GitHub.\n"
        f"Source commit: {commit}\n"
    ).encode("utf-8")

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.writestr("snapshot/MANIFEST.json", manifest_bytes)
        z.writestr("snapshot/SHA256SUMS.txt", checksums)
        z.writestr("snapshot/RECOVERY.txt", readme)
        for name, body in items:
            z.writestr("snapshot/source/" + name, body)

    with zipfile.ZipFile(output, "r") as z:
        if z.testzip() is not None:
            raise RuntimeError("Archive CRC check failed")
        for row in details:
            body = z.read("snapshot/source/" + row["path"])
            if len(body) != row["size"] or sha256(body) != row["sha256"]:
                raise RuntimeError("Archive verification failed: " + row["path"])

    digest = sha256(output.read_bytes())
    digest_path = dest / (output.name + ".sha256")
    digest_path.write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    print(json.dumps({
        "status": "verified", "commit": commit, "version": version,
        "file_count": len(items), "archive": str(output),
        "sha256": digest, "checksum_file": str(digest_path)
    }, ensure_ascii=False))
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default="source-snapshot-output")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    dest = Path(args.output_dir)
    if not dest.is_absolute():
        dest = root / dest
    create(root, dest)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Snapshot failed: {error}", file=sys.stderr)
        sys.exit(1)
