#!/usr/bin/env python3
"""Extract individual card SVGs from Vector Cards sprite sheets."""
import copy
import os
import xml.etree.ElementTree as ET

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'cards')
SPRITES = os.path.join(ROOT, 'sprites')
FACES = os.path.join(ROOT, 'faces')

SVG_NS = 'http://www.w3.org/2000/svg'
VIEWBOX = '0 0 238.11099 332.59947'

CARD_IDS = []
for suit in ('CLUB', 'DIAMOND', 'HEART', 'SPADE'):
    for r in range(1, 11):
        CARD_IDS.append(f'{suit}-{r}')
    CARD_IDS.append(f'{suit}-11-JACK')
    CARD_IDS.append(f'{suit}-12-QUEEN')
    CARD_IDS.append(f'{suit}-13-KING')

THEME_SPRITES = {
    'standard-color': 'standard-color.svg',
    'standard-grayscale': 'standard-grayscale.svg',
    'standard-black-white': 'standard-black-white.svg',
    'standard-inverted': 'standard-inverted.svg',
    'standard-platinum': 'standard-platinum.svg',
    'shiny-color': 'shiny-color.svg',
    'shiny-grayscale': 'shiny-grayscale.svg',
    'shiny-black-white': 'shiny-black-white.svg',
    'shiny-inverted': 'shiny-inverted.svg',
    'shiny-platinum': 'shiny-platinum.svg',
}


def find_by_id(elem, target_id):
    if elem.get('id') == target_id:
        return elem
    for child in elem:
        found = find_by_id(child, target_id)
        if found is not None:
            return found
    return None


def extract_theme(theme_id, sprite_name):
    sprite_path = os.path.join(SPRITES, sprite_name)
    out_dir = os.path.join(FACES, theme_id)
    os.makedirs(out_dir, exist_ok=True)

    tree = ET.parse(sprite_path)
    root = tree.getroot()
    defs = root.find(f'{{{SVG_NS}}}defs')

    count = 0
    for cid in CARD_IDS:
        group = find_by_id(root, cid)
        if group is None:
            print(f'  missing {cid} in {sprite_name}')
            continue

        svg = ET.Element(f'{{{SVG_NS}}}svg', {
            'xmlns': SVG_NS,
            'viewBox': VIEWBOX,
            'width': '238.111',
            'height': '332.599',
        })
        if defs is not None:
            svg.append(copy.deepcopy(defs))
        svg.append(copy.deepcopy(group))

        out_path = os.path.join(out_dir, f'{cid}.svg')
        ET.ElementTree(svg).write(out_path, encoding='utf-8', xml_declaration=True)
        count += 1

    print(f'{theme_id}: {count} cards -> {out_dir}')


def main():
    for theme_id, sprite in THEME_SPRITES.items():
        extract_theme(theme_id, sprite)


if __name__ == '__main__':
    main()
