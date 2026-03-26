import { runRegisteredTests } from './test-utils.js';

window.__CB_DISABLE_BOOTSTRAP__ = true;

const suites = [
  './scoring.test.js',
  './data-validation.test.js',
  './router.test.js',
  './progress.test.js',
  './map.test.js',
  './library.test.js',
  './achievements.test.js',
  './integration.test.js'
];

for (const suite of suites) {
  await import(suite);
}

const resultsEl = document.getElementById('test-results');
const summaryEl = document.getElementById('test-summary');

const summary = await runRegisteredTests(resultsEl);
summaryEl.innerHTML = `
  <strong>${summary.passed}</strong> passed,
  <strong>${summary.failed}</strong> failed,
  <strong>${summary.total}</strong> total
`;
summaryEl.className = summary.failed === 0 ? 'summary-pass' : 'summary-fail';
