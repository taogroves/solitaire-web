/**
 * Async bridge from the static JS app to the Rust/Wasm solver package.
 */
(function (global) {
  'use strict';

  const LOG_PREFIX = '[solitaire-solver]';

  const DEFAULT_OPTIONS = {
    max_states: 250000,
    max_moves: 250,
    max_recycles: 15,
    terminate_early: true,
  };

  const MINIMAL_OPTIONS = {
    max_states: 250000,
    max_moves: 250,
    max_recycles: 15,
    terminate_early: false,
  };

  const moduleUrl = new URL('../wasm/pkg/solitaire_solver.js', document.currentScript.src).href;
  let wasmPromise = null;

  function summarizeResult(result) {
    if (!result) return { solved: false, status: 'no-result' };
    return {
      status: result.status,
      solved: Boolean(result.solved),
      minimal: Boolean(result.minimal),
      move_count: result.move_count,
      states: result.states,
      first_solution_moves: result.first_solution_moves,
      first_solution_states: result.first_solution_states,
      move_gap: result.move_gap,
      error: result.error || null,
      moves: Array.isArray(result.moves) ? result.moves.length : 0,
    };
  }

  function logSolver(event, context, gameString, result, extra) {
    const summary = summarizeResult(result);
    const payload = {
      event,
      ...context,
      gameStringLength: gameString ? gameString.length : 0,
      result: summary,
      ...extra,
    };

    if (summary.status === 'invalid' || summary.error) {
      console.error(LOG_PREFIX, payload);
      return;
    }
    if (!summary.solved) {
      console.warn(LOG_PREFIX, payload);
      return;
    }
    console.info(LOG_PREFIX, payload);
  }

  function loadWasm() {
    if (!wasmPromise) {
      wasmPromise = import(moduleUrl)
        .then((mod) => mod.default().then(() => mod))
        .then((mod) => {
          console.info(LOG_PREFIX, { event: 'wasm-ready', moduleUrl });
          return mod;
        })
        .catch((err) => {
          console.error(LOG_PREFIX, { event: 'wasm-load-failed', moduleUrl, error: String(err) });
          return null;
        });
    }
    return wasmPromise;
  }

  function candidateSeed(baseSeed, index) {
    return index === 0 ? String(baseSeed) : `${baseSeed}#${index}`;
  }

  async function solveGameString(gameString, options, logContext) {
    const wasm = await loadWasm();
    if (!wasm) {
      const unavailable = { solved: false, status: 'unavailable', moves: [] };
      logSolver('solve-unavailable', logContext || {}, gameString, unavailable);
      return unavailable;
    }

    const merged = { ...DEFAULT_OPTIONS, ...(options || {}) };
    let result;
    try {
      const json = wasm.solve_game_string(gameString, JSON.stringify(merged));
      result = JSON.parse(json);
    } catch (err) {
      console.error(LOG_PREFIX, {
        event: 'solve-parse-error',
        ...(logContext || {}),
        error: String(err),
      });
      return { solved: false, status: 'invalid', error: String(err), moves: [] };
    }

    const event = merged.terminate_early ? 'solve-quick' : 'solve-minimal';
    logSolver(event, { ...(logContext || {}), options: merged }, gameString, result);
    return result;
  }

  /**
   * Use the fast solver for deal selection. Ask for a minimal proof only in contexts
   * that truly need an optimal comparison, such as the win modal.
   */
  async function resolveProfileForGameString(gameString, context, quickResult) {
    const ctx = context || {};
    let quick = quickResult;

    if (!quick) {
      quick = await solveGameString(gameString, DEFAULT_OPTIONS, {
        ...ctx,
        pass: ctx.pass || 'quick-profile',
      });
    }

    if (!quick.solved) {
      return {
        profile: global.DealDifficulty.unsolvableProfile(),
        result: quick,
        source: quick.status || 'unsolved',
      };
    }

    if (!ctx.requireMinimal) {
      return {
        profile: global.DealDifficulty.fromSolveResult(quick),
        result: quick,
        source: 'quick',
      };
    }

    const minimal = await solveGameString(gameString, MINIMAL_OPTIONS, {
      ...ctx,
      pass: 'minimal',
    });

    if (minimal.solved) {
      return {
        profile: global.DealDifficulty.fromSolveResult(minimal),
        result: minimal,
        source: 'minimal',
      };
    }

    if (minimal.status === 'unavailable') {
      return { profile: null, result: minimal, source: 'unavailable' };
    }

    if (minimal.status === 'invalid') {
      return { profile: null, result: minimal, source: 'invalid' };
    }

    console.warn(LOG_PREFIX, {
      event: 'profile-quick-fallback',
      ...ctx,
      minimal: summarizeResult(minimal),
      quick: summarizeResult(quick),
    });

    return {
      profile: global.DealDifficulty.fromSolveResult(quick),
      result: quick,
      source: 'quick',
    };
  }

  async function resolveProfileForSeed(seed, context) {
    const engine = new global.SolitaireEngine(String(seed));
    const gameString = engine.getGameString();
    return resolveProfileForGameString(gameString, { seed: String(seed), ...(context || {}) });
  }

  async function findSolvableSeed(baseSeed, options) {
    const settings = {
      maxAttempts: 100,
      maxBases: 25,
      solveOptions: DEFAULT_OPTIONS,
      filterProfile: null,
      ...(options || {}),
    };
    const firstSeed = candidateSeed(baseSeed, 0);
    const needsProfile = typeof settings.filterProfile === 'function';

    for (let b = 0; b < settings.maxBases; b++) {
      const base = b === 0 ? String(baseSeed) : `${String(baseSeed)}-d${b}`;
      for (let i = 0; i < settings.maxAttempts; i++) {
        const seed = candidateSeed(base, i);
        const engine = new global.SolitaireEngine(seed);
        const gameString = engine.getGameString();
        const quick = await solveGameString(gameString, settings.solveOptions, {
          seed,
          base,
          attempt: i,
          pass: 'find-quick',
        });
        if (!quick.solved) continue;

        const bundle = await resolveProfileForGameString(
          gameString,
          { seed, base, attempt: i, pass: 'find-profile' },
          quick
        );

        if (needsProfile) {
          if (!bundle.profile || !settings.filterProfile(bundle.profile)) continue;
        }

        console.info(LOG_PREFIX, {
          event: 'find-solvable-hit',
          seed,
          profileSource: bundle.source,
          difficulty: bundle.profile?.label,
        });

        return {
          seed,
          result: bundle.result,
          profile: bundle.profile,
          profileSource: bundle.source,
        };
      }
    }

    console.warn(LOG_PREFIX, {
      event: 'find-solvable-miss',
      baseSeed: String(baseSeed),
      maxAttempts: settings.maxAttempts,
      maxBases: settings.maxBases,
    });
    return { seed: firstSeed, result: { solved: false, status: 'unknown' }, profile: null };
  }

  async function solveMinimal(gameString, options, logContext) {
    return solveGameString(gameString, { ...MINIMAL_OPTIONS, ...(options || {}) }, logContext);
  }

  global.SolitaireSolver = {
    loadWasm,
    solveGameString,
    solveMinimal,
    resolveProfileForGameString,
    resolveProfileForSeed,
    findSolvableSeed,
    summarizeResult,
  };
})(typeof window !== 'undefined' ? window : global);
