import {
  DIFFICULTY_MULTIPLIERS,
  calculateArgumentBuilderPoints,
  calculateChoicePoints,
  calculateGrade,
  calculatePercentage,
  getScenarioMaxPoints,
  normalizeOutcome
} from '../scoring.js';
import { test, assert, equal, deepEqual } from './test-utils.js';

const multipleChoiceStep = {
  type: 'multiple_choice',
  choices: [
    { text: 'Best answer', points: 10, correct: 'correct' },
    { text: 'Partial answer', points: 2, correct: 'partial' },
    { text: 'Wrong answer', points: 0, correct: 'incorrect' }
  ]
};

test('Difficulty multipliers remain stable across all declared levels.', () => {
  deepEqual(DIFFICULTY_MULTIPLIERS, {
    easy: 1,
    medium: 1.5,
    hard: 2,
    all: 1
  });
});

test('normalizeOutcome canonicalizes booleans and legacy strings.', () => {
  equal(normalizeOutcome(true), 'correct');
  equal(normalizeOutcome('correct'), 'correct');
  equal(normalizeOutcome('partial'), 'partial');
  equal(normalizeOutcome(false), 'incorrect');
  equal(normalizeOutcome('anything-else'), 'incorrect');
});

test('calculateChoicePoints awards full credit for correct answers at each difficulty.', () => {
  equal(calculateChoicePoints({ correct: 'correct' }, multipleChoiceStep, 'easy'), 10);
  equal(calculateChoicePoints({ correct: 'correct' }, multipleChoiceStep, 'medium'), 15);
  equal(calculateChoicePoints({ correct: 'correct' }, multipleChoiceStep, 'hard'), 20);
});

test('calculateChoicePoints awards half credit rounded up for partial answers.', () => {
  equal(calculateChoicePoints({ correct: 'partial' }, multipleChoiceStep, 'easy'), 5);
  equal(calculateChoicePoints({ correct: 'partial' }, multipleChoiceStep, 'medium'), 8);
  equal(calculateChoicePoints({ correct: 'partial' }, multipleChoiceStep, 'hard'), 10);
});

test('calculateChoicePoints awards zero for incorrect answers.', () => {
  equal(calculateChoicePoints({ correct: 'incorrect' }, multipleChoiceStep, 'easy'), 0);
  equal(calculateChoicePoints({ correct: false }, multipleChoiceStep, 'hard'), 0);
});

test('calculateArgumentBuilderPoints preserves negative penalties and scales them by difficulty.', () => {
  equal(calculateArgumentBuilderPoints(6, 'easy'), 6);
  equal(calculateArgumentBuilderPoints(6, 'medium'), 9);
  equal(calculateArgumentBuilderPoints(6, 'hard'), 12);
  equal(calculateArgumentBuilderPoints(-3, 'hard'), -6);
});

test('getScenarioMaxPoints sums per-step maximums with difficulty scaling.', () => {
  const scenario = {
    steps: [
      multipleChoiceStep,
      {
        type: 'argument_builder',
        argumentOptions: [
          { text: 'Strong argument', points: 4 },
          { text: 'Another strong argument', points: 6 },
          { text: 'Weak argument', points: -2 }
        ]
      }
    ]
  };

  equal(getScenarioMaxPoints(scenario, 'easy'), 20);
  equal(getScenarioMaxPoints(scenario, 'medium'), 30);
  equal(getScenarioMaxPoints(scenario, 'hard'), 40);
});

test('calculateGrade assigns the correct letter at every threshold boundary.', () => {
  equal(calculateGrade(90, 100).letter, 'A');
  equal(calculateGrade(89, 100).letter, 'B');
  equal(calculateGrade(75, 100).letter, 'B');
  equal(calculateGrade(74, 100).letter, 'C');
  equal(calculateGrade(60, 100).letter, 'C');
  equal(calculateGrade(59, 100).letter, 'D');
  equal(calculateGrade(50, 100).letter, 'D');
  equal(calculateGrade(49, 100).letter, 'F');
});

test('calculatePercentage handles zero, perfect, and negative totals safely.', () => {
  equal(calculatePercentage(0, 100), 0);
  equal(calculatePercentage(100, 100), 100);
  equal(calculatePercentage(-15, 100), 0);
  equal(calculatePercentage(25, 0), 0);
});

test('grade objects always include descriptive metadata for display.', () => {
  const grade = calculateGrade(100, 100);
  assert(Boolean(grade.title), 'Expected a grade title.');
  assert(Boolean(grade.description), 'Expected a grade description.');
  equal(grade.percentage, 100);
});
