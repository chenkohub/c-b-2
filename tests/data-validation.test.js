import { campaignOrder } from '../game.js';
import { test, assert, equal } from './test-utils.js';

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

const VALID_CORRECT_VALUES = new Set(['correct', 'partial', 'incorrect']);

function hasValidReferenceYear(value) {
  return value === null || Number.isFinite(Number(value));
}

function validateChoice(choice, scenarioId, stepIndex, choiceIndex) {
  assert(choice && typeof choice === 'object', `Choice ${scenarioId} step ${stepIndex + 1} choice ${choiceIndex + 1} must be an object.`);
  assert(typeof choice.text === 'string' && choice.text.trim(), `Choice ${scenarioId} step ${stepIndex + 1} choice ${choiceIndex + 1} is missing text.`);
  assert(Number.isFinite(Number(choice.points)), `Choice ${scenarioId} step ${stepIndex + 1} choice ${choiceIndex + 1} is missing numeric points.`);
  assert(VALID_CORRECT_VALUES.has(choice.correct), `Choice ${scenarioId} step ${stepIndex + 1} choice ${choiceIndex + 1} has invalid correct state: ${choice.correct}`);
  assert(typeof choice.explanation === 'string', `Choice ${scenarioId} step ${stepIndex + 1} choice ${choiceIndex + 1} is missing explanation.`);
}

test('Every scenario in scenarios.json has the required canonical fields.', async () => {
  const scenarios = await loadJson('../data/scenarios.json');
  assert(Array.isArray(scenarios) && scenarios.length > 0, 'Expected scenarios.json to contain a non-empty array.');

  scenarios.forEach((scenario) => {
    assert(typeof scenario.id === 'string' && scenario.id.trim(), 'Scenario is missing id.');
    assert(typeof scenario.title === 'string' && scenario.title.trim(), `Scenario ${scenario.id} is missing title.`);
    assert(typeof scenario.branch === 'string' && scenario.branch.trim(), `Scenario ${scenario.id} is missing branch.`);
    assert(typeof scenario.doctrineArea === 'string' && scenario.doctrineArea.trim(), `Scenario ${scenario.id} is missing doctrineArea.`);
    assert(typeof scenario.difficulty === 'string' && scenario.difficulty.trim(), `Scenario ${scenario.id} is missing difficulty.`);
    assert(typeof scenario.description === 'string' && scenario.description.trim(), `Scenario ${scenario.id} is missing description.`);
    assert(Array.isArray(scenario.steps) && scenario.steps.length > 0, `Scenario ${scenario.id} must have at least one step.`);
    assert(typeof scenario.overallExplanation === 'string', `Scenario ${scenario.id} must include overallExplanation.`);
    assert(Array.isArray(scenario.caseReferences), `Scenario ${scenario.id} must include caseReferences array.`);
  });
});

test('Every campaignOrder id exists in scenarios.json exactly once.', async () => {
  const scenarios = await loadJson('../data/scenarios.json');
  const idCounts = new Map();
  scenarios.forEach((scenario) => {
    idCounts.set(scenario.id, (idCounts.get(scenario.id) || 0) + 1);
  });

  campaignOrder.forEach((id) => {
    equal(idCounts.get(id), 1, `Expected campaign scenario ${id} to exist exactly once.`);
  });
});

test('Every choice uses only canonical correct values.', async () => {
  const scenarios = await loadJson('../data/scenarios.json');
  scenarios.forEach((scenario) => {
    scenario.steps.forEach((step, stepIndex) => {
      const choices = Array.isArray(step.choices) ? step.choices : [];
      choices.forEach((choice, choiceIndex) => validateChoice(choice, scenario.id, stepIndex, choiceIndex));
    });
  });
});

test('Every reference in cases.json contains the required reference fields.', async () => {
  const cases = await loadJson('../data/cases.json');
  assert(Array.isArray(cases) && cases.length > 0, 'Expected cases.json to contain a non-empty array.');

  cases.forEach((record) => {
    assert(typeof record.id === 'string' && record.id.trim(), 'Reference is missing id.');
    assert(typeof record.name === 'string' && record.name.trim(), `Reference ${record.id} is missing name.`);
    assert(hasValidReferenceYear(record.year), `Reference ${record.id} must include a numeric year or null.`);
    assert(typeof record.citation === 'string', `Reference ${record.id} is missing citation.`);
    assert(typeof record.holding === 'string' && record.holding.trim(), `Reference ${record.id} is missing holding.`);
    assert(typeof record.significance === 'string' && record.significance.trim(), `Reference ${record.id} is missing significance.`);
    assert(Array.isArray(record.doctrineAreas), `Reference ${record.id} is missing doctrineAreas.`);
    assert('keyQuote' in record, `Reference ${record.id} must include keyQuote, even if empty.`);
  });
});
