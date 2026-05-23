/**
 * Persists resolved seeds and solver profiles for Daily and Seeded deals.
 * Keeps only today's daily deal and up to 20 most recent seeded deals.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'solitaire-deal-cache-v1';
  const MAX_SEEDED = 20;
  const DAILY_PREFIX = 'daily:';
  const SEEDED_PREFIX = 'seeded:';

  function todayKey() {
    if (global.SolitaireDailySeed) return global.SolitaireDailySeed();
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function readAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : {};
    } catch {
      return {};
    }
  }

  function writeAll(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Could not save deal cache.', err);
    }
  }

  function entryKey(mode, key) {
    return `${mode}:${String(key)}`;
  }

  function pruneDaily(data) {
    const today = todayKey();
    for (const k of Object.keys(data)) {
      if (k.startsWith(DAILY_PREFIX) && k !== entryKey('daily', today)) {
        delete data[k];
      }
    }
  }

  function pruneSeeded(data) {
    const keys = Object.keys(data).filter((k) => k.startsWith(SEEDED_PREFIX));
    if (keys.length <= MAX_SEEDED) return;
    keys.sort((a, b) => (data[a].at || 0) - (data[b].at || 0));
    for (let i = 0; i < keys.length - MAX_SEEDED; i++) {
      delete data[keys[i]];
    }
  }

  function normalizeEntry(hit) {
    if (!hit || hit.seed == null) return null;
    return {
      seed: String(hit.seed),
      optimal: hit.optimal == null ? null : Number(hit.optimal),
      minimal_states: hit.minimal_states == null ? null : Number(hit.minimal_states),
      first_states: hit.first_states == null ? null : Number(hit.first_states),
      move_gap: hit.move_gap == null ? null : Number(hit.move_gap),
      score: hit.score == null ? null : Number(hit.score),
    };
  }

  function get(mode, key) {
    const data = readAll();
    pruneDaily(data);

    if (mode === 'daily' && String(key) !== todayKey()) {
      writeAll(data);
      return null;
    }

    const k = entryKey(mode, key);
    const hit = data[k];
    if (!hit) {
      writeAll(data);
      return null;
    }

    if (mode === 'seeded') {
      hit.at = Date.now();
      writeAll(data);
    } else {
      writeAll(data);
    }

    return normalizeEntry(hit);
  }

  function set(mode, key, entry) {
    const data = readAll();
    pruneDaily(data);

    if (mode === 'daily') {
      for (const k of Object.keys(data)) {
        if (k.startsWith(DAILY_PREFIX)) delete data[k];
      }
      key = todayKey();
    }

    data[entryKey(mode, key)] = {
      seed: String(entry.seed),
      optimal: entry.optimal == null ? null : Number(entry.optimal),
      minimal_states: entry.minimal_states == null ? null : Number(entry.minimal_states),
      first_states: entry.first_states == null ? null : Number(entry.first_states),
      move_gap: entry.move_gap == null ? null : Number(entry.move_gap),
      score: entry.score == null ? null : Number(entry.score),
      at: Date.now(),
    };

    if (mode === 'seeded') pruneSeeded(data);
    writeAll(data);
  }

  global.DealCache = {
    getDaily(dateKey) {
      return get('daily', dateKey);
    },
    setDaily(dateKey, entry) {
      set('daily', dateKey, entry);
    },
    getSeeded(userSeed) {
      return get('seeded', userSeed);
    },
    setSeeded(userSeed, entry) {
      set('seeded', userSeed, entry);
    },
  };
})(typeof window !== 'undefined' ? window : global);
