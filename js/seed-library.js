/**
 * Static quick-solved deal library for instant random difficulty selection.
 * Entries are [seed, score, move_count, states, first_solution_states, move_gap].
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'solitaire-seed-library-seen-v1';
  const DATA = {
    easy: [
      ['library#73', 0.334, 97, 207, 206, 0],
      ['library#77', 0.335, 95, 301, 300, 0],
      ['library#81', 0.362, 99, 308, 307, 0],
      ['library#39', 0.378, 102, 281, 280, 0],
      ['library#88', 0.381, 101, 366, 365, 0],
      ['library#135', 0.39, 105, 230, 229, 0],
      ['library#48', 0.406, 103, 509, 508, 0],
      ['library#129', 0.413, 106, 364, 363, 0],
      ['library#56', 0.413, 106, 370, 369, 0],
      ['library#21', 0.434, 106, 656, 655, 0],
      ['library#59', 0.441, 104, 1142, 1141, 0],
      ['library#33', 0.445, 105, 1059, 1058, 0],
      ['library#63', 0.449, 108, 691, 690, 0],
    ],
    medium: [
      ['library#19', 0.45, 92, 12404, 12403, 0],
      ['library#71', 0.457, 103, 2102, 2101, 0],
      ['library#89', 0.463, 111, 596, 595, 0],
      ['library#52', 0.466, 103, 2697, 2696, 0],
      ['library#95', 0.472, 109, 1091, 1090, 0],
      ['library#46', 0.482, 104, 3570, 3569, 0],
      ['library#38', 0.488, 103, 5006, 5005, 0],
      ['library#47', 0.491, 107, 2662, 2661, 0],
      ['library#78', 0.494, 107, 2916, 2915, 0],
      ['library#53', 0.498, 117, 548, 547, 0],
      ['library#79', 0.498, 108, 2727, 2726, 0],
      ['library#28', 0.499, 114, 947, 946, 0],
      ['library#29', 0.5, 116, 684, 683, 0],
      ['library#72', 0.501, 116, 698, 697, 0],
      ['library#69', 0.503, 111, 1799, 1798, 0],
      ['library#27', 0.505, 112, 1618, 1617, 0],
      ['library#70', 0.505, 113, 1331, 1330, 0],
      ['library#24', 0.507, 112, 1679, 1678, 0],
      ['library#85', 0.51, 117, 761, 760, 0],
      ['library#0', 0.512, 115, 1138, 1137, 0],
      ['library#114', 0.514, 110, 2956, 2955, 0],
      ['library#50', 0.516, 114, 1510, 1509, 0],
      ['library#57', 0.518, 117, 943, 942, 0],
      ['library#60', 0.518, 114, 1633, 1632, 0],
      ['library#91', 0.519, 113, 1964, 1963, 0],
      ['library#139', 0.52, 113, 2057, 2056, 0],
      ['library#74', 0.521, 106, 7180, 7179, 0],
      ['library#55', 0.522, 105, 8791, 8790, 0],
      ['library#94', 0.522, 108, 5288, 5287, 0],
      ['library#11', 0.525, 109, 4764, 4763, 0],
      ['library#8', 0.526, 120, 696, 695, 0],
      ['library#106', 0.528, 114, 2114, 2113, 0],
      ['library#108', 0.53, 118, 1119, 1118, 0],
      ['library#62', 0.534, 111, 4237, 4236, 0],
      ['library#22', 0.536, 104, 228065, 228064, 0],
      ['library#134', 0.54, 111, 5043, 5042, 0],
      ['library#23', 0.541, 120, 1045, 1044, 0],
      ['library#58', 0.541, 112, 4352, 4351, 0],
      ['library#7', 0.542, 114, 3151, 3150, 0],
      ['library#101', 0.548, 118, 1831, 1830, 0],
      ['library#64', 0.551, 122, 957, 956, 0],
      ['library#99', 0.551, 122, 956, 955, 0],
      ['library#66', 0.561, 115, 4372, 4371, 0],
      ['library#104', 0.565, 122, 1417, 1416, 0],
      ['library#111', 0.565, 116, 4182, 4181, 0],
      ['library#107', 0.567, 118, 3107, 3106, 0],
      ['library#26', 0.568, 124, 1092, 1091, 0],
      ['library#109', 0.578, 127, 845, 844, 0],
      ['library#113', 0.588, 117, 6593, 6592, 0],
      ['library#127', 0.592, 124, 2096, 2095, 0],
      ['library#76', 0.593, 128, 1053, 1052, 0],
    ],
    hard: [
      ['library#122', 0.601, 114, 157143, 157142, 0],
      ['library#128', 0.601, 114, 720437, 720436, 0],
      ['library#115', 0.607, 115, 39090, 39089, 0],
      ['library#117', 0.609, 122, 4788, 4787, 0],
      ['library#16', 0.612, 125, 3087, 3086, 0],
      ['library#2', 0.612, 129, 1490, 1489, 0],
      ['library#92', 0.613, 125, 3190, 3189, 0],
      ['library#34', 0.614, 116, 31598, 31597, 0],
      ['library#90', 0.614, 116, 28012, 28011, 0],
      ['library#44', 0.615, 122, 5742, 5741, 0],
      ['library#54', 0.615, 125, 3296, 3295, 0],
      ['library#51', 0.616, 132, 995, 994, 0],
      ['library#136', 0.616, 128, 2018, 2017, 0],
      ['library#45', 0.62, 117, 25284, 25283, 0],
      ['library#120', 0.62, 117, 31843, 31842, 0],
      ['library#1', 0.626, 125, 4536, 4535, 0],
      ['library#35', 0.626, 118, 178237, 178236, 0],
      ['library#30', 0.628, 123, 6794, 6793, 0],
      ['library#3', 0.633, 119, 18772, 18771, 0],
      ['library#18', 0.634, 127, 4002, 4001, 0],
      ['library#31', 0.634, 131, 1940, 1939, 0],
      ['library#96', 0.646, 135, 1347, 1346, 0],
      ['library#12', 0.649, 122, 14565, 14564, 0],
      ['library#41', 0.652, 122, 16994, 16993, 0],
      ['library#25', 0.653, 125, 9563, 9562, 0],
      ['library#93', 0.659, 123, 35668, 35667, 0],
      ['library#123', 0.659, 123, 710117, 710116, 0],
      ['library#110', 0.663, 132, 3641, 3640, 0],
      ['library#82', 0.674, 132, 4864, 4863, 0],
      ['library#97', 0.675, 134, 3535, 3534, 0],
      ['library#14', 0.678, 126, 18776, 18775, 0],
      ['library#5', 0.678, 135, 3228, 3227, 0],
      ['library#75', 0.678, 126, 16930, 16929, 0],
      ['library#87', 0.69, 134, 5378, 5377, 0],
      ['library#4', 0.691, 128, 21065, 21064, 0],
      ['library#137', 0.71, 131, 20242, 20241, 0],
      ['library#37', 0.716, 132, 21225, 21224, 0],
      ['library#43', 0.735, 141, 5389, 5388, 0],
      ['library#102', 0.736, 135, 213917, 213916, 0],
      ['library#100', 0.742, 136, 23938, 23937, 0],
    ],
    expert: [
      ['library#116', 0.755, 138, 149045, 149044, 0],
      ['library#49', 0.8, 150, 25707, 25706, 0],
    ],
  };

  function readSeen() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  function writeSeen(seen) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
    } catch (err) {
      console.warn('Could not save seen seed library entries.', err);
    }
  }

  function toResult(entry) {
    const [, , moves, states, firstStates, moveGap] = entry;
    return {
      solved: true,
      minimal: false,
      move_count: moves,
      states,
      first_solution_moves: moves,
      first_solution_states: firstStates,
      move_gap: moveGap,
      moves: [],
      error: null,
    };
  }

  function toHit(entry, difficultyId) {
    const [seed, score] = entry;
    const result = toResult(entry);
    const profile = global.DealDifficulty.fromSolveResult(result);
    return {
      seed,
      difficultyId,
      score,
      result,
      profile,
      profileSource: 'seed-library',
    };
  }

  function next(difficultyId) {
    const entries = DATA[difficultyId] || [];
    if (!entries.length) return null;

    const seen = readSeen();
    const unseen = entries.filter(([seed]) => !seen.has(seed));
    if (!unseen.length) return null;

    const entry = unseen[Math.floor(Math.random() * unseen.length)];
    seen.add(entry[0]);
    writeSeen(seen);
    return toHit(entry, difficultyId);
  }

  global.SolitaireSeedLibrary = {
    DATA,
    next,
  };
})(typeof window !== 'undefined' ? window : global);
