/**
 * DOM rendering, drag/touch, animations.
 */
(function (global) {
  'use strict';

  const WASTE_FAN = 22;

  function layoutPx(name, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  class GameUI {
    constructor(boardEl, engine, options) {
      this.board = boardEl;
      this.engine = engine;
      this.onWin = options.onWin || (() => {});
      this.onMove = options.onMove || (() => {});
      this.onLayout = options.onLayout || (() => {});
      this.drag = null;
      this.selection = null;
      this.lastTap = { time: 0, key: '' };
      this.animating = false;
      this._renderGen = 0;
      this._buildLayout();
      this._bindGlobal();
    }

    _buildLayout() {
      this.board.innerHTML = '';
      this.board.classList.remove('solitaire-board');

      const boardRoot = el('div', 'solitaire-board');
      this.boardRoot = boardRoot;

      const upper = el('div', 'board-upper');
      const upperLeft = el('div', 'upper-left');
      this.stockEl = el('div', 'pile pile-stock', '<div class="slot"></div>');
      this.wasteEl = el('div', 'pile pile-waste');
      upperLeft.appendChild(this.stockEl);
      upperLeft.appendChild(this.wasteEl);

      this.foundationsEl = el('div', 'foundations');
      for (let i = 0; i < 4; i++) {
        this.foundationsEl.appendChild(el('div', 'pile pile-foundation', '<div class="slot"></div>'));
      }

      upper.appendChild(upperLeft);
      upper.appendChild(this.foundationsEl);

      this.tableauRow = el('div', 'board-tableau');
      this.tableauCols = [];
      for (let c = 0; c < 7; c++) {
        const col = el('div', 'pile pile-tableau');
        col.dataset.col = String(c);
        this.tableauCols.push(col);
        this.tableauRow.appendChild(col);
      }

      boardRoot.appendChild(upper);
      boardRoot.appendChild(this.tableauRow);
      this.board.appendChild(boardRoot);

      this.stockEl.addEventListener('click', () => this._onStockClick());
    }

    _bindGlobal() {
      document.addEventListener('pointerup', (e) => this._onPointerUp(e));
      document.addEventListener('pointermove', (e) => this._onPointerMove(e));
      document.addEventListener('pointercancel', (e) => this._onPointerUp(e));
      document.addEventListener('lostpointercapture', (e) => {
        if (this.drag && e.pointerId === this.drag.pointerId) this._cancelDrag();
      });
    }

    _cancelDrag() {
      if (!this.drag) return;
      this.drag.nodes.forEach((n) => n.classList.remove('card-dragging'));
      this.drag.ghost?.remove();
      this.board.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
      this.drag = null;
      this.render();
    }

    setEngine(engine) {
      this.engine = engine;
      this.selection = null;
      this.render();
    }

    cancelInteraction() {
      this.animating = false;
      this._cancelDrag();
    }

    render(options) {
      const gen = ++this._renderGen;
      const flipCardId =
        options && typeof options === 'object' ? options.flipCardId : null;
      const s = this.engine.getState();
      this._renderStock(s, gen);
      this._renderWaste(s, gen);
      this._renderFoundations(s, gen);
      this._renderTableau(s, flipCardId, gen);
      this._updateStockBadge(s);
      if (this.onLayout) this.onLayout();
    }

    _updateStockBadge(s) {
      let badge = this.stockEl.querySelector('.stock-count');
      if (!badge) {
        badge = el('span', 'stock-count');
        this.stockEl.appendChild(badge);
      }
      badge.textContent = s.stock.length ? String(s.stock.length) : '';
      this.stockEl.classList.toggle('can-recycle', s.stock.length === 0 && s.waste.length > 0);
      this.stockEl.classList.toggle('empty-stock', s.stock.length === 0 && s.waste.length === 0);
    }

    _renderStock(s, gen) {
      const slot = this.stockEl.querySelector('.slot');
      slot.innerHTML = '';
      if (s.stock.length) {
        slot.classList.remove('slot-empty');
        const card = { ...s.stock[s.stock.length - 1], faceUp: false };
        const node = this._cardNode(card, { pile: 'stock' });
        if (gen !== this._renderGen) return;
        slot.appendChild(node);
      } else {
        slot.classList.add('slot-empty');
      }
    }

    _renderWaste(s, gen) {
      this.wasteEl.innerHTML = '';
      const visible = s.waste.slice(-3);
      const offset = Math.max(0, s.waste.length - 3);
      for (let i = 0; i < visible.length; i++) {
        const card = visible[i];
        const node = this._cardNode(card, {
          pile: 'waste',
          wasteIndex: offset + i,
          isTop: offset + i === s.waste.length - 1,
        });
        if (gen !== this._renderGen) return;
        node.style.setProperty('--fan', `${i * layoutPx('--waste-fan', WASTE_FAN)}px`);
        node.style.zIndex = String(i + 1);
        if (!node.classList.contains('card-top-waste')) {
          node.style.pointerEvents = 'none';
        }
        this.wasteEl.appendChild(node);
      }
    }

    _renderFoundations(s, gen) {
      const piles = this.foundationsEl.querySelectorAll('.pile-foundation');
      for (let i = 0; i < piles.length; i++) {
        const pileEl = piles[i];
        const slot = pileEl.querySelector('.slot');
        slot.innerHTML = '';
        const top = s.foundationTops[i];
        if (top) {
          const node = this._cardNode(top, { pile: 'foundation', foundation: i });
          if (gen !== this._renderGen) return;
          slot.appendChild(node);
        }
        pileEl.dataset.suit = SolitaireSUITS[i];
      }
    }

    _renderTableau(s, flipCardId, gen) {
      for (let c = 0; c < this.tableauCols.length; c++) {
        const colEl = this.tableauCols[c];
        colEl.innerHTML = '';
        const pile = s.tableau[c];
        for (let i = 0; i < pile.length; i++) {
          const card = pile[i];
          const node = this._cardNode(card, {
            pile: 'tableau',
            col: c,
            index: i,
            fromIndex: i,
          });
          if (gen !== this._renderGen) return;
          node.style.setProperty('--stack', String(i));
          if (flipCardId != null && card.id === flipCardId) {
            node.classList.add('card-flip-in');
          }
          colEl.appendChild(node);
        }
      }
    }

    _cardNode(card, meta) {
      const node = el('div', 'card' + (card.faceUp ? ' face-up' : ' face-down'));
      node.dataset.id = String(card.id);
      node.dataset.pile = meta.pile;
      if (meta.col != null) node.dataset.col = String(meta.col);
      if (meta.index != null) node.dataset.index = String(meta.index);
      if (meta.fromIndex != null) node.dataset.fromIndex = String(meta.fromIndex);
      if (meta.foundation != null) node.dataset.foundation = String(meta.foundation);
      if (meta.isTop) node.classList.add('card-top-waste');

      const art = el('div', 'card-art-wrap');
      if (card.faceUp) {
        art.appendChild(CardAssets.createFaceElement(card));
      } else {
        art.appendChild(CardAssets.createBackElement());
      }
      node.appendChild(art);

      if (card.faceUp) {
        node.addEventListener('pointerdown', (e) => this._onCardPointerDown(e, node, meta));
      }
      return node;
    }

    _cardMetaFromNode(node) {
      const pile = node.dataset.pile;
      if (pile === 'waste') return { type: 'waste' };
      if (pile === 'tableau') {
        return {
          type: 'tableau',
          col: parseInt(node.dataset.col, 10),
          fromIndex: parseInt(node.dataset.fromIndex, 10),
        };
      }
      if (pile === 'foundation') {
        return { type: 'foundation', foundation: parseInt(node.dataset.foundation, 10) };
      }
      return null;
    }

    _onStockClick() {
      if (this.animating) return;
      const result = this.engine.drawFromStock();
      if (!result.ok) {
        if (result.reason !== 'empty') SolitaireAudio.invalid();
        return;
      }
      if (result.action === 'draw') SolitaireAudio.draw();
      else SolitaireAudio.recycle();
      this.render();
      this.onMove();
    }

    _onCardPointerDown(e, node, meta) {
      if (this.animating || e.button !== 0) return;
      SolitaireAudio.resume();

      const now = Date.now();
      const key = node.dataset.id;
      const isDouble = key === this.lastTap.key && now - this.lastTap.time < 350;
      this.lastTap = { time: now, key };

      if (isDouble) {
        const src = this._cardMetaFromNode(node);
        const moved = this.engine.autoFoundationMove(src);
        if (moved && moved.ok) {
          SolitaireAudio.place();
          this.render({ flipCardId: moved.flippedCardId ?? null });
          this.onMove();
          if (this.engine.isWon()) this._celebrateWin();
          return;
        }
      }

      const fromIndex = meta.fromIndex != null ? meta.fromIndex : parseInt(node.dataset.fromIndex, 10);
      let cards;
      if (meta.pile === 'waste') {
        cards = [this.engine.waste[this.engine.waste.length - 1]];
      } else if (meta.pile === 'foundation') {
        const top = this.engine.foundationTops[meta.foundation];
        cards = top ? [top] : null;
      } else {
        cards = this.engine.validTableauRun(this.engine.tableau[meta.col], fromIndex);
      }

      if (!cards || !cards.length) return;

      const rect = node.getBoundingClientRect();
      const cardNodes = this._collectRunNodes(node, meta, cards.length);

      this.drag = {
        pointerId: e.pointerId,
        source:
          meta.pile === 'waste'
            ? { type: 'waste' }
            : meta.pile === 'foundation'
              ? { type: 'foundation', foundation: meta.foundation }
              : { type: 'tableau', col: meta.col, fromIndex },
        cards,
        nodes: cardNodes,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        ghost: null,
      };

      if (node.setPointerCapture) {
        try {
          node.setPointerCapture(e.pointerId);
        } catch (_) {
          /* Safari may reject capture in edge cases */
        }
      }
      this._createDragGhost(e.clientX, e.clientY);
      cardNodes.forEach((n) => n.classList.add('card-dragging'));
      e.preventDefault();
    }

    _collectRunNodes(startNode, meta, count) {
      if (meta.pile === 'waste' || meta.pile === 'foundation') return [startNode];
      const col = meta.col;
      const from = parseInt(startNode.dataset.fromIndex, 10);
      const colEl = this.tableauCols[col];
      return Array.from(colEl.querySelectorAll('.card')).filter((n) => {
        const idx = parseInt(n.dataset.index, 10);
        return idx >= from && idx < from + count;
      });
    }

    _createDragGhost(x, y) {
      const ghost = el('div', 'drag-ghost');
      this.drag.nodes.forEach((n, i) => {
        const clone = n.cloneNode(true);
        clone.style.setProperty('--ghost-stack', String(i));
        ghost.appendChild(clone);
      });
      document.body.appendChild(ghost);
      this.drag.ghost = ghost;
      this._moveGhost(x, y);
    }

    _moveGhost(x, y) {
      if (!this.drag?.ghost) return;
      const g = this.drag.ghost;
      g.style.transform = `translate(${x - this.drag.offsetX}px, ${y - this.drag.offsetY}px)`;
    }

    _onPointerMove(e) {
      if (!this.drag || e.pointerId !== this.drag.pointerId) return;
      this._moveGhost(e.clientX, e.clientY);
      this._highlightDropTarget(e.clientX, e.clientY);
    }

    _highlightDropTarget(x, y) {
      this.board.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
      const target = this._findDropTarget(x, y);
      if (target) target.classList.add('drop-target');
    }

    _findDropTarget(x, y) {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const pile = el.closest('.pile-tableau, .pile-foundation, .pile-waste');
      return pile;
    }

    _onPointerUp(e) {
      if (!this.drag || e.pointerId !== this.drag.pointerId) return;
      const { source, ghost, nodes } = this.drag;
      nodes.forEach((n) => n.classList.remove('card-dragging'));
      ghost?.remove();
      this.board.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));

      const x = e.clientX;
      const y = e.clientY;
      const dest = this._resolveDrop(x, y, source);
      this.drag = null;

      if (!dest) {
        this.render();
        return;
      }

      const result = this.engine.move(source, dest);
      if (!result.ok) {
        SolitaireAudio.invalid();
        this.render();
        return;
      }
      SolitaireAudio.place();
      this.render({ flipCardId: result.flippedCardId ?? null });
      if (result.flippedCardId != null) SolitaireAudio.flip();
      this.onMove();
      if (this.engine.isWon()) this._celebrateWin();
    }

    _resolveDrop(x, y, source) {
      const pile = this._findDropTarget(x, y);
      if (!pile) return null;
      if (pile.classList.contains('pile-tableau')) {
        return { type: 'tableau', col: parseInt(pile.dataset.col, 10) };
      }
      if (pile.classList.contains('pile-foundation')) {
        let card;
        if (source.type === 'waste') {
          card = this.engine.waste[this.engine.waste.length - 1];
        } else if (source.type === 'foundation') {
          card = this.engine.foundationTops[source.foundation];
        } else {
          const pileCards = this.engine.tableau[source.col];
          card = pileCards[source.fromIndex];
        }
        if (!card) return null;
        return { type: 'foundation', foundation: this.engine.foundationIndexForSuit(card.suit) };
      }
      return null;
    }

    _celebrateWin() {
      SolitaireAudio.win();
      (this.boardRoot || this.board).classList.add('game-won');
      this._spawnConfetti();
      this.onWin();
    }

    async playSolverMoves(moves, options) {
      const list = Array.isArray(moves) ? moves : [];
      if (!list.length || this.animating) return { ok: false, reason: 'empty' };

      const delayMs = (options && options.delayMs) || 280;
      this.animating = true;
      this._cancelDrag();

      try {
        for (const move of list) {
          if (!this.animating) break;

          const result = SolitaireSolverMoves.applySolverMove(this.engine, move);
          if (!result.ok) {
            console.error('[solitaire]', { event: 'auto-play-failed', move, result });
            return { ok: false, reason: 'move_failed', move, result };
          }

          if (result.action === 'draw') SolitaireAudio.draw();
          else if (result.action === 'recycle') SolitaireAudio.recycle();
          else if (result.action !== 'talon_only') {
            SolitaireAudio.place();
            if (result.flippedCardId != null) SolitaireAudio.flip();
          }

          this.render({ flipCardId: result.flippedCardId ?? null });
          this.onMove();

          if (this.engine.isWon()) {
            this._celebrateWin();
            return { ok: true, won: true };
          }

          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        return { ok: true, won: this.engine.isWon() };
      } finally {
        this.animating = false;
      }
    }

    _spawnConfetti() {
      const canvas = el('canvas', 'confetti-canvas');
      document.body.appendChild(canvas);
      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      resize();
      window.addEventListener('resize', resize);
      const ctx = canvas.getContext('2d');
      const pieces = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.2,
        color: ['#ffd700', '#ff6b6b', '#fff', '#4ecdc4', '#c44dff'][Math.floor(Math.random() * 5)],
        w: 6 + Math.random() * 6,
        h: 10 + Math.random() * 8,
      }));
      let frame = 0;
      const tick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.05;
          p.rot += p.vr;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        });
        frame++;
        if (frame < 240) requestAnimationFrame(tick);
        else canvas.remove();
      };
      requestAnimationFrame(tick);
    }

    updateTimer(ms) {
      const el = document.getElementById('timer-display');
      if (!el) return;
      const sec = Math.floor(ms / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      el.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }

    updateMoves(n) {
      const el = document.getElementById('moves-display');
      if (el) el.textContent = String(n);
    }
  }

  global.GameUI = GameUI;
})(typeof window !== 'undefined' ? window : global);
