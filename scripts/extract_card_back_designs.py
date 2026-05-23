#!/usr/bin/env python3
"""
Extract borderless playing-card back designs from PLAYING_CARD_BACKS.svg.

The source SVG is an Inkscape artboard, not a regular sprite sheet. Each back is
stored as a top-level <g> with its own transforms and a mix of useful design
elements plus white card bases, strokes, and miscellaneous border rectangles.

This script uses the stable group ids in the source file, keeps only the
interior design elements, normalizes each result to its own viewBox, and writes:

    assets/cards/backs/<style>/<color>.svg
    assets/cards/backs/back-designs-manifest.json

Run from the repository root:

    python3 scripts/extract_card_back_designs.py

Use --clean to remove previously generated style folders before writing.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import xml.etree.ElementTree as ET
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parent.parent
SOURCE_SVG = ROOT / "scripts" / "PLAYING_CARD_BACKS.svg"
OUTPUT_DIR = ROOT / "assets" / "cards" / "backs"
MANIFEST_PATH = OUTPUT_DIR / "back-designs-manifest.json"

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape"
SODIPODI_NS = "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"

ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK_NS)
ET.register_namespace("inkscape", INKSCAPE_NS)
ET.register_namespace("sodipodi", SODIPODI_NS)


@dataclass(frozen=True)
class BackDesign:
    group_id: str
    style_id: str
    style_name: str
    color_id: str
    color_name: str


BACKS: tuple[BackDesign, ...] = (
    BackDesign("g6706", "diamond-lattice", "Diamond Lattice", "navy-blue", "Navy Blue"),
    BackDesign("g58135", "diamond-lattice", "Diamond Lattice", "dark-red", "Dark Red"),
    BackDesign("g33544", "wavy-stripe", "Wavy Stripe", "red", "Red"),
    BackDesign("g33537", "wavy-stripe", "Wavy Stripe", "teal", "Teal"),
    BackDesign("g33566", "solid-fill", "Solid Fill", "teal", "Teal"),
    BackDesign("g33582", "solid-fill", "Solid Fill", "purple", "Purple"),
    BackDesign("g56811", "solid-fill", "Solid Fill", "gold", "Gold"),
    BackDesign("g33574", "solid-fill", "Solid Fill", "green", "Green"),
    BackDesign("g33590", "solid-fill", "Solid Fill", "black", "Black"),
    BackDesign("g33556", "solid-fill", "Solid Fill", "red", "Red"),
    BackDesign("g46577", "gingham-checkerboard", "Gingham / Checkerboard", "light-blue", "Light Blue"),
    BackDesign("g46584", "gingham-checkerboard", "Gingham / Checkerboard", "pink", "Pink"),
    BackDesign("g26234", "floral-rosette", "Floral Rosette", "pale-green", "Pale Green"),
    BackDesign("g36640", "floral-rosette", "Floral Rosette", "yellow-green", "Yellow Green"),
    BackDesign("g47972", "dense-floral-tessellation", "Dense Floral Tessellation", "dark-green-yellow", "Dark Green / Yellow"),
    BackDesign("g47921", "dense-floral-tessellation", "Dense Floral Tessellation", "teal-green", "Teal / Green"),
    BackDesign("g47790", "dense-floral-tessellation", "Dense Floral Tessellation", "yellow-green", "Yellow / Green"),
    BackDesign("g47254", "diagonal-dash-pattern", "Diagonal Dash Pattern", "purple", "Purple"),
    BackDesign("g47242", "diagonal-dash-pattern", "Diagonal Dash Pattern", "gold", "Gold"),
    BackDesign("g47238", "diagonal-dash-pattern", "Diagonal Dash Pattern", "green", "Green"),
    BackDesign("g47250", "diagonal-dash-pattern", "Diagonal Dash Pattern", "black", "Black"),
    BackDesign("g47230", "diagonal-dash-pattern", "Diagonal Dash Pattern", "red", "Red"),
    BackDesign("g47234", "diagonal-dash-pattern", "Diagonal Dash Pattern", "blue", "Blue"),
    BackDesign("g12852", "cross-line-minimal", "Cross-Line Minimal", "dark-red", "Dark Red"),
    BackDesign("g12860", "cross-line-minimal", "Cross-Line Minimal", "teal", "Teal"),
    BackDesign("g12868", "cross-line-minimal", "Cross-Line Minimal", "black", "Black"),
    BackDesign("g12827", "cross-line-minimal", "Cross-Line Minimal", "green", "Green"),
)

GENERATED_STYLE_DIRS = {back.style_id for back in BACKS}


Matrix = tuple[float, float, float, float, float, float]
IDENTITY: Matrix = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def parse_style(style: str | None) -> dict[str, str]:
    values: dict[str, str] = {}
    for part in (style or "").split(";"):
        if ":" in part:
            key, value = part.split(":", 1)
            values[key.strip()] = value.strip()
    return values


def style_to_string(values: dict[str, str]) -> str:
    return ";".join(f"{key}:{value}" for key, value in values.items())


def get_style_value(elem: ET.Element, name: str) -> str | None:
    return parse_style(elem.get("style")).get(name) or elem.get(name)


def set_style_value(elem: ET.Element, name: str, value: str) -> None:
    style = parse_style(elem.get("style"))
    style[name] = value
    elem.set("style", style_to_string(style))
    elem.attrib.pop(name, None)


def multiply(left: Matrix, right: Matrix) -> Matrix:
    a, b, c, d, e, f = left
    g, h, i, j, k, l = right
    return (
        a * g + c * h,
        b * g + d * h,
        a * i + c * j,
        b * i + d * j,
        a * k + c * l + e,
        b * k + d * l + f,
    )


def transform_point(matrix: Matrix, x: float, y: float) -> tuple[float, float]:
    a, b, c, d, e, f = matrix
    return a * x + c * y + e, b * x + d * y + f


def parse_transform(transform: str | None) -> Matrix:
    matrix = IDENTITY
    for name, raw_args in re.findall(r"(matrix|translate|scale)\(([^)]*)\)", transform or ""):
        args = [float(value) for value in re.split(r"[\s,]+", raw_args.strip()) if value]
        if name == "matrix" and len(args) >= 6:
            next_matrix: Matrix = tuple(args[:6])  # type: ignore[assignment]
        elif name == "translate" and args:
            next_matrix = (1.0, 0.0, 0.0, 1.0, args[0], args[1] if len(args) > 1 else 0.0)
        elif name == "scale" and args:
            next_matrix = (args[0], 0.0, 0.0, args[1] if len(args) > 1 else args[0], 0.0, 0.0)
        else:
            continue
        matrix = multiply(matrix, next_matrix)
    return matrix


def matrix_to_svg(matrix: Matrix) -> str:
    return "matrix({:.8g} {:.8g} {:.8g} {:.8g} {:.8g} {:.8g})".format(*matrix)


def rect_bbox(elem: ET.Element, matrix: Matrix) -> tuple[float, float, float, float] | None:
    if local_name(elem.tag) != "rect":
        return None

    try:
        x = float(elem.get("x", "0"))
        y = float(elem.get("y", "0"))
        width = float(elem.get("width", "0"))
        height = float(elem.get("height", "0"))
    except ValueError:
        return None

    points = (
        transform_point(matrix, x, y),
        transform_point(matrix, x + width, y),
        transform_point(matrix, x, y + height),
        transform_point(matrix, x + width, y + height),
    )
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), min(ys), max(xs), max(ys)


def is_design_element(elem: ET.Element, group: ET.Element) -> bool:
    tag = local_name(elem.tag)
    fill = (get_style_value(elem, "fill") or "").lower()
    stroke = (get_style_value(elem, "stroke") or "").lower()

    if tag == "rect":
        if fill.startswith("url(#"):
            return True
        return bool(fill.startswith("#") and fill != "#ffffff")

    if tag == "path" and group.get("id") in {"g12852", "g12860", "g12868", "g12827"}:
        return stroke.startswith("#") and stroke != "none"

    return False


def iter_design_elements(
    group: ET.Element,
    matrix: Matrix = IDENTITY,
) -> Iterable[tuple[ET.Element, Matrix, tuple[float, float, float, float]]]:
    matrix = multiply(matrix, parse_transform(group.get("transform")))
    for child in list(group):
        child_matrix = multiply(matrix, parse_transform(child.get("transform")))
        if is_design_element(child, group):
            bbox = rect_bbox(child, child_matrix)
            if bbox is None:
                # Cross-line paths are intentionally kept with their colored
                # background rect, so they do not need to expand the viewBox.
                bbox = (0.0, 0.0, 0.0, 0.0)
            yield child, child_matrix, bbox
        yield from iter_design_elements(child, matrix)


def refs_in_text(text: str | None) -> set[str]:
    return set(re.findall(r"url\(#([^)]+)\)", text or ""))


def direct_refs(elem: ET.Element) -> set[str]:
    refs: set[str] = set()
    for value in elem.attrib.values():
        refs.update(refs_in_text(value))
        if value.startswith("#"):
            refs.add(value[1:])
    refs.update(refs_in_text(elem.text))
    return refs


def collect_referenced_def_ids(elements: Iterable[ET.Element], id_map: dict[str, ET.Element]) -> set[str]:
    needed: set[str] = set()
    pending: list[str] = []

    for elem in elements:
        for ref in direct_refs(elem):
            if ref not in needed:
                needed.add(ref)
                pending.append(ref)

    while pending:
        ref = pending.pop()
        elem = id_map.get(ref)
        if elem is None:
            continue
        for descendant in elem.iter():
            for nested_ref in direct_refs(descendant):
                if nested_ref not in needed:
                    needed.add(nested_ref)
                    pending.append(nested_ref)

    return needed


def make_defs(root: ET.Element, needed_ids: set[str]) -> ET.Element | None:
    if not needed_ids:
        return None

    defs = ET.Element(f"{{{SVG_NS}}}defs")
    for child in root:
        if local_name(child.tag) != "defs":
            continue
        for item in list(child):
            if item.get("id") in needed_ids:
                defs.append(deepcopy(item))

    return defs if list(defs) else None


def clone_element(elem: ET.Element) -> ET.Element:
    clone = deepcopy(elem)
    clone.attrib.pop("transform", None)
    clone.attrib.pop(f"{{{INKSCAPE_NS}}}export-filename", None)
    clone.attrib.pop(f"{{{INKSCAPE_NS}}}export-xdpi", None)
    clone.attrib.pop(f"{{{INKSCAPE_NS}}}export-ydpi", None)
    set_style_value(clone, "stroke", "none") if local_name(clone.tag) == "rect" else None
    return clone


def write_design(root: ET.Element, id_map: dict[str, ET.Element], back: BackDesign) -> dict[str, str]:
    group = id_map.get(back.group_id)
    if group is None:
        raise ValueError(f"Missing expected group id: {back.group_id}")

    selected = list(iter_design_elements(group))
    if not selected:
        raise ValueError(f"No design elements found in {back.group_id}")

    rect_boxes = [bbox for _, _, bbox in selected if bbox != (0.0, 0.0, 0.0, 0.0)]
    min_x = min(box[0] for box in rect_boxes)
    min_y = min(box[1] for box in rect_boxes)
    max_x = max(box[2] for box in rect_boxes)
    max_y = max(box[3] for box in rect_boxes)
    width = max_x - min_x
    height = max_y - min_y

    svg = ET.Element(
        f"{{{SVG_NS}}}svg",
        {
            "viewBox": f"0 0 {width:.4f} {height:.4f}",
            "width": f"{width:.4f}",
            "height": f"{height:.4f}",
        },
    )

    cloned_elements = [clone_element(elem) for elem, _, _ in selected]
    defs = make_defs(root, collect_referenced_def_ids(cloned_elements, id_map))
    if defs is not None:
        svg.append(defs)

    for clone, (_, matrix, _) in zip(cloned_elements, selected):
        wrapper = ET.SubElement(svg, f"{{{SVG_NS}}}g")
        wrapper.set("transform", matrix_to_svg(multiply((1.0, 0.0, 0.0, 1.0, -min_x, -min_y), matrix)))
        wrapper.append(clone)

    style_dir = OUTPUT_DIR / back.style_id
    style_dir.mkdir(parents=True, exist_ok=True)
    output_path = style_dir / f"{back.color_id}.svg"
    ET.ElementTree(svg).write(output_path, encoding="utf-8", xml_declaration=True)

    return {
        "id": back.color_id,
        "name": back.color_name,
        "file": f"{back.style_id}/{back.color_id}.svg",
    }


def clean_output() -> None:
    for style_id in GENERATED_STYLE_DIRS:
        path = OUTPUT_DIR / style_id
        if path.is_dir():
            shutil.rmtree(path)
    if MANIFEST_PATH.exists():
        MANIFEST_PATH.unlink()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE_SVG, help="Source PLAYING_CARD_BACKS.svg path.")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR, help="Directory to write style folders into.")
    parser.add_argument("--clean", action="store_true", help="Remove generated style folders before writing.")
    return parser.parse_args()


def main() -> None:
    global OUTPUT_DIR, MANIFEST_PATH

    args = parse_args()
    OUTPUT_DIR = args.output_dir
    MANIFEST_PATH = OUTPUT_DIR / "back-designs-manifest.json"

    if args.clean:
        clean_output()

    root = ET.parse(args.source).getroot()
    id_map = {elem.get("id"): elem for elem in root.iter() if elem.get("id")}
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, list[dict[str, object]]] = {"designs": []}
    by_style: dict[str, dict[str, object]] = {}

    for back in BACKS:
        variant = write_design(root, id_map, back)
        style = by_style.setdefault(
            back.style_id,
            {
                "id": back.style_id,
                "name": back.style_name,
                "defaultColor": back.color_id,
                "colors": [],
                "variants": [],
            },
        )
        style["colors"].append(back.color_id)  # type: ignore[index, union-attr]
        style["variants"].append(variant)  # type: ignore[index, union-attr]

    seen_styles: set[str] = set()
    for back in BACKS:
        if back.style_id in seen_styles:
            continue
        seen_styles.add(back.style_id)
        manifest["designs"].append(by_style[back.style_id])

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    total = sum(len(style["colors"]) for style in manifest["designs"])
    print(f"Wrote {total} borderless back designs into {OUTPUT_DIR}")
    print(f"Wrote manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
