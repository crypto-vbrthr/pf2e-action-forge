/**
 * PF2e level-based DC helper based on GM Core / Kernregeln: Spielleitung p. 53.
 *
 * The source table defines base DCs for levels 0-25 and difficulty adjustments
 * of -10, -5, -2, +2, +5, and +10. "standard" represents the unadjusted
 * level DC and is provided as a UI convenience.
 */

export const LEVEL_DCS = Object.freeze({
  0: 14,
  1: 15,
  2: 16,
  3: 18,
  4: 19,
  5: 20,
  6: 22,
  7: 23,
  8: 24,
  9: 26,
  10: 27,
  11: 28,
  12: 30,
  13: 31,
  14: 32,
  15: 34,
  16: 35,
  17: 36,
  18: 38,
  19: 39,
  20: 40,
  21: 42,
  22: 44,
  23: 46,
  24: 48,
  25: 50
});

export const DIFFICULTY_ADJUSTMENTS = Object.freeze({
  "incredibly-easy": -10,
  "very-easy": -5,
  easy: -2,
  standard: 0,
  hard: 2,
  "very-hard": 5,
  "incredibly-hard": 10
});

export const DIFFICULTY_ORDER = Object.freeze([
  "incredibly-easy",
  "very-easy",
  "easy",
  "standard",
  "hard",
  "very-hard",
  "incredibly-hard"
]);

export function normalizeLevelDcLevel(value) {
  if (value === null || value === undefined || value === "") return null;
  const level = Number(value);
  return Number.isInteger(level) && Object.hasOwn(LEVEL_DCS, level) ? level : null;
}

export function normalizeLevelDcDifficulty(value) {
  const difficulty = String(value ?? "standard");
  return Object.hasOwn(DIFFICULTY_ADJUSTMENTS, difficulty) ? difficulty : null;
}

export function calculateLevelDc(level, difficulty = "standard") {
  const normalizedLevel = normalizeLevelDcLevel(level);
  const normalizedDifficulty = normalizeLevelDcDifficulty(difficulty);
  if (normalizedLevel === null || normalizedDifficulty === null) return null;

  const baseDc = LEVEL_DCS[normalizedLevel];
  const adjustment = DIFFICULTY_ADJUSTMENTS[normalizedDifficulty];
  return Object.freeze({
    level: normalizedLevel,
    baseDc,
    difficulty: normalizedDifficulty,
    adjustment,
    dc: baseDc + adjustment
  });
}

export function getLevelDcOptions() {
  return Object.entries(LEVEL_DCS).map(([level, dc]) => ({ level: Number(level), dc }));
}

export function getDifficultyOptions() {
  return DIFFICULTY_ORDER.map((id) => ({ id, adjustment: DIFFICULTY_ADJUSTMENTS[id] }));
}
