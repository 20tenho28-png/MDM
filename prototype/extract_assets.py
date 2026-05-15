#!/usr/bin/env python3
"""
One-shot extractor for the MDM Assist MHTML snapshot.

Reads the multipart MHTML envelope, decodes each base64-encoded binary
part, and writes the brand-relevant images into prototype/assets/.

Run once after dropping a new snapshot into the uploads/ folder:

    python3 prototype/extract_assets.py [path/to/snapshot.mhtml]

If no path is given, defaults to the snapshot used for the v2 build.
"""
from __future__ import annotations

import base64
import os
import re
import sys
from pathlib import Path

DEFAULT_SNAPSHOT = "/root/.claude/uploads/566db573-d62e-4cc2-a28d-3d9f59ae5aea/1c8062f3-MDM_Assist_1"
OUT_DIR = Path(__file__).resolve().parent / "assets"

WANTED = {
    "mdm-logo-original": "mdm-logo-original.png",
    "mdm-logo-mono-bg": "mdm-logo-mono-bg.png",
    "mitsubishi-electric-logo": "mitsubishi-electric-logo.png",
    "mdm-qr-whatsapp": "mdm-qr-whatsapp.png",
    "mdm-service-hvac-electrical": "mdm-service-hvac-electrical.webp",
    "mdm-contact-operations": "mdm-contact-operations.webp",
}


def main(snapshot_path: str) -> int:
    raw = Path(snapshot_path).read_bytes()

    boundary_match = re.search(rb'boundary="([^"]+)"', raw)
    if not boundary_match:
        print("ERROR: could not find multipart boundary", file=sys.stderr)
        return 1
    boundary = b"--" + boundary_match.group(1)

    parts = raw.split(boundary)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    written = 0
    for part in parts:
        if b"Content-Type: image/" not in part:
            continue

        header_blob, _, body = part.partition(b"\r\n\r\n")
        if not body:
            header_blob, _, body = part.partition(b"\n\n")
        if not body:
            continue

        loc_match = re.search(rb"Content-Location:\s*(\S+)", header_blob)
        enc_match = re.search(rb"Content-Transfer-Encoding:\s*(\S+)", header_blob, re.I)
        if not loc_match:
            continue

        location = loc_match.group(1).decode("ascii", errors="ignore")
        url_basename = location.rsplit("/", 1)[-1].split("?", 1)[0]
        stem_no_hash = re.sub(r"_[0-9a-f]{6,}\.[A-Za-z0-9]+$", "", url_basename)
        stem_no_uuid = re.sub(r"-[A-Za-z0-9]{18,}\.[A-Za-z0-9]+$", "", stem_no_hash)
        key = stem_no_uuid

        target_name = WANTED.get(key)
        if not target_name:
            continue

        encoding = enc_match.group(1).decode().lower() if enc_match else "base64"
        body = body.rstrip(b"\r\n-")

        if encoding == "base64":
            try:
                decoded = base64.b64decode(re.sub(rb"\s+", b"", body), validate=False)
            except Exception as exc:
                print(f"  skip {target_name}: base64 decode failed ({exc})", file=sys.stderr)
                continue
        else:
            decoded = body

        out_path = OUT_DIR / target_name
        out_path.write_bytes(decoded)
        print(f"  wrote {out_path}  ({len(decoded):,} bytes)")
        written += 1

    print(f"\nDone. {written} asset(s) written to {OUT_DIR}/")
    return 0 if written == len(WANTED) else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SNAPSHOT))
