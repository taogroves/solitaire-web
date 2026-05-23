/**
 * App shell: menus, seeds, timer, win modal.
 */
(function () {
  'use strict';

  const menuScreen = document.getElementById('menu-screen');
  const settingsScreen = document.getElementById('settings-screen');
  const gameScreen = document.getElementById('game-screen');
  const boardEl = document.getElementById('game-board');
  const seedInput = document.getElementById('seed-input');
  const subtitleModeEl = document.getElementById('game-subtitle-mode');
  const subtitleSeedEl = document.getElementById('game-subtitle-seed');
  const subtitleBadgeEl = document.getElementById('game-difficulty-badge');
  const winSeedTextEl = document.getElementById('win-seed-text');
  const winBadgeEl = document.getElementById('win-difficulty-badge');
  const winModal = document.getElementById('win-modal');
  const solverLoading = document.getElementById('solver-loading');
  const solverLoadingText = document.getElementById('solver-loading-text');
  const appEl = document.getElementById('app');
  const PHONE_LANDSCAPE = window.matchMedia('(orientation: landscape) and (max-height: 500px)');

  const previewCard = { suit: 'hearts', rank: 1, faceUp: true };

  let engine = null;
  let ui = null;
  let timerId = null;
  let currentMode = '';
  let resolvingDeal = false;
  let optimalMoveCount = null;
  let dealProfile = null;
  let dealBenchmark = null;
  let fitBoardFrame = null;
  let boardResizeObserver = null;
  const DIFFICULTY_STORAGE = 'solitaire-random-difficulty';
  let endgameCheckToken = 0;
  let endgameCheckTimer = null;
  let endgameSolution = null;
  let endgameChecking = false;

  function applyDealProfile(profile) {
    dealProfile = profile && profile.label ? profile : null;
    optimalMoveCount =
      dealProfile && dealProfile.optimal != null ? dealProfile.optimal : null;
    dealBenchmark = ScoreBenchmark.computeBenchmark(dealProfile);
    refreshDifficultyBadges();
  }

  function shouldShowDifficultyBadge() {
    return currentMode !== 'Seeded';
  }

  function refreshDifficultyBadges() {
    const profile = shouldShowDifficultyBadge() ? getDisplayProfile() : null;
    DealDifficulty.setBadgeElement(subtitleBadgeEl, profile);
    DealDifficulty.setBadgeElement(winBadgeEl, profile);
  }

  function getDisplayProfile() {
    if (dealProfile && dealProfile.label) return dealProfile;
    if (optimalMoveCount != null) {
      return DealDifficulty.fromSolveResult({
        solved: true,
        move_count: optimalMoveCount,
        states: 1,
        first_solution_moves: optimalMoveCount,
        first_solution_states: 1,
        move_gap: 0,
      });
    }
    return null;
  }

  function ensureDealProfileAsync(seedStr) {
    const seed = String(seedStr);
    resolveDealProfile(seed, { pass: 'ensure-async' }).then((profile) => {
      if (!engine || String(engine.seed) !== seed) return;
      if (profile) applyDealProfile(profile);
    });
  }

  function cacheEntryFromProfile(seed, profile) {
    return {
      seed: String(seed),
      ...DealDifficulty.profileToCacheFields(profile),
    };
  }

  function getRandomDifficultyIndex() {
    const group = document.getElementById('random-difficulty');
    const selected = group?.querySelector('.difficulty-segmented-btn[aria-checked="true"]');
    const idx = selected ? Number(selected.dataset.tierIndex) : 1;
    return Number.isFinite(idx) ? idx : 1;
  }

  function getRandomDifficultyId() {
    return DealDifficulty.tierAt(getRandomDifficultyIndex()).id;
  }

  function initDifficultyPicker() {
    const group = document.getElementById('random-difficulty');
    const thumb = group?.querySelector('.difficulty-segmented-thumb');
    const buttons = group ? [...group.querySelectorAll('.difficulty-segmented-btn')] : [];
    if (!group || !thumb || !buttons.length) return;

    const maxIndex = buttons.length - 1;

    function select(index, { save = true } = {}) {
      const i = Math.max(0, Math.min(maxIndex, index));
      buttons.forEach((btn, idx) => {
        const on = idx === i;
        btn.classList.toggle('is-selected', on);
        btn.setAttribute('aria-checked', String(on));
      });
      thumb.style.setProperty('--seg-index', String(i));
      if (save) sessionStorage.setItem(DIFFICULTY_STORAGE, String(i));
    }

    const saved = sessionStorage.getItem(DIFFICULTY_STORAGE);
    if (saved != null && saved >= '0' && saved <= String(maxIndex)) {
      select(Number(saved), { save: false });
    } else {
      select(1, { save: false });
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        SolitaireAudio.uiClick();
        select(Number(btn.dataset.tierIndex));
      });
    });
  }

  function modeHeadline(modeLabel, seedStr) {
    if (modeLabel === 'Daily') {
      const seed = String(seedStr);
      const datePart = /^\d{4}-\d{2}-\d{2}/.test(seed) ? seed.slice(0, 10) : SolitaireDailySeed();
      return SolitaireFormatDate(datePart);
    }
    return modeLabel;
  }

  function updateGameSubtitle(seedStr, modeLabel) {
    const seed = String(seedStr);
    if (subtitleModeEl) subtitleModeEl.textContent = modeHeadline(modeLabel, seed);
    if (subtitleSeedEl) subtitleSeedEl.textContent = `Seed ${seed}`;
    refreshDifficultyBadges();
  }

  function updateWinSeedRow(seed, profile) {
    if (winSeedTextEl) winSeedTextEl.textContent = seed || '—';
    const badgeProfile = shouldShowDifficultyBadge() ? profile || getDisplayProfile() : null;
    DealDifficulty.setBadgeElement(winBadgeEl, badgeProfile);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function fitGameBoard() {
    if (fitBoardFrame) cancelAnimationFrame(fitBoardFrame);
    fitBoardFrame = requestAnimationFrame(() => {
      fitBoardFrame = null;
      if (gameScreen.hidden) return;

      const wrap = boardEl;
      const board = wrap?.querySelector('.solitaire-board');
      if (!wrap || !board) return;

      wrap.style.marginBottom = '0';
      board.style.setProperty('--board-scale', '1');
      board.style.marginBottom = '0';

      const availableH = wrap.clientHeight;
      const availableW = wrap.clientWidth;
      const neededH = board.offsetHeight;
      const neededW = board.offsetWidth;
      if (!availableH || !availableW || !neededH || !neededW) return;

      const widthBuffer = 6;
      const scale = Math.min(1, availableH / neededH, (availableW - widthBuffer) / neededW);
      if (scale >= 0.999) return;

      const clamped = Math.max(0.5, scale);
      board.style.setProperty('--board-scale', String(clamped));
      const excess = Math.round(neededH * (1 - clamped));
      wrap.style.marginBottom = excess > 0 ? `-${excess}px` : '0';
    });
  }

  function updateGameActionsVisibility() {
    const bar = document.getElementById('game-actions');
    if (!bar) return;
    const undoBtn = document.getElementById('btn-undo');
    const autoBtn = document.getElementById('btn-auto-complete');
    const undoHidden = !undoBtn || undoBtn.hidden;
    const autoHidden = !autoBtn || autoBtn.hidden;
    bar.classList.toggle('is-empty', undoHidden && autoHidden);
  }

  function ensureBoardResizeObserver() {
    if (boardResizeObserver || !boardEl) return;
    boardResizeObserver = new ResizeObserver(() => fitGameBoard());
    boardResizeObserver.observe(boardEl);
    const actionsEl = document.getElementById('game-actions');
    if (actionsEl) boardResizeObserver.observe(actionsEl);
    if (gameScreen) boardResizeObserver.observe(gameScreen);
  }

  function updateUndoButton() {
    const btn = document.getElementById('btn-undo');
    if (!btn) return;
    if (engine?.isWon()) {
      btn.hidden = true;
      updateGameActionsVisibility();
      updateAutoCompleteButton();
      return;
    }
    btn.hidden = false;
    const canUndo = Boolean(engine?.canUndo()) && !ui?.animating;
    btn.disabled = !canUndo;
    btn.setAttribute('aria-disabled', String(!canUndo));
    updateGameActionsVisibility();
    updateAutoCompleteButton();
    fitGameBoard();
  }

  function updateAutoCompleteButton() {
    const btn = document.getElementById('btn-auto-complete');
    if (!btn) return;
    const show =
      Boolean(endgameSolution?.length) &&
      !engine?.isWon() &&
      !ui?.animating &&
      !endgameChecking;
    btn.hidden = !show;
    btn.disabled = !show;
    btn.setAttribute('aria-disabled', String(!show));
    if (endgameChecking && !engine?.isWon() && engine?.allTableauFaceUp?.()) {
      btn.hidden = false;
      btn.disabled = true;
      btn.textContent = 'Checking…';
    } else {
      btn.textContent = 'Auto-complete';
    }
    updateGameActionsVisibility();
    fitGameBoard();
  }

  function clearEndgameState() {
    endgameCheckToken += 1;
    endgameSolution = null;
    endgameChecking = false;
    if (endgameCheckTimer) {
      clearTimeout(endgameCheckTimer);
      endgameCheckTimer = null;
    }
    updateAutoCompleteButton();
  }

  function scheduleEndgameCheck() {
    if (!engine || engine.isWon() || !engine.allTableauFaceUp()) {
      clearEndgameState();
      return;
    }
    if (endgameCheckTimer) clearTimeout(endgameCheckTimer);
    endgameCheckTimer = setTimeout(() => {
      endgameCheckTimer = null;
      checkEndgameSolvability();
    }, 120);
  }

  async function checkEndgameSolvability() {
    if (!engine || engine.isWon() || !engine.allTableauFaceUp()) {
      clearEndgameState();
      return;
    }

    const token = ++endgameCheckToken;
    const boardJson = engine.getBoardStateJson();
    endgameChecking = true;
    updateAutoCompleteButton();

    try {
      const result = await SolitaireSolver.solveBoardState(boardJson, null, {
        pass: 'endgame-check',
        seed: engine.seed,
      });
      if (token !== endgameCheckToken) return;
      endgameSolution = result.solved && result.moves?.length ? result.moves.slice() : null;
    } catch (err) {
      if (token !== endgameCheckToken) return;
      console.warn('[solitaire]', { event: 'endgame-check-failed', error: String(err) });
      endgameSolution = null;
    } finally {
      if (token === endgameCheckToken) {
        endgameChecking = false;
        updateAutoCompleteButton();
      }
    }
  }

  async function startAutoComplete() {
    if (!endgameSolution?.length || !ui || ui.animating || engine?.isWon()) return;
    const moves = endgameSolution.slice();
    clearEndgameState();
    await ui.playSolverMoves(moves);
    updateUndoButton();
  }

  function performUndo() {
    if (!engine?.canUndo() || engine.isWon() || ui?.animating) return;
    const result = engine.undo();
    if (!result.ok) return;
    SolitaireAudio.undo();
    clearEndgameState();
    if (ui) {
      ui.render();
      ui.updateMoves(engine.moves);
    }
    updateUndoButton();
    scheduleEndgameCheck();
  }

  function goToMenu() {
    SolitaireAudio.uiClick();
    stopTimer();
    hideWinModal();
    clearEndgameState();
    if (ui) ui.cancelInteraction();
    showScreen('menu');
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      if (engine && ui) ui.updateTimer(engine.elapsedMs());
    }, 1000);
  }

  function updateLayoutMode() {
    const landscape = PHONE_LANDSCAPE.matches;
    const onGame = gameScreen && !gameScreen.hidden;
    document.body.classList.toggle('phone-landscape', landscape);
    document.body.classList.toggle('game-landscape', landscape && onGame);
    appEl?.classList.toggle('phone-landscape', landscape);
    if (onGame) fitGameBoard();
  }

  function showScreen(screen) {
    menuScreen.hidden = screen !== 'menu';
    settingsScreen.hidden = screen !== 'settings';
    gameScreen.hidden = screen !== 'game';
    document.body.classList.toggle('game-active', screen === 'game');
    updateLayoutMode();
    if (screen === 'game') {
      window.scrollTo(0, 0);
      gameScreen.scrollTop = 0;
      fitGameBoard();
    }
    if (screen === 'settings') {
      settingsScreen.scrollTop = 0;
    }
  }

  function makePickerOption(container, item, isSelected, onSelect, buildPreview) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-option';
    btn.setAttribute('role', 'radio');
    btn.dataset.id = item.id;
    btn.setAttribute('aria-label', item.name || item.id);
    btn.setAttribute('aria-checked', String(isSelected));

    const preview = document.createElement('div');
    preview.className = 'picker-preview';
    buildPreview(preview, item);

    btn.appendChild(preview);
    if (isSelected) btn.classList.add('selected');

    btn.addEventListener('click', () => {
      SolitaireAudio.uiClick();
      onSelect(item.id);
      container.querySelectorAll('.picker-option').forEach((opt) => {
        const on = opt.dataset.id === item.id;
        opt.classList.toggle('selected', on);
        opt.setAttribute('aria-checked', String(on));
      });
      if (ui && engine && !gameScreen.hidden) ui.render();
    });

    container.appendChild(btn);
  }

  function fillBackPreview(preview, designId, colorId) {
    preview.innerHTML = '';
    const frame = document.createElement('div');
    frame.className = 'card-art-frame';
    const img = document.createElement('img');
    img.className = 'card-svg-img';
    img.src = CardAssets.backUrl(designId, colorId);
    img.alt = '';
    frame.appendChild(img);
    preview.appendChild(frame);
  }

  function refreshBackStylePreviews() {
    if (!backPicker) return;
    backPicker.querySelectorAll('.picker-option').forEach((opt) => {
      const sid = opt.dataset.id;
      const cid =
        sid === CardAssets.getBackStyleId()
          ? CardAssets.getBackColorId()
          : CardAssets.getBackStyle(sid).defaultColor;
      fillBackPreview(opt.querySelector('.picker-preview'), sid, cid);
    });
  }

  function buildColorPicker() {
    const section = document.getElementById('back-color-section');
    const picker = document.getElementById('back-color-picker');
    if (!picker) return;

    const styleId = CardAssets.getBackStyleId();
    const variants = CardAssets.getBackColorsForStyle(styleId);

    picker.innerHTML = '';
    if (section) section.hidden = variants.length <= 1;
    if (variants.length <= 1) return;

    variants.forEach((variant) => {
      makePickerOption(
        picker,
        variant,
        variant.id === CardAssets.getBackColorId(),
        (id) => {
          CardAssets.setBackColor(id);
          refreshBackStylePreviews();
        },
        (preview) => fillBackPreview(preview, styleId, variant.id)
      );
    });
  }

  let backPicker;

  function buildAppearancePickers() {
    const facePicker = document.getElementById('face-picker');
    backPicker = document.getElementById('back-picker');
    if (!facePicker || !backPicker || !CardAssets.BACK_STYLES.length) return;

    facePicker.innerHTML = '';
    CardAssets.FACE_STYLES.forEach((item) => {
      makePickerOption(
        facePicker,
        item,
        item.id === CardAssets.getFaceStyleId(),
        (id) => CardAssets.setFaceStyle(id),
        (preview, face) => {
          preview.classList.remove('picker-preview-simple');
          preview.innerHTML = '';
          if (face.id === 'simple') {
            preview.classList.add('picker-preview-simple');
            preview.appendChild(CardAssets.createSimpleFaceElement(previewCard));
            return;
          }
          const frame = document.createElement('div');
          frame.className = 'card-art-frame';
          const img = document.createElement('img');
          img.className = 'card-svg-img';
          img.src = CardAssets.faceUrl(previewCard);
          img.alt = '';
          if (face.filter) img.style.filter = face.filter;
          frame.appendChild(img);
          preview.appendChild(frame);
        }
      );
    });

    backPicker.innerHTML = '';
    CardAssets.BACK_STYLES.forEach((item) => {
      makePickerOption(
        backPicker,
        item,
        item.id === CardAssets.getBackStyleId(),
        (id) => {
          CardAssets.setBackStyle(id);
          buildColorPicker();
          refreshBackStylePreviews();
        },
        (preview, back) => {
          fillBackPreview(
            preview,
            back.id,
            CardAssets.getBackStyleId() === back.id ? CardAssets.getBackColorId() : back.defaultColor
          );
        }
      );
    });

    buildColorPicker();
  }

  function yieldToPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function showSolverLoading(message) {
    if (solverLoadingText && message) solverLoadingText.textContent = message;
    if (solverLoading) {
      solverLoading.hidden = false;
      solverLoading.classList.add('is-visible');
      solverLoading.setAttribute('aria-busy', 'true');
    }
  }

  function hideSolverLoading() {
    if (solverLoading) {
      solverLoading.hidden = true;
      solverLoading.classList.remove('is-visible');
      solverLoading.setAttribute('aria-busy', 'false');
    }
  }

  async function resolveDealProfile(seed, context) {
    const bundle = await SolitaireSolver.resolveProfileForSeed(seed, {
      mode: (context && context.mode) || currentMode,
      ...(context || {}),
    });
    console.info('[solitaire]', {
      event: 'deal-profile-resolved',
      seed: String(seed),
      source: bundle.source,
      label: bundle.profile?.label,
      optimal: bundle.profile?.optimal,
    });
    return bundle.profile;
  }

  function startGame(seed, modeLabel, options) {
    SolitaireAudio.resume();
    const seedStr = seed == null ? String(Date.now()) : String(seed);
    const keepOptimal = options && options.keepOptimal;
    if (!keepOptimal) {
      optimalMoveCount = null;
      dealProfile = null;
      dealBenchmark = null;
    }
    engine = new SolitaireEngine(seedStr);
    currentMode = modeLabel || 'Random';

    if (!ui) {
      ui = new GameUI(boardEl, engine, {
        onMove() {
          ui.updateMoves(engine.moves);
          clearEndgameState();
          updateUndoButton();
          scheduleEndgameCheck();
        },
        onWin() {
          stopTimer();
          clearEndgameState();
          showWinModal();
        },
        onLayout: fitGameBoard,
      });
    } else {
      ui.setEngine(engine);
      ui.onMove = () => {
        ui.updateMoves(engine.moves);
        clearEndgameState();
        updateUndoButton();
        scheduleEndgameCheck();
      };
      ui.onWin = () => {
        stopTimer();
        clearEndgameState();
        showWinModal();
      };
      ui.onLayout = fitGameBoard;
      boardEl.querySelector('.solitaire-board')?.classList.remove('game-won');
    }

    clearEndgameState();

    updateGameSubtitle(seedStr, currentMode);
    if (!dealProfile && !(options && options.skipProfileResolve)) {
      ensureDealProfileAsync(seedStr);
    }

    ui.updateMoves(0);
    ui.updateTimer(0);
    ui.render();
    updateUndoButton();
    ensureBoardResizeObserver();
    fitGameBoard();
    showScreen('game');
    startTimer();
    SolitaireAudio.newDeal();
  }

  function saveDailyCache(dateKey, seed, profile) {
    DealCache.setDaily(dateKey, cacheEntryFromProfile(seed, profile));
  }

  function saveSeededCache(userSeed, seed, profile) {
    DealCache.setSeeded(userSeed, cacheEntryFromProfile(seed, profile));
  }

  async function startSolvableGame(baseSeed, modeLabel, extra) {
    if (resolvingDeal) return;
    const opts = extra || {};
    const isRandom = modeLabel === 'Random';
    const difficultyId = isRandom ? opts.difficultyId || getRandomDifficultyId() : null;

    if (modeLabel === 'Daily') {
      const cached = DealCache.getDaily(baseSeed);
      if (cached) {
        applyDealProfile(DealDifficulty.fromCacheEntry(cached));
        startGame(cached.seed, modeLabel, { keepOptimal: true, skipProfileResolve: true });
        return;
      }
    }

    resolvingDeal = true;
    const randomDealBtn = document.getElementById('btn-random-deal');
    const dailyBtn = document.getElementById('btn-daily');
    const newGameBtn = document.getElementById('btn-new-game');
    const dealButtons = [randomDealBtn, dailyBtn, newGameBtn].filter(Boolean);
    dealButtons.forEach((btn) => {
      btn.disabled = true;
    });

    const tier = difficultyId ? DealDifficulty.getTier(difficultyId) : null;
    showSolverLoading(
      tier ? `Finding a ${tier.label.toLowerCase()} deal…` : 'Finding a solvable deal…'
    );
    await yieldToPaint();
    try {
      if (isRandom && difficultyId && window.SolitaireSeedLibrary) {
        const libraryHit = SolitaireSeedLibrary.next(difficultyId);
        if (libraryHit) {
          applyDealProfile(libraryHit.profile);
          console.info('[solitaire]', {
            event: 'deal-started',
            mode: modeLabel,
            seed: libraryHit.seed,
            profileSource: libraryHit.profileSource,
            difficulty: libraryHit.profile.label,
          });
          hideSolverLoading();
          startGame(libraryHit.seed, modeLabel, {
            keepOptimal: true,
            skipProfileResolve: true,
          });
          return;
        }
      }

      const solveOpts = {
        maxAttempts: modeLabel === 'Daily' ? 365 : 80,
        maxBases: isRandom ? 40 : 25,
      };
      if (isRandom && difficultyId) {
        solveOpts.filterProfile = (profile) => DealDifficulty.matchesProfile(profile, difficultyId);
      }

      let resolved = await SolitaireSolver.findSolvableSeed(baseSeed, solveOpts);

      if (isRandom && difficultyId && !resolved.profile) {
        showSolverLoading('Finding a solvable deal…');
        await yieldToPaint();
        resolved = await SolitaireSolver.findSolvableSeed(baseSeed, {
          maxAttempts: 100,
          maxBases: 25,
        });
      }

      if (resolved.profile) {
        applyDealProfile(resolved.profile);
        console.info('[solitaire]', {
          event: 'deal-started',
          mode: modeLabel,
          seed: resolved.seed,
          profileSource: resolved.profileSource || 'cached-in-find',
          difficulty: resolved.profile.label,
        });
      } else {
        showSolverLoading('Calculating optimal solution…');
        await yieldToPaint();
        applyDealProfile(
          await resolveDealProfile(resolved.seed, { pass: 'post-find', mode: modeLabel })
        );
      }

      if (modeLabel === 'Daily') {
        saveDailyCache(baseSeed, resolved.seed, dealProfile);
      }
      hideSolverLoading();
      startGame(resolved.seed, modeLabel, {
        keepOptimal: true,
        skipProfileResolve: Boolean(dealProfile && dealProfile.optimal != null),
      });
    } finally {
      resolvingDeal = false;
      dealButtons.forEach((btn) => {
        btn.disabled = false;
      });
      hideSolverLoading();
    }
  }

  function startRandomGame() {
    startSolvableGame(String(Date.now()), 'Random', {
      difficultyId: getRandomDifficultyId(),
    });
  }

  async function startSeededGame(userSeed) {
    if (resolvingDeal) return;
    const key = String(userSeed).trim();
    const cached = DealCache.getSeeded(key);
    if (cached) {
      applyDealProfile(DealDifficulty.fromCacheEntry(cached));
      startGame(cached.seed, 'Seeded', { keepOptimal: true, skipProfileResolve: true });
      return;
    }

    resolvingDeal = true;
    showSolverLoading('Calculating optimal solution…');
    await yieldToPaint();
    try {
      const profile = await resolveDealProfile(key, { pass: 'seeded-start' });
      applyDealProfile(profile || DealDifficulty.unsolvableProfile());
      saveSeededCache(key, key, dealProfile);
      hideSolverLoading();
      startGame(key, 'Seeded', {
        keepOptimal: true,
        skipProfileResolve: Boolean(dealProfile && dealProfile.optimal != null),
      });
    } finally {
      resolvingDeal = false;
      hideSolverLoading();
    }
  }

  function setWinScoreDisplay(playerMoves, playerTimeMs) {
    const titleEl = document.getElementById('win-title');
    const subEl = document.getElementById('win-sub');
    const messageEl = document.getElementById('win-message');
    const movesEl = document.getElementById('win-moves');
    const scoreEl = document.getElementById('win-score');
    const bestScoreEl = document.getElementById('win-best-score');
    const parMovesEl = document.getElementById('win-par-moves');
    const parTimeEl = document.getElementById('win-par-time');

    movesEl.classList.remove('win-moves-optimal', 'win-moves-over');

    if (!dealBenchmark) {
      titleEl.textContent = 'You win!';
      subEl.textContent = 'Brilliant play.';
      messageEl.hidden = true;
      messageEl.textContent = '';
      if (scoreEl) scoreEl.textContent = '—';
      if (bestScoreEl) bestScoreEl.textContent = '—';
      if (parMovesEl) parMovesEl.textContent = '—';
      if (parTimeEl) parTimeEl.textContent = '—';
      return;
    }

    const playerScore = ScoreBenchmark.computePlayerScore(
      playerMoves,
      playerTimeMs,
      dealBenchmark
    );
    const summary = ScoreBenchmark.winSummary(
      playerScore,
      dealBenchmark,
      playerMoves,
      playerTimeMs
    );

    titleEl.textContent = summary.title;
    subEl.textContent = summary.sub;
    if (summary.message) {
      messageEl.hidden = false;
      messageEl.textContent = summary.message;
    } else {
      messageEl.hidden = true;
      messageEl.textContent = '';
    }

    if (scoreEl) scoreEl.textContent = String(playerScore);
    if (bestScoreEl) bestScoreEl.textContent = String(dealBenchmark.bestScore);
    if (parMovesEl) parMovesEl.textContent = String(dealBenchmark.bestMoves);
    if (parTimeEl) parTimeEl.textContent = ScoreBenchmark.formatTimeMs(dealBenchmark.bestTimeMs);

    if (playerMoves <= dealBenchmark.bestMoves) {
      movesEl.classList.add('win-moves-optimal');
    } else {
      movesEl.classList.add('win-moves-over');
    }
  }

  function showWinModal() {
    const ms = engine.elapsedMs();
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const playerMoves = engine.moves;

    document.getElementById('win-time').textContent = `${m}:${String(s).padStart(2, '0')}`;
    document.getElementById('win-moves').textContent = String(playerMoves);
    updateWinSeedRow(engine.seed || '—', getDisplayProfile());
    setWinScoreDisplay(playerMoves, ms);
    updateUndoButton();

    winModal.hidden = false;
    winModal.classList.add('modal-visible');
    if (window.SolitaireCelebration) window.SolitaireCelebration.celebrate();
  }

  function hideWinModal() {
    winModal.hidden = true;
    winModal.classList.remove('modal-visible');
    if (window.SolitaireCelebration) window.SolitaireCelebration.stop();
  }

  function buildWinShareText() {
    const time = document.getElementById('win-time').textContent;
    const score = document.getElementById('win-score').textContent;
    const seed = String(engine?.seed || '');
    let dealLine;
    if (currentMode === 'Daily') {
      const datePart = /^\d{4}-\d{2}-\d{2}/.test(seed) ? seed.slice(0, 10) : SolitaireDailySeed();
      dealLine = `Daily: ${SolitaireFormatDate(datePart)}`;
    } else {
      dealLine = `Seed: ${seed || '—'}`;
    }
    return `${dealLine}\nTime: ${time}\nScore: ${score}`;
  }

  async function copyWinShare() {
    const text = buildWinShareText();
    const shareBtn = document.getElementById('win-share');
    const originalLabel = shareBtn.textContent;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        if (!document.execCommand('copy')) throw new Error('copy failed');
        document.body.removeChild(textarea);
      }
      shareBtn.textContent = 'Copied!';
    } catch {
      shareBtn.textContent = 'Copy failed';
    }

    window.setTimeout(() => {
      shareBtn.textContent = originalLabel;
    }, 2000);
  }

  function replaySameDeal() {
    hideWinModal();
    if (!engine?.seed) return;
    if (currentMode === 'Seeded') startSeededGame(engine.seed);
    else if (currentMode === 'Daily') startSolvableGame(SolitaireDailySeed(), 'Daily');
    else startGame(engine.seed, currentMode, { keepOptimal: true });
  }

  document.getElementById('btn-appearance').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    CardAssets.preload().then(() => {
      buildAppearancePickers();
      showScreen('settings');
    });
  });

  document.getElementById('btn-settings-back').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    showScreen('menu');
  });

  document.getElementById('btn-settings-done').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    showScreen('menu');
  });

  document.getElementById('btn-random-deal').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    startRandomGame();
  });

  document.getElementById('btn-daily').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    startSolvableGame(SolitaireDailySeed(), 'Daily');
  });

  document.getElementById('btn-seed').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    const v = (seedInput.value || '').trim();
    if (!v) {
      seedInput.focus();
      seedInput.classList.add('input-error');
      setTimeout(() => seedInput.classList.remove('input-error'), 600);
      return;
    }
    startSeededGame(v);
  });

  seedInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-seed').click();
  });

  document.getElementById('btn-undo').addEventListener('click', () => {
    performUndo();
  });

  document.getElementById('btn-auto-complete').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    startAutoComplete();
  });

  document.getElementById('btn-menu').addEventListener('click', goToMenu);

  document.getElementById('btn-game-title').addEventListener('click', goToMenu);

  document.getElementById('btn-replay-deal').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    replaySameDeal();
  });

  document.getElementById('btn-new-game').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    hideWinModal();
    if (currentMode === 'Daily') startSolvableGame(SolitaireDailySeed(), 'Daily');
    else if (currentMode === 'Seeded' && engine?.seed) startSeededGame(engine.seed);
    else startRandomGame();
  });

  document.getElementById('btn-mute').addEventListener('click', () => {
    const btn = document.getElementById('btn-mute');
    const next = !SolitaireAudio.isMuted();
    SolitaireAudio.setMuted(next);
    btn.classList.toggle('muted', next);
    btn.setAttribute('aria-pressed', String(next));
  });

  document.getElementById('win-replay').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    replaySameDeal();
  });

  document.getElementById('win-new-deal').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    hideWinModal();
    document.getElementById('btn-new-game').click();
  });

  document.getElementById('win-share').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    copyWinShare();
  });

  document.getElementById('win-to-menu').addEventListener('click', goToMenu);

  document.body.addEventListener(
    'touchmove',
    (e) => {
      if (e.target.closest('.solitaire-board')) e.preventDefault();
    },
    { passive: false }
  );

  CardAssets.preload().then(() => buildAppearancePickers());
  initDifficultyPicker();
  SolitaireSolver.loadWasm();
  window.addEventListener('resize', fitGameBoard);
  window.visualViewport?.addEventListener('resize', fitGameBoard);
  PHONE_LANDSCAPE.addEventListener('change', updateLayoutMode);
  window.addEventListener('orientationchange', () => {
    requestAnimationFrame(updateLayoutMode);
  });
  window.visualViewport?.addEventListener('resize', updateLayoutMode);
  updateLayoutMode();
  showScreen('menu');
})();
