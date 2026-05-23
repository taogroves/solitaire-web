#!/usr/bin/env python3
"""Build assets/cards/backs-manifest.json from assets/cards/backs/<style>/*.svg"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKS = ROOT / "assets" / "cards" / "backs"
OUT = ROOT / "assets" / "cards" / "backs-manifest.json"

designs = []
for style_dir in sorted(BACKS.iterdir()):
    if not style_dir.is_dir():
        continue
    variants = []
    for svg in sorted(style_dir.glob("*.svg")):
        cid = svg.stem
        variants.append(
            {
                "id": cid,
                "name": cid.replace("-", " ").title(),
                "file": f"{style_dir.name}/{svg.name}",
            }
        )
    if not variants:
        continue
    designs.append(
        {
            "id": style_dir.name,
            "name": style_dir.name.replace("-", " ").title(),
            "defaultColor": variants[0]["id"],
            "colors": [v["id"] for v in variants],
            "variants": variants,
        }
    )

OUT.write_text(json.dumps({"designs": designs}, indent=2), encoding="utf-8")
print(f"Wrote {len(designs)} styles to {OUT}")
