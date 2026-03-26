/**
 * scoring.js
 * Pure scoring helpers for Checks & Balances: The Simulation.
 *
 * This module deliberately knows nothing about the DOM. It only
 * understands scenario/step/choice data and returns numeric results.
 */

export const DIFFICULTY_MULTIPLIERS = Object.freeze({
  easy: 1,
  medium: 1.5,
  hard: 2,
  all: 1
});

export const GRADE_THRESHOLDS = Object.freeze([
  {
    minPercent: 90,
    letter: 'A',
    title: 'Chief Justice',
    description:
      'Outstanding constitutional analysis. You demonstrated mastery of doctrine, history, and structural reasoning.'
  },
  {
    minPercent: 75,
    letter: 'B',
    title: 'Associate Justice',
    description:
      'Strong performance. Your reasoning was sound, though a few harder doctrinal wrinkles remained contested.'
  },
  {
    minPercent: 60,
    letter: 'C',
    title: 'Circuit Judge',
    description:
      'Competent doctrinal work. You identified the major issues, but several distinctions need sharper precision.'
  },
  {
    minPercent: 50,
    letter: 'D',
    title: 'Magistrate Judge',
    description:
      'Passing familiarity with the material, but your analysis needs more discipline and doctrinal support.'
  },
  {
    minPercent: 0,
    letter: 'F',
    title: 'Overruled',
    description:
      'Your arguments did not carry the day. Review the doctrine and try again.'
  }
]);

/**
 * Normalizes any incoming answer-state value to one of the three
 * canonical states used across the application.
 *
 * @param {unknown} value
 * @returns {'correct' | 'partial' | 'incorrect'}
 */
export function normalizeOutcome(value) {
  if (value === true || value === 'correct') {
    return 'correct';
  }
  if (value === 'partial') {
    return 'partial';
  }
  return 'incorrect';
}

/**
 * @param {string} difficulty
 * @returns {number}
 */
export function getDifficultyMultiplier(difficulty = 'medium') {
  return DIFFICULTY_MULTIPLIERS[difficulty] ?? 1;
}

/**
 * Returns the maximum raw points available on a step before any
 * difficulty multiplier is applied.
 *
 * For multiple-choice and counter-argument steps, the maximum is the
 * highest declared point value among the choices.
 *
 * For argument-builder steps, the maximum is the sum of all positive
 * argument-option values.
 *
 * @param {object} step
 * @returns {number}
 */
export function getStepBasePoints(step = {}) {
  if (step.type === 'argument_builder') {
    const options = Array.isArray(step.argumentOptions) ? step.argumentOptions : [];
    return options
      .filter((option) => Number(option.points) > 0)
      .reduce((sum, option) => sum + Number(option.points || 0), 0);
  }

  const choices = Array.isArray(step.choices) ? step.choices : [];
  return choices.reduce((max, choice) => {
    const value = Number(choice?.points ?? 0);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
}

/**
 * Calculates the number of points earned for a multiple-choice style
 * response.
 *
 * Task 5 requirement: partial credit is always half of the points that
 * a fully correct answer would earn for the step, rounded up.
 *
 * @param {object} choice
 * @param {object} step
 * @param {string} difficulty
 * @returns {number}
 */
export function calculateChoicePoints(choice = {}, step = {}, difficulty = 'medium') {
  const outcome = normalizeOutcome(choice.correct);
  const multiplier = getDifficultyMultiplier(difficulty);
  const fullCredit = Math.max(0, Math.round(getStepBasePoints(step) * multiplier));

  if (outcome === 'correct') {
    return fullCredit;
  }

  if (outcome === 'partial') {
    return Math.ceil(fullCredit / 2);
  }

  return 0;
}

/**
 * Calculates the awarded points for an argument-builder step after the
 * caller has already summed the selected raw option values.
 *
 * Negative totals remain negative so the game can penalize weak
 * arguments. This is the only path in the game where a negative score
 * is possible.
 *
 * @param {number} rawPoints
 * @param {string} difficulty
 * @returns {number}
 */
export function calculateArgumentBuilderPoints(rawPoints = 0, difficulty = 'medium') {
  const multiplier = getDifficultyMultiplier(difficulty);
  return Math.round(Number(rawPoints || 0) * multiplier);
}

/**
 * Calculates the maximum possible score for a single scenario.
 *
 * @param {object} scenario
 * @param {string} difficulty
 * @returns {number}
 */
export function getScenarioMaxPoints(scenario = {}, difficulty = 'medium') {
  const steps = Array.isArray(scenario.steps) ? scenario.steps : [];
  return steps.reduce((sum, step) => {
    const base = getStepBasePoints(step);
    return sum + Math.round(base * getDifficultyMultiplier(difficulty));
  }, 0);
}

/**
 * Calculates the maximum possible score for an array of scenarios.
 *
 * @param {Array<object>} scenarios
 * @param {string} difficulty
 * @returns {number}
 */
export function getMaxPoints(scenarios = [], difficulty = 'medium') {
  return (Array.isArray(scenarios) ? scenarios : []).reduce(
    (sum, scenario) => sum + getScenarioMaxPoints(scenario, difficulty),
    0
  );
}

/**
 * Converts a total score into a percentage. Negative totals are clamped
 * at 0 so grades never dip below 0%.
 *
 * @param {number} totalPoints
 * @param {number} maxPossiblePoints
 * @returns {number}
 */
export function calculatePercentage(totalPoints, maxPossiblePoints) {
  const safeMax = Math.max(0, Number(maxPossiblePoints || 0));
  const safeTotal = Math.max(0, Number(totalPoints || 0));

  if (safeMax === 0) {
    return 0;
  }

  return Math.round((safeTotal / safeMax) * 100);
}

/**
 * Determines the letter-grade bundle for a completed session.
 *
 * @param {number} totalPoints
 * @param {number} maxPossiblePoints
 * @returns {{ letter: string, title: string, description: string, percentage: number }}
 */
export function calculateGrade(totalPoints, maxPossiblePoints) {
  const percentage = calculatePercentage(totalPoints, maxPossiblePoints);
  const threshold = GRADE_THRESHOLDS.find((tier) => percentage >= tier.minPercent)
    ?? GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1];

  return {
    letter: threshold.letter,
    title: threshold.title,
    description: threshold.description,
    percentage
  };
}
