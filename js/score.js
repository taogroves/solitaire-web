/**
 * Combined win score: move efficiency vs solver best + time vs 0.5s/move par.
 */
(function (global) {
  'use strict';

  const SEC_PER_MOVE = 0.5;
  const MOVE_WEIGHT = 0.55;
  const TIME_WEIGHT = 0.45;
  const BEST_SCORE = 100;

  function bestMovesFromProfile(profile) {
    if (!profile) return null;
    const moves = profile.bestKnown ?? profile.optimal;
    return moves != null && moves > 0 ? moves : null;
  }

  function computeBenchmark(profile) {
    const bestMoves = bestMovesFromProfile(profile);
    if (bestMoves == null) return null;
    return {
      bestMoves,
      bestTimeMs: Math.round(bestMoves * SEC_PER_MOVE * 1000),
      bestScore: BEST_SCORE,
    };
  }

  function computePlayerScore(playerMoves, playerTimeMs, benchmark) {
    if (!benchmark || playerMoves == null) return null;
    const { bestMoves, bestTimeMs } = benchmark;
    const moveRatio = bestMoves / Math.max(playerMoves, bestMoves);
    const timeRatio = bestTimeMs / Math.max(playerTimeMs || 0, bestTimeMs);
    const ratio = MOVE_WEIGHT * moveRatio + TIME_WEIGHT * timeRatio;
    return Math.round(Math.max(0, Math.min(1, ratio)) * BEST_SCORE);
  }

  function formatTimeMs(ms) {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function winSummary(playerScore, benchmark, playerMoves, playerTimeMs) {
    if (playerScore == null || !benchmark) {
      return {
        title: 'You win!',
        sub: 'Brilliant play.',
        message: '',
      };
    }

    const moveExtra = playerMoves - benchmark.bestMoves;
    const timeExtraMs = playerTimeMs - benchmark.bestTimeMs;

    if (playerScore >= 100) {
      return {
        title: 'Perfect!',
        sub: 'Solver-par moves and pace.',
        message: `${benchmark.bestMoves} moves at ${formatTimeMs(benchmark.bestTimeMs)} — flawless.`,
      };
    }

    if (playerScore >= 90) {
      return {
        title: 'Outstanding!',
        sub: `Score ${playerScore} of ${benchmark.bestScore}.`,
        message: buildGapMessage(moveExtra, timeExtraMs, benchmark),
      };
    }

    if (playerScore >= 75) {
      return {
        title: 'You win!',
        sub: `Score ${playerScore} of ${benchmark.bestScore}.`,
        message: buildGapMessage(moveExtra, timeExtraMs, benchmark),
      };
    }

    return {
      title: 'You win!',
      sub: `Score ${playerScore} of ${benchmark.bestScore} — room to improve.`,
      message: buildGapMessage(moveExtra, timeExtraMs, benchmark),
    };
  }

  function buildGapMessage(moveExtra, timeExtraMs, benchmark) {
    const parts = [];
    if (moveExtra > 0) {
      parts.push(`${moveExtra} move${moveExtra === 1 ? '' : 's'} over the solver's ${benchmark.bestMoves}`);
    }
    if (timeExtraMs > 500) {
      parts.push(`${formatTimeMs(timeExtraMs)} slower than ${formatTimeMs(benchmark.bestTimeMs)} par`);
    }
    if (!parts.length) return 'Nearly perfect — shave a move or a few seconds for 100.';
    return parts.join(' · ');
  }

  global.ScoreBenchmark = {
    SEC_PER_MOVE,
    BEST_SCORE,
    bestMovesFromProfile,
    computeBenchmark,
    computePlayerScore,
    winSummary,
    formatTimeMs,
  };
})(typeof window !== 'undefined' ? window : global);
