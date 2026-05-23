/**
 * Vector Playing Cards 3.2 — faces & folder-based backs
 * Copyright 2011,2021 Chris Aguilar — LGPL 3.0
 */
(function (global) {
  'use strict';

  const SUIT_PREFIX = {
    hearts: 'HEART',
    diamonds: 'DIAMOND',
    clubs: 'CLUB',
    spades: 'SPADE',
  };

  const SUIT_SYMBOL = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

  const FACE_STYLES = [
    { id: 'simple', name: 'Simple' },
    { id: 'color', name: 'Color' },
    { id: 'grayscale', name: 'Grayscale', filter: 'grayscale(1)' },
    { id: 'black-white', name: 'Black & White', filter: 'grayscale(1) contrast(1.35)' },
    { id: 'inverted', name: 'Inverted', filter: 'invert(1) hue-rotate(180deg)' },
    { id: 'platinum', name: 'Platinum', filter: 'sepia(0.35) saturate(0.5) brightness(1.08)' },
  ];

  const STORAGE_FACE = 'solitaire-face-style';
  const STORAGE_BACK_STYLE = 'solitaire-back-style';
  const STORAGE_BACK_COLOR = 'solitaire-back-color';
  const BASE = 'assets/cards';
  const FACE_DIR = 'standard-color';

  let backsManifest = { designs: [] };
  let manifestPromise = null;

  const MOBILE_MQ = '(max-width: 767px)';

  function isMobileViewport() {
    return global.matchMedia(MOBILE_MQ).matches;
  }

  function defaultFaceStyleId() {
    return isMobileViewport() ? 'simple' : 'color';
  }

  let faceStyleId = defaultFaceStyleId();
  let backStyleId = 'solid-fill';
  let backColorId = 'red';

  function cardAssetId(card) {
    const suit = SUIT_PREFIX[card.suit];
    const r = card.rank;
    if (r <= 10) return `${suit}-${r}`;
    if (r === 11) return `${suit}-11-JACK`;
    if (r === 12) return `${suit}-12-QUEEN`;
    return `${suit}-13-KING`;
  }

  function getBackStyles() {
    return backsManifest.designs;
  }

  function getFaceStyle(id) {
    return FACE_STYLES.find((f) => f.id === id) || FACE_STYLES[0];
  }

  function getBackStyle(id) {
    return getBackStyles().find((b) => b.id === id) || getBackStyles()[0];
  }

  function getBackColorsForStyle(styleId) {
    const style = getBackStyle(styleId);
    return style ? style.variants : [];
  }

  function faceUrl(card) {
    return `${BASE}/faces/${FACE_DIR}/${cardAssetId(card)}.svg`;
  }

  function backUrl(styleId, colorId) {
    const style = getBackStyle(styleId || backStyleId);
    if (!style) return '';
    const variant = style.variants.find((v) => v.id === (colorId || backColorId)) || style.variants[0];
    if (!variant) return '';
    return `${BASE}/backs/${variant.file}`;
  }

  function normalizeBackColor(styleId, colorId) {
    const style = getBackStyle(styleId);
    if (!style) return colorId;
    if (colorId && style.colors.includes(colorId)) return colorId;
    return style.defaultColor;
  }

  function applyManifestDefaults() {
    const styles = getBackStyles();
    if (!styles.length) return;
    if (!styles.some((s) => s.id === backStyleId)) {
      backStyleId = styles[0].id;
    }
    backColorId = normalizeBackColor(backStyleId, backColorId);
  }

  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(`${BASE}/backs-manifest.json`)
        .then((r) => {
          if (!r.ok) throw new Error('manifest');
          return r.json();
        })
        .then((data) => {
          backsManifest = data;
          applyManifestDefaults();
          return backsManifest;
        })
        .catch(() => {
          backsManifest = { designs: [] };
          return backsManifest;
        });
    }
    return manifestPromise;
  }

  function loadPreferences() {
    try {
      const f = localStorage.getItem(STORAGE_FACE);
      const style = localStorage.getItem(STORAGE_BACK_STYLE) || localStorage.getItem('solitaire-back-design');
      const color = localStorage.getItem(STORAGE_BACK_COLOR);
      if (f && FACE_STYLES.some((x) => x.id === f)) {
        faceStyleId = f;
      } else {
        faceStyleId = defaultFaceStyleId();
      }
      if (style) backStyleId = style;
      if (color) backColorId = color;
    } catch (_) {
      faceStyleId = defaultFaceStyleId();
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem(STORAGE_FACE, faceStyleId);
      localStorage.setItem(STORAGE_BACK_STYLE, backStyleId);
      localStorage.setItem(STORAGE_BACK_COLOR, backColorId);
    } catch (_) {}
  }

  function setFaceStyle(id) {
    if (!FACE_STYLES.some((f) => f.id === id)) return;
    faceStyleId = id;
    savePreferences();
  }

  function setBackStyle(id) {
    if (!getBackStyles().some((b) => b.id === id)) return;
    backStyleId = id;
    backColorId = normalizeBackColor(backStyleId, backColorId);
    savePreferences();
  }

  function setBackColor(id) {
    const next = normalizeBackColor(backStyleId, id);
    if (!next) return;
    backColorId = next;
    savePreferences();
  }

  function getFaceStyleId() {
    return faceStyleId;
  }

  function getBackStyleId() {
    return backStyleId;
  }

  function getBackColorId() {
    return backColorId;
  }

  function isRedSuit(suit) {
    return suit === 'hearts' || suit === 'diamonds';
  }

  function wrapWithBorder(inner) {
    const frame = document.createElement('div');
    frame.className = 'card-art-frame';
    frame.appendChild(inner);
    return frame;
  }

  function createSimpleFaceElement(card) {
    const ranks = global.SolitaireRANKS || ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const rank = ranks[card.rank - 1];
    const sym = SUIT_SYMBOL[card.suit];
    const colorClass = isRedSuit(card.suit) ? 'card-red' : 'card-black';
    const wrap = document.createElement('div');
    wrap.className = 'card-art card-art-face';
    const face = document.createElement('div');
    face.className = `card-face ${colorClass}`;
    face.innerHTML =
      '<div class="card-corner card-tl">' +
      `<span class="card-rank">${rank}</span><span class="card-suit">${sym}</span>` +
      '</div>' +
      `<div class="card-center">${sym}</div>` +
      '<div class="card-corner card-br">' +
      `<span class="card-rank">${rank}</span><span class="card-suit">${sym}</span>` +
      '</div>';
    wrap.appendChild(wrapWithBorder(face));
    return wrap;
  }

  function preload() {
    return loadManifest();
  }

  function createFaceElement(card) {
    if (faceStyleId === 'simple') return createSimpleFaceElement(card);
    const style = getFaceStyle(faceStyleId);
    const wrap = document.createElement('div');
    wrap.className = 'card-art card-art-face';
    const img = document.createElement('img');
    img.className = 'card-svg-img';
    img.draggable = false;
    img.alt = '';
    img.src = faceUrl(card);
    if (style.filter) img.style.filter = style.filter;
    wrap.appendChild(wrapWithBorder(img));
    return wrap;
  }

  function createBackElement() {
    const wrap = document.createElement('div');
    wrap.className = 'card-art card-art-back';
    const img = document.createElement('img');
    img.className = 'card-svg-img';
    img.draggable = false;
    img.alt = '';
    img.src = backUrl(backStyleId, backColorId);
    wrap.appendChild(wrapWithBorder(img));
    return wrap;
  }

  loadPreferences();
  loadManifest();

  global.CardAssets = {
    FACE_STYLES,
    get BACK_STYLES() {
      return getBackStyles();
    },
    cardAssetId,
    faceUrl,
    backUrl,
    getFaceStyle,
    getBackStyle,
    getBackColorsForStyle,
    getFaceStyleId,
    getBackStyleId,
    getBackColorId,
    setFaceStyle,
    setBackStyle,
    setBackColor,
    createSimpleFaceElement,
    preload,
    loadManifest,
    createFaceElement,
    createBackElement,
    loadPreferences,
    savePreferences,
    // aliases for app.js
    get BACK_DESIGNS() {
      return getBackStyles();
    },
    getBackDesign: getBackStyle,
    getBackDesignId: getBackStyleId,
    setBackDesign: setBackStyle,
    getBackColorsForDesign: getBackColorsForStyle,
  };
})(typeof window !== 'undefined' ? window : global);
