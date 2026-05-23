/**
 * Klondike solitaire engine — 3-card draw, seeded deals.
 */
(function (global) {
  'use strict';

  const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
  const SUIT_RED = { hearts: true, diamonds: true, clubs: false, spades: false };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function createDeck(rng) {
    const deck = [];
    let id = 0;
    for (let s = 0; s < 4; s++) {
      for (let r = 1; r <= 13; r++) {
        deck.push({
          id: id++,
          suit: SUITS[s],
          rank: r,
          faceUp: false,
        });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function cardDealCode(card) {
    const suit = { clubs: 1, diamonds: 2, hearts: 3, spades: 4 }[card.suit];
    return String(card.rank).padStart(2, '0') + String(suit);
  }

  function isRed(card) {
    return SUIT_RED[card.suit];
  }

  function oppositeColor(a, b) {
    return isRed(a) !== isRed(b);
  }

  function tableauTop(tableau, col) {
    const pile = tableau[col];
    return pile.length ? pile[pile.length - 1] : null;
  }

  function flipTopIfNeeded(tableau, col) {
    const pile = tableau[col];
    if (pile.length && !pile[pile.length - 1].faceUp) {
      const card = pile[pile.length - 1];
      card.faceUp = true;
      return card.id;
    }
    return null;
  }

  const MAX_UNDO_HISTORY = 200;

  class SolitaireEngine {
    constructor(seed) {
      this.seed = seed || null;
      this.moves = 0;
      this.drawCount = 3;
      this.stockPasses = 0;
      this.startedAt = null;
      this.wonAt = null;
      this._history = [];
      this._newDeal(seed);
    }

    _rng(seed) {
      if (typeof Math.seedrandom !== 'function') {
        return Math.random;
      }
      return new Math.seedrandom(seed == null ? undefined : String(seed));
    }

    _newDeal(seed) {
      const rng = this._rng(seed);
      const deck = createDeck(rng);
      this.tableau = [[], [], [], [], [], [], []];
      let idx = 0;
      for (let col = 0; col < 7; col++) {
        for (let row = 0; row <= col; row++) {
          const card = deck[idx++];
          card.faceUp = row === col;
          this.tableau[col].push(card);
        }
      }
      this.stock = deck.slice(idx).map((c) => {
        c.faceUp = false;
        return c;
      });
      this.waste = [];
      this.foundationRanks = [0, 0, 0, 0];
      this.foundationTops = [null, null, null, null];
      this.moves = 0;
      this.stockPasses = 0;
      this.startedAt = Date.now();
      this.wonAt = null;
      this.seed = seed == null ? null : String(seed);
      this._history = [];
    }

    _snapshot() {
      return {
        tableau: this.tableau.map((pile) => pile.map((card) => ({ ...card }))),
        stock: this.stock.map((card) => ({ ...card })),
        waste: this.waste.map((card) => ({ ...card })),
        foundationRanks: [...this.foundationRanks],
        foundationTops: this.foundationTops.map((card) => (card ? { ...card } : null)),
        moves: this.moves,
        stockPasses: this.stockPasses,
        wonAt: this.wonAt,
      };
    }

    _restore(snapshot) {
      this.tableau = snapshot.tableau.map((pile) => pile.map((card) => ({ ...card })));
      this.stock = snapshot.stock.map((card) => ({ ...card }));
      this.waste = snapshot.waste.map((card) => ({ ...card }));
      this.foundationRanks = [...snapshot.foundationRanks];
      this.foundationTops = snapshot.foundationTops.map((card) => (card ? { ...card } : null));
      this.moves = snapshot.moves;
      this.stockPasses = snapshot.stockPasses;
      this.wonAt = snapshot.wonAt;
    }

    _pushHistory() {
      this._history.push(this._snapshot());
      if (this._history.length > MAX_UNDO_HISTORY) this._history.shift();
    }

    canUndo() {
      return this._history.length > 0;
    }

    undo() {
      if (!this.canUndo()) return { ok: false, reason: 'empty' };
      this._restore(this._history.pop());
      return { ok: true };
    }

    newGame(seed) {
      this._newDeal(seed);
    }

    getState() {
      return {
        seed: this.seed,
        tableau: this.tableau.map((p) => p.map((c) => ({ ...c }))),
        stock: this.stock.map((c) => ({ ...c })),
        waste: this.waste.map((c) => ({ ...c })),
        foundationRanks: [...this.foundationRanks],
        foundationTops: this.foundationTops.map((c) => (c ? { ...c } : null)),
        moves: this.moves,
        drawCount: this.drawCount,
        stockPasses: this.stockPasses,
        startedAt: this.startedAt,
        wonAt: this.wonAt,
      };
    }

    getGameString() {
      const cards = [];
      for (let row = 0; row < 7; row++) {
        for (let col = row; col < 7; col++) {
          cards.push(this.tableau[col][row]);
        }
      }
      for (let i = this.stock.length - 1; i >= 0; i--) {
        cards.push(this.stock[i]);
      }
      return cards.map(cardDealCode).join('');
    }

    isWon() {
      return this.foundationRanks.every((n) => n === 13);
    }

    allTableauFaceUp() {
      return this.tableau.every((pile) => pile.every((card) => card.faceUp));
    }

    getBoardStateJson() {
      return JSON.stringify({
        tableau: this.tableau.map((pile) =>
          pile.map((card) => ({
            suit: card.suit,
            rank: card.rank,
            face_up: card.faceUp,
          }))
        ),
        stock: this.stock.map((card) => ({ suit: card.suit, rank: card.rank })),
        waste: this.waste.map((card) => ({ suit: card.suit, rank: card.rank })),
        foundations: [...this.foundationRanks],
        recycles: this.stockPasses,
      });
    }

    stockRemaining() {
      return this.stock.length;
    }

    canDrawStock() {
      return this.stock.length > 0 || this.waste.length > 0;
    }

    drawFromStock() {
      if (this.wonAt) return { ok: false, reason: 'won' };
      if (this.stock.length > 0) {
        this._pushHistory();
        const n = Math.min(this.drawCount, this.stock.length);
        for (let i = 0; i < n; i++) {
          const card = this.stock.pop();
          card.faceUp = true;
          this.waste.push(card);
        }
        this.moves++;
        return { ok: true, action: 'draw', count: n };
      }
      if (this.waste.length > 0) {
        this._pushHistory();
        // Flip waste onto stock: top of waste becomes bottom of stock (drawn last
        // next pass); bottom of waste becomes stock top (pop end, drawn first).
        while (this.waste.length) {
          const card = this.waste.pop();
          card.faceUp = false;
          this.stock.push(card);
        }
        this.stockPasses++;
        this.moves++;
        return { ok: true, action: 'recycle' };
      }
      return { ok: false, reason: 'empty' };
    }

    foundationIndexForSuit(suit) {
      return SUITS.indexOf(suit);
    }

    canPlaceOnFoundation(card, foundationIdx) {
      const count = this.foundationRanks[foundationIdx];
      if (count === 0) return card.rank === 1;
      return card.suit === SUITS[foundationIdx] && card.rank === count + 1;
    }

    foundationTop(foundationIdx) {
      return this.foundationTops[foundationIdx];
    }

    canPlaceOnTableau(card, col) {
      const pile = this.tableau[col];
      if (pile.length === 0) return card.rank === 13;
      const top = pile[pile.length - 1];
      if (!top.faceUp) return false;
      return oppositeColor(card, top) && card.rank === top.rank - 1;
    }

    validTableauRun(pile, fromIndex) {
      if (fromIndex < 0 || fromIndex >= pile.length) return null;
      if (!pile[fromIndex].faceUp) return null;
      const run = pile.slice(fromIndex);
      for (let i = 1; i < run.length; i++) {
        const below = run[i - 1];
        const above = run[i];
        if (!above.faceUp) return null;
        if (!oppositeColor(below, above) || above.rank !== below.rank - 1) return null;
      }
      return run;
    }

    /**
     * @param {{ type: 'waste'|'tableau'|'foundation', col?: number, foundation?: number, fromIndex?: number }}
     * @param {{ type: 'tableau'|'foundation', col?: number, foundation?: number }}
     */
    move(source, dest) {
      if (this.wonAt) return { ok: false, reason: 'won' };

      let cards = [];
      let sourceMeta = {};

      if (source.type === 'waste') {
        if (!this.waste.length) return { ok: false, reason: 'empty' };
        cards = [this.waste[this.waste.length - 1]];
        sourceMeta = { type: 'waste' };
      } else if (source.type === 'tableau') {
        const pile = this.tableau[source.col];
        const run = this.validTableauRun(pile, source.fromIndex);
        if (!run) return { ok: false, reason: 'invalid_run' };
        cards = run;
        sourceMeta = { type: 'tableau', col: source.col, fromIndex: source.fromIndex };
      } else if (source.type === 'foundation') {
        const top = this.foundationTops[source.foundation];
        if (!top) return { ok: false, reason: 'empty' };
        cards = [top];
        sourceMeta = { type: 'foundation', foundation: source.foundation };
      } else {
        return { ok: false, reason: 'bad_source' };
      }

      const card = cards[0];
      if (dest.type === 'foundation') {
        if (cards.length !== 1) return { ok: false, reason: 'multi_to_foundation' };
        const fIdx = dest.foundation != null ? dest.foundation : this.foundationIndexForSuit(card.suit);
        if (!this.canPlaceOnFoundation(card, fIdx)) return { ok: false, reason: 'illegal' };
        this._pushHistory();
        this._removeFromSource(sourceMeta, cards);
        this.foundationRanks[fIdx]++;
        this.foundationTops[fIdx] = card;
        const flippedCardId = this._afterMove(sourceMeta);
        this.moves++;
        this._checkWin();
        return { ok: true, action: 'to_foundation', foundation: fIdx, flippedCardId };
      }

      if (dest.type === 'tableau') {
        const col = dest.col;
        if (!this.canPlaceOnTableau(card, col)) return { ok: false, reason: 'illegal' };
        this._pushHistory();
        this._removeFromSource(sourceMeta, cards);
        this.tableau[col].push(...cards);
        const flippedCardId = this._afterMove(sourceMeta);
        this.moves++;
        this._checkWin();
        return { ok: true, action: 'to_tableau', col, flippedCardId };
      }

      return { ok: false, reason: 'bad_dest' };
    }

    _removeFromSource(sourceMeta, cards) {
      if (sourceMeta.type === 'waste') {
        this.waste.pop();
      } else if (sourceMeta.type === 'tableau') {
        const pile = this.tableau[sourceMeta.col];
        pile.splice(sourceMeta.fromIndex, cards.length);
      } else if (sourceMeta.type === 'foundation') {
        const fIdx = sourceMeta.foundation;
        this.foundationRanks[fIdx]--;
        const n = this.foundationRanks[fIdx];
        this.foundationTops[fIdx] =
          n > 0
            ? {
                id: `f-${SUITS[fIdx]}-${n}`,
                suit: SUITS[fIdx],
                rank: n,
                faceUp: true,
              }
            : null;
      }
    }

    _afterMove(sourceMeta) {
      if (sourceMeta.type === 'tableau') {
        return flipTopIfNeeded(this.tableau, sourceMeta.col);
      }
      return null;
    }

    _checkWin() {
      if (this.isWon() && !this.wonAt) {
        this.wonAt = Date.now();
      }
    }

    autoFoundationMove(source) {
      if (source.type === 'waste') {
        if (!this.waste.length) return null;
        const card = this.waste[this.waste.length - 1];
        const fIdx = this.foundationIndexForSuit(card.suit);
        if (this.canPlaceOnFoundation(card, fIdx)) {
          return this.move(source, { type: 'foundation', foundation: fIdx });
        }
        return null;
      }
      if (source.type === 'tableau') {
        const pile = this.tableau[source.col];
        const topIdx = pile.length - 1;
        if (topIdx < 0 || !pile[topIdx].faceUp) return null;
        const card = pile[topIdx];
        const fIdx = this.foundationIndexForSuit(card.suit);
        if (this.canPlaceOnFoundation(card, fIdx)) {
          return this.move(
            { type: 'tableau', col: source.col, fromIndex: topIdx },
            { type: 'foundation', foundation: fIdx }
          );
        }
      }
      return null;
    }

    elapsedMs() {
      const end = this.wonAt || Date.now();
      return end - (this.startedAt || end);
    }

    formatCard(card) {
      return RANKS[card.rank - 1] + card.suit[0].toUpperCase();
    }
  }

  function dailySeed(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDisplayDate(isoDateStr) {
    const d = new Date(isoDateStr + 'T12:00:00');
    return Number.isNaN(d.getTime())
      ? isoDateStr
      : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  global.SolitaireEngine = SolitaireEngine;
  global.SolitaireDailySeed = dailySeed;
  global.SolitaireFormatDate = formatDisplayDate;
  global.SolitaireSUITS = SUITS;
  global.SolitaireRANKS = RANKS;
})(typeof window !== 'undefined' ? window : global);
