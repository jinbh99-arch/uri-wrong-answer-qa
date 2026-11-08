#!/usr/bin/env python3
"""Fetch only the PUBLIC MOE 2022-33 subject ZIP and audit file identity metadata.
Do not commit the downloaded ZIP or its annex content to the public QA repo.
No child data, no credentials, no remote upload. Failure leaves G14 unverified.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import urllib.request
import zipfile

URL = "https://www.moe.go.kr/boardCnts/fileDown.do?fileSeq=1512facbda6c234a1641ac7e9c156ca2&m=&s=moe"
OUT = Path("source-snapshot-output/qa23-official-source-probe.json")
MAX = 24 * 1024 * 1024

def run():
    result = {
        "version": "qa23-public-source-probe-v01",
        "download_url": URL,
        "official_notice_url": "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=141&boardSeq=93458&lev=0&statusYN=W",
        "official_source_binary_verified": False,
        "official_math_annex_text_compared": False,
        "children_data_included": False,
        "status": "NOT_CHECKED"
    }
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (compatible; QA-Source-Provenance/1.0)", "Accept": "*/*"})
        with urllib.request.urlopen(req, timeout=30) as response:
            chunks = []
            total = 0
            while True:
                data = response.read(1024 * 1024)
                if not data:
                    break
                total += len(data)
                if total > MAX:
                    raise RuntimeError("Official ZIP exceeded 24 MiB safety limit")
                chunks.append(data)
            blob = b"".join(chunks)
            result["http_status"] = response.status
            result["media_type"] = response.headers.get("Content-Type")
        if not zipfile.is_zipfile(io.BytesIO(blob)):
            raise RuntimeError("Downloaded response is not a valid ZIP")
        with zipfile.ZipFile(io.BytesIO(blob)) as archive:
            members = [
                {"path": item.filename, "bytes": item.file_size, "extension": Path(item.filename).suffix.lower()}
                for item in archive.infolist() if not item.is_dir()
            ]
            if len(members) > 100 or sum(x["bytes"] for x in members) > 100 * 1024 * 1024:
                raise RuntimeError("Archive members exceed safe metadata limits")
            result.update({
                "status": "OFFICIAL_ZIP_FETCHED_METADATA_ONLY",
                "bytes": len(blob),
                "zip_sha256": hashlib.sha256(blob).hexdigest(),
                "files": members,
                "official_source_binary_verified": True,
            })
    except Exception as e:
        result.update({"status": "OFFICIAL_FETCH_NOT_VERIFIED", "error_type": type(e).__name__, "error": str(e)[:250]})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("QA23_PUBLIC_MOE_SOURCE=" + json.dumps(result, ensure_ascii=False))
    # This is a research probe, NOT a release gate or successful G14 completion.
    return 0

if __name__ == "__main__":
    sys.exit(run())
