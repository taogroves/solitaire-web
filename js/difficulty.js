/**
 * Deal difficulty from solver profile (optimal length, first-win obscurity, move gap).
 * See: https://boardgames.stackexchange.com/questions/53504/
 */
(function (global) {
  'use strict';

  const TIERS = [
    { id: 'easy', label: 'Easy', minScore: 0, maxScore: 0.45 },
    { id: 'medium', label: 'Medium', minScore: 0.45, maxScore: 0.60 },
    { id: 'hard', label: 'Hard', minScore: 0.60, maxScore: 0.75 },
    { id: 'expert', label: 'Expert', minScore: 0.75, maxScore: 1.01 },
  ];

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function getTier(id) {
    return TIERS.find((t) => t.id === id) || TIERS[1];
  }

  function tierAt(index) {
    const i = Math.max(0, Math.min(TIERS.length - 1, Number(index) || 0));
    return TIERS[i];
  }

  function tierFromScore(score) {
    const s = clamp01(score);
    const hit = TIERS.find((t) => s >= t.minScore && s < t.maxScore);
    return hit || TIERS[TIERS.length - 1];
  }

  function fromSolveResult(result) {
    if (!result || !result.solved) {
      return { id: 'unknown', label: 'Unknown', score: null, optimal: null, firstStates: null, moveGap: null };
    }

    const solutionMoves = Number(result.move_count) || 0;
    const isMinimal = Boolean(result.minimal);
    const optimal = isMinimal ? solutionMoves : null;
    const minimalStates = Number(result.states) || 0;
    const firstMoves = Number(result.first_solution_moves ?? solutionMoves);
    const firstStates = Number(result.first_solution_states ?? minimalStates);
    const moveGap = Number(result.move_gap ?? Math.max(0, firstMoves - solutionMoves));

    const moveScore = clamp01((solutionMoves - 75) / 70);
    const obscureScore = clamp01(Math.log10(firstStates + 1) / 4.2);
    const gapScore = clamp01(moveGap / 25);
    const score = 0.45 * moveScore + 0.35 * obscureScore + 0.2 * gapScore;
    const tier = tierFromScore(score);

    return {
      id: tier.id,
      label: tier.label,
      score,
      optimal,
      bestKnown: solutionMoves,
      minimal: isMinimal,
      minimalStates,
      firstStates,
      moveGap,
    };
  }

  function fromCacheEntry(entry) {
    if (!entry) return fromSolveResult(null);
    const moves = entry.best_known ?? entry.bestKnown ?? entry.optimal;
    if (moves == null) return fromSolveResult(null);
    return fromSolveResult({
      solved: true,
      move_count: moves,
      minimal: entry.optimal != null,
      states: entry.minimal_states ?? entry.minimalStates ?? 0,
      first_solution_moves: entry.first_moves ?? entry.firstMoves ?? moves,
      first_solution_states: entry.first_states ?? entry.firstStates ?? 0,
      move_gap: entry.move_gap ?? entry.moveGap ?? 0,
    });
  }

  function matchesProfile(profile, tierId) {
    if (!profile || profile.id === 'unknown') return false;
    return profile.id === tierId;
  }

  function describeRange(tierId) {
    const t = getTier(tierId);
    const lo = Math.round(t.minScore * 100);
    const hi = Math.round(t.maxScore * 100);
    return `difficulty index ${lo}–${hi}`;
  }

  function badgeClass(profile) {
    const id = profile && profile.id ? profile.id : 'unknown';
    return `difficulty-badge difficulty-badge--${id}`;
  }

  function createBadge(profile) {
    const span = document.createElement('span');
    setBadgeElement(span, profile);
    return span;
  }

  function unsolvableProfile() {
    return { id: 'unknown', label: 'Unsolvable', score: null, optimal: null, firstStates: null, moveGap: null };
  }

  function setBadgeElement(el, profile) {
    if (!el) return;
    el.removeAttribute('hidden');
    if (!profile || !profile.label) {
      el.className = 'difficulty-badge';
      el.textContent = '';
      el.setAttribute('aria-hidden', 'true');
      return;
    }
    el.className = `${badgeClass(profile)} is-visible`;
    el.textContent = profile.label;
    el.setAttribute('aria-hidden', 'false');
  }

  function profileToCacheFields(profile) {
    const bestKnown = profile ? profile.bestKnown ?? profile.optimal : null;
    if (!profile || bestKnown == null) {
      return {
        optimal: null,
        best_known: null,
        minimal_states: null,
        first_states: null,
        move_gap: null,
        score: null,
      };
    }
    return {
      optimal: profile.optimal,
      best_known: bestKnown,
      minimal_states: profile.minimalStates,
      first_states: profile.firstStates,
      move_gap: profile.moveGap,
      score: profile.score,
    };
  }

  global.DealDifficulty = {
    TIERS,
    getTier,
    tierAt,
    tierFromScore,
    fromSolveResult,
    fromCacheEntry,
    matchesProfile,
    describeRange,
    profileToCacheFields,
    badgeClass,
    createBadge,
    setBadgeElement,
    unsolvableProfile,
  };
})(typeof window !== 'undefined' ? window : global);
