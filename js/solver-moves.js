/**
 * Apply encoded solver move strings to the live game engine.
 */
(function (global) {
  'use strict';

  const FOUNDATION_INDEX = { FH: 0, FD: 1, FC: 2, FS: 3 };
  const FOUNDATION_RE = /^(FH|FD|FC|FS)$/;

  function applyDrawOrRecycle(engine) {
    return engine.drawFromStock();
  }

  function applyCardMove(engine, move) {
    let m = move.match(/^W>(FH|FD|FC|FS)$/);
    if (m) {
      return engine.move({ type: 'waste' }, { type: 'foundation', foundation: FOUNDATION_INDEX[m[1]] });
    }

    m = move.match(/^W>T(\d+)$/);
    if (m) {
      return engine.move({ type: 'waste' }, { type: 'tableau', col: parseInt(m[1], 10) - 1 });
    }

    m = move.match(/^T(\d+)>(FH|FD|FC|FS)$/);
    if (m) {
      const col = parseInt(m[1], 10) - 1;
      const fromIndex = engine.tableau[col].length - 1;
      return engine.move(
        { type: 'tableau', col, fromIndex },
        { type: 'foundation', foundation: FOUNDATION_INDEX[m[2]] }
      );
    }

    m = move.match(/^T(\d+):(\d+)>T(\d+)$/);
    if (m) {
      return engine.move(
        { type: 'tableau', col: parseInt(m[1], 10) - 1, fromIndex: parseInt(m[2], 10) },
        { type: 'tableau', col: parseInt(m[3], 10) - 1 }
      );
    }

    m = move.match(/^(FH|FD|FC|FS)>T(\d+)$/);
    if (m) {
      return engine.move(
        { type: 'foundation', foundation: FOUNDATION_INDEX[m[1]] },
        { type: 'tableau', col: parseInt(m[2], 10) - 1 }
      );
    }

    if (move === '@' || move === 'R') {
      return applyDrawOrRecycle(engine);
    }

    return { ok: false, reason: 'unparsed', move };
  }

  function applySolverMove(engine, moveStr) {
    const trimmed = String(moveStr || '').trim();
    if (!trimmed) return { ok: false, reason: 'empty' };

    let talonPrefix = '';
    let cardMove = trimmed;

    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx !== -1) {
      talonPrefix = trimmed.slice(0, spaceIdx);
      cardMove = trimmed.slice(spaceIdx + 1).trim();
    } else if (/^[@R]+$/.test(trimmed)) {
      talonPrefix = trimmed;
      cardMove = '';
    }

    let lastResult = { ok: true, action: 'talon_only' };
    for (const ch of talonPrefix) {
      if (ch !== '@' && ch !== 'R') {
        return { ok: false, reason: 'bad_talon', move: moveStr };
      }
      lastResult = applyDrawOrRecycle(engine);
      if (!lastResult.ok) return lastResult;
    }

    if (!cardMove) return lastResult;
    return applyCardMove(engine, cardMove);
  }

  global.SolitaireSolverMoves = {
    applySolverMove,
    FOUNDATION_RE,
  };
})(typeof window !== 'undefined' ? window : global);
