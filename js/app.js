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

  const previewCard = { suit: 'hearts', rank: 1, faceUp: true };

  let engine = null;
  let ui = null;
  let timerId = null;
  let currentMode = '';
  let resolvingDeal = false;
  let optimalMoveCount = null;
  let dealProfile = null;
  const DIFFICULTY_STORAGE = 'solitaire-random-difficulty';

  function applyDealProfile(profile) {
    dealProfile = profile && profile.label ? profile : null;
    optimalMoveCount =
      dealProfile && dealProfile.optimal != null ? dealProfile.optimal : null;
    refreshDifficultyBadges();
  }

  function refreshDifficultyBadges() {
    const profile = getDisplayProfile();
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
    DealDifficulty.setBadgeElement(winBadgeEl, profile || getDisplayProfile());
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      if (engine && ui) ui.updateTimer(engine.elapsedMs());
    }, 1000);
  }

  function showScreen(screen) {
    menuScreen.hidden = screen !== 'menu';
    settingsScreen.hidden = screen !== 'settings';
    gameScreen.hidden = screen !== 'game';
    document.body.classList.toggle('game-active', screen === 'game');
    if (screen === 'game') {
      window.scrollTo(0, 0);
      gameScreen.scrollTop = 0;
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
    }
    engine = new SolitaireEngine(seedStr);
    currentMode = modeLabel || 'Random';

    if (!ui) {
      ui = new GameUI(boardEl, engine, {
        onMove() {
          ui.updateMoves(engine.moves);
        },
        onWin() {
          stopTimer();
          showWinModal();
        },
      });
    } else {
      ui.setEngine(engine);
      boardEl.classList.remove('game-won');
    }

    updateGameSubtitle(seedStr, currentMode);
    if (!dealProfile && !(options && options.skipProfileResolve)) {
      ensureDealProfileAsync(seedStr);
    }

    ui.updateMoves(0);
    ui.updateTimer(0);
    ui.render();
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

  function setWinComparison(playerMoves, optimal) {
    const titleEl = document.getElementById('win-title');
    const subEl = document.getElementById('win-sub');
    const messageEl = document.getElementById('win-message');
    const movesEl = document.getElementById('win-moves');
    const optimalEl = document.getElementById('win-optimal');

    optimalEl.textContent = optimal == null ? '—' : String(optimal);
    movesEl.classList.remove('win-moves-optimal', 'win-moves-over');

    if (optimal == null) {
      titleEl.textContent = 'You win!';
      subEl.textContent = 'Brilliant play.';
      messageEl.hidden = true;
      messageEl.textContent = '';
      return;
    }

    const extra = playerMoves - optimal;
    if (extra <= 0) {
      titleEl.textContent = 'Perfect!';
      subEl.textContent = 'You found the optimal solution.';
      movesEl.classList.add('win-moves-optimal');
      messageEl.hidden = true;
      messageEl.textContent = '';
      return;
    }

    titleEl.textContent = 'You win!';
    subEl.textContent =
      extra === 1
        ? `One move over optimal — can you match ${optimal}?`
        : `${extra} moves over optimal — can you beat ${optimal}?`;
    movesEl.classList.add('win-moves-over');
    messageEl.hidden = false;
    messageEl.textContent = `You used ${playerMoves} moves; the solver needs only ${optimal}.`;
  }

  async function showWinModal() {
    const ms = engine.elapsedMs();
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const playerMoves = engine.moves;

    document.getElementById('win-time').textContent = `${m}:${String(s).padStart(2, '0')}`;
    document.getElementById('win-moves').textContent = String(playerMoves);
    updateWinSeedRow(engine.seed || '—', getDisplayProfile());
    document.getElementById('win-optimal').textContent = '…';
    document.getElementById('win-message').hidden = true;
    document.getElementById('win-sub').textContent = 'Checking your score…';
    document.getElementById('win-title').textContent = 'You win!';
    document.getElementById('win-moves').classList.remove('win-moves-optimal', 'win-moves-over');

    winModal.hidden = false;
    winModal.classList.add('modal-visible');

    let optimal = optimalMoveCount;
    if (dealProfile == null || dealProfile.optimal == null) {
      const profile = await resolveDealProfile(engine.seed, { pass: 'win-modal', requireMinimal: true });
      if (profile) applyDealProfile(profile);
      optimal = dealProfile && dealProfile.optimal != null ? dealProfile.optimal : optimal;
      if (currentMode === 'Seeded' && engine?.seed && dealProfile) {
        saveSeededCache(engine.seed, engine.seed, dealProfile);
      }
      if (currentMode === 'Daily' && engine?.seed && dealProfile) {
        saveDailyCache(SolitaireDailySeed(), engine.seed, dealProfile);
      }
    }

    updateWinSeedRow(engine.seed || '—', getDisplayProfile());
    setWinComparison(playerMoves, optimal);
  }

  function hideWinModal() {
    winModal.hidden = true;
    winModal.classList.remove('modal-visible');
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

  document.getElementById('btn-menu').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    stopTimer();
    hideWinModal();
    showScreen('menu');
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

  document.getElementById('win-try-again').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    hideWinModal();
    if (!engine?.seed) return;
    if (currentMode === 'Seeded') startSeededGame(engine.seed);
    else if (currentMode === 'Daily') startSolvableGame(SolitaireDailySeed(), 'Daily');
    else startGame(engine.seed, currentMode, { keepOptimal: true });
  });

  document.getElementById('win-new-deal').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    hideWinModal();
    document.getElementById('btn-new-game').click();
  });

  document.getElementById('win-to-menu').addEventListener('click', () => {
    SolitaireAudio.uiClick();
    hideWinModal();
    document.getElementById('btn-menu').click();
  });

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
  showScreen('menu');
})();
