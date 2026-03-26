import { buildLibraryEntries, filterLibraryEntries, sortLibraryEntries, renderLibrary } from '../library.js';
import { test, assert, equal, wait } from './test-utils.js';

const scenarioCatalog = [
  {
    id: 'alpha',
    title: 'Alpha Scenario',
    doctrineArea: 'Doctrine Alpha',
    branch: 'judiciary',
    difficulty: 'easy',
    description: 'Alpha description.'
  },
  {
    id: 'beta',
    title: 'Beta Scenario',
    doctrineArea: 'Doctrine Beta',
    branch: 'congress',
    difficulty: 'medium',
    description: 'Beta description.'
  },
  {
    id: 'gamma',
    title: 'Gamma Scenario',
    doctrineArea: 'Doctrine Alpha',
    branch: 'president',
    difficulty: 'hard',
    description: 'Gamma description.'
  }
];

function baseProfile() {
  return {
    settings: { mentorCharacterId: 'chief-clerk', sandboxEnabled: false },
    scenarioProgress: {
      alpha: { unlocked: true, completed: true, stars: 3, bestPercent: 100, bestScore: 10, attempts: 1, lastPlayedAt: '2026-03-25T00:00:00.000Z' },
      beta: { unlocked: true, completed: false, stars: 0, bestPercent: 0, bestScore: 0, attempts: 0, lastPlayedAt: null },
      gamma: { unlocked: false, completed: false, stars: 0, bestPercent: 0, bestScore: 0, attempts: 0, lastPlayedAt: null }
    }
  };
}

function mountLibraryShell() {
  const root = document.getElementById('fixture-root');
  root.innerHTML = `
    <input id="library-search" class="library-filter" />
    <select id="library-branch-filter" class="library-filter">
      <option value="all">All</option>
      <option value="judiciary">Judiciary</option>
      <option value="congress">Congress</option>
      <option value="president">President</option>
    </select>
    <select id="library-doctrine-filter" class="library-filter"><option value="all">All</option></select>
    <select id="library-difficulty-filter" class="library-filter">
      <option value="all">All</option>
      <option value="easy">Easy</option>
      <option value="medium">Medium</option>
      <option value="hard">Hard</option>
    </select>
    <select id="library-status-filter" class="library-filter">
      <option value="all">All</option>
      <option value="unlocked">Unlocked</option>
      <option value="completed">Completed</option>
      <option value="mastered">Mastered</option>
      <option value="locked">Locked</option>
    </select>
    <select id="library-sort" class="library-filter">
      <option value="title">Title</option>
      <option value="doctrine">Doctrine</option>
      <option value="bestScore">Best Score</option>
      <option value="recentlyPlayed">Recently Played</option>
    </select>
    <input id="library-sandbox-toggle" type="checkbox" />
    <div id="library-result-count"></div>
    <div id="library-card-grid"></div>
    <div id="library-mentor-panel"></div>
    <div id="app-modal"></div>
    <div id="app-modal-title"></div>
    <div id="app-modal-body"></div>
    <div id="app-modal-actions"></div>
    <button id="app-modal-close-btn" type="button"></button>
  `;
}

test('Library filtering and sorting work together.', async () => {
  const entries = buildLibraryEntries(scenarioCatalog, baseProfile());
  const filtered = filterLibraryEntries(entries, { search: 'doctrine alpha', branch: 'all', doctrine: 'all', difficulty: 'all', status: 'all' });
  equal(filtered.length, 2);

  const sorted = sortLibraryEntries(entries, 'bestScore');
  equal(sorted[0].id, 'alpha');
});

test('Locked scenarios stay disabled when sandbox is off.', async () => {
  mountLibraryShell();
  const profile = baseProfile();
  await renderLibrary({ scenarioCatalog, profile, onPlay: () => {} });

  const lockedCardButton = document.querySelector('[data-scenario-id="gamma"] .library-play-btn');
  assert(lockedCardButton.disabled === true, 'Locked scenario should be disabled when sandbox mode is off.');
});

test('Locked scenarios launch practice-only mode when sandbox is on.', async () => {
  mountLibraryShell();
  const profile = baseProfile();
  profile.settings.sandboxEnabled = true;
  let launchOptions = null;

  await renderLibrary({
    scenarioCatalog,
    profile,
    onPlay: (_entry, options) => {
      launchOptions = options;
    }
  });

  const lockedCardButton = document.querySelector('[data-scenario-id="gamma"] .library-play-btn');
  lockedCardButton.click();
  await wait(20);

  assert(launchOptions?.practiceOnly === true, 'Locked sandbox launch should be marked practice-only.');
});
