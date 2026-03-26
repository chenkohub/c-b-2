import { initGame, __testHooks, SAVE_STORAGE_KEY } from '../game.js';
import { renderCasePopup, hideCasePopup } from '../cases.js';
import { loadPlayerProfile, applySessionProgress } from '../progress.js';
import { recordCompletedSession, loadAnalyticsHistory } from '../analytics.js';
import { test, assert, equal, includes, wait } from './test-utils.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mountAppShell() {
  const root = document.getElementById('fixture-root');
  root.innerHTML = `
    <div id="aria-live-region" aria-live="polite" aria-atomic="true"></div>

    <section id="landing-screen" class="screen active" aria-hidden="false"></section>

    <section id="game-screen" class="screen hidden" aria-hidden="true">
      <header class="game-header">
        <span id="branch-badge" class="branch-badge"></span>
        <div id="timer-display" class="timer-display hidden"><span id="timer-time">00:00</span></div>
        <div id="score-value">0</div>
        <button id="save-quit-btn" type="button">Save &amp; Quit</button>
        <button id="dark-mode-toggle" type="button">🌙</button>
      </header>

      <div class="progress-container" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
        <div id="progress-bar"></div>
        <span id="progress-label"></span>
      </div>

      <div id="timer-controls" class="hidden">
        <button id="timer-pause-btn" type="button">Pause</button>
        <button id="timer-resume-btn" class="hidden" type="button">Resume</button>
        <button id="timer-extend-btn" type="button">Extend</button>
      </div>

      <div id="scenario-title"></div>
      <div id="difficulty-badge"></div>
      <div id="doctrine-tag"></div>
      <div id="step-indicator"></div>
      <div id="scenario-description"></div>
      <div id="scenario-prompt"></div>
      <div id="choices-container"></div>
      <div id="argument-builder-container" class="hidden"></div>
      <div id="counter-argument-container" class="hidden"></div>

      <aside id="precedent-tracker" class="hidden">
        <ul class="precedent-list"><li class="precedent-empty">No precedents</li></ul>
      </aside>
    </section>

    <section id="dashboard-screen" class="screen hidden" aria-hidden="true">
      <button id="dashboard-back-btn" type="button">Back</button>
      <button id="export-csv-btn" type="button">Export</button>
      <button id="clear-history-btn" type="button">Clear</button>
      <div id="dashboard-empty-state"></div>
      <div id="dashboard-content" class="hidden"></div>
      <div id="dashboard-total-sessions"></div>
      <div id="dashboard-average-score"></div>
      <div id="dashboard-best-score"></div>
      <div id="dashboard-doctrine-breakdown"></div>
      <ul id="dashboard-weakest-doctrines"></ul>
      <table><tbody id="dashboard-session-history-body"></tbody></table>
    </section>

    <section id="end-screen" class="screen hidden" aria-hidden="true">
      <div id="end-total-score"></div>
      <div id="end-max-score"></div>
      <div id="end-percentage"></div>
      <div id="end-grade-badge"></div>
      <div id="end-grade-description"></div>
      <div id="end-breakdown"></div>
      <div id="exam-review-container" class="hidden"></div>
      <button id="restart-btn" type="button">Restart</button>
    </section>

    <div id="feedback-modal" class="modal-overlay hidden" aria-hidden="true">
      <button id="feedback-close-btn" type="button">Close</button>
      <div id="feedback-content"></div>
    </div>

    <div id="app-modal" class="modal-overlay hidden" aria-hidden="true">
      <button id="app-modal-close-btn" type="button">Close</button>
      <div id="app-modal-title"></div>
      <div id="app-modal-body"></div>
      <div id="app-modal-actions"></div>
    </div>

    <div id="case-popup" class="case-popup hidden" aria-hidden="true"></div>
  `;

  return root;
}

function baseScenario(overrides = {}) {
  return {
    id: 'alpha',
    title: 'Alpha Scenario',
    branch: 'judiciary',
    doctrineArea: 'Doctrine Alpha',
    difficulty: 'easy',
    description: 'Alpha description.',
    steps: [
      {
        type: 'multiple_choice',
        prompt: 'Choose the strongest answer.',
        choices: [
          {
            id: 'alpha-1',
            text: 'Correct answer',
            points: 10,
            correct: 'correct',
            explanation: 'Correct explanation.'
          },
          {
            id: 'alpha-2',
            text: 'Incorrect answer',
            points: 0,
            correct: 'incorrect',
            explanation: 'Incorrect explanation.'
          }
        ]
      }
    ],
    overallExplanation: 'Overall doctrinal explanation.',
    caseReferences: [],
    professorNote: '',
    analyticalLens: 'both',
    otherSide: '',
    ...overrides
  };
}

function prepareEnvironment() {
  localStorage.clear();
  mountAppShell();
  __testHooks.clearSavedStateForTests();
}

async function clickFirstChoiceAndWait() {
  const button = document.querySelector('.choice-btn');
  assert(button, 'Expected a rendered choice button.');
  button.click();
  await wait(550);
}

test('Starting a new standard game loads the first scenario and shows the game screen.', async () => {
  prepareEnvironment();
  const scenarios = [baseScenario()];

  await initGame({
    skipTransition: true,
    scenarioData: clone(scenarios),
    orderedScenarioIds: ['alpha'],
    selections: { mode: 'standard', difficulty: 'all', timerMinutes: 30 }
  });

  assert(document.getElementById('game-screen').classList.contains('active'), 'Game screen should be active.');
  equal(document.getElementById('scenario-title').textContent, 'Alpha Scenario');
  equal(__testHooks.getStateSnapshot().mode, 'standard');
});

test('Making a correct choice updates the score and saves state to localStorage.', async () => {
  prepareEnvironment();
  const scenarios = [baseScenario()];

  await initGame({
    skipTransition: true,
    scenarioData: clone(scenarios),
    orderedScenarioIds: ['alpha'],
    selections: { mode: 'standard', difficulty: 'easy', timerMinutes: 30 }
  });

  await clickFirstChoiceAndWait();

  equal(document.getElementById('score-value').textContent, '10');
  const savedState = JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY));
  equal(savedState.legitimacyPoints, 10);
  equal(savedState.history.length, 1);
});

test('Completing a scenario and continuing advances to the next scenario.', async () => {
  prepareEnvironment();
  const scenarios = [
    baseScenario(),
    baseScenario({
      id: 'beta',
      title: 'Beta Scenario',
      doctrineArea: 'Doctrine Beta',
      description: 'Beta description.'
    })
  ];

  await initGame({
    skipTransition: true,
    scenarioData: clone(scenarios),
    orderedScenarioIds: ['alpha', 'beta'],
    selections: { mode: 'standard', difficulty: 'easy', timerMinutes: 30 }
  });

  await clickFirstChoiceAndWait();
  document.getElementById('feedback-continue-btn').click();
  await wait(50);

  equal(document.getElementById('scenario-title').textContent, 'Beta Scenario');
  equal(__testHooks.getStateSnapshot().currentScenarioIndex, 1);
});

test('Campaign precedent flags are set and applied to later scenarios.', async () => {
  prepareEnvironment();
  const scenarios = [
    baseScenario({
      id: 'first-campaign',
      title: 'First Campaign Scenario',
      choices: undefined,
      steps: [
        {
          type: 'multiple_choice',
          prompt: 'Set a precedent.',
          choices: [
            {
              id: 'campaign-1',
              text: 'Create precedent',
              points: 10,
              correct: 'correct',
              explanation: 'Precedent created.',
              setsPrecedent: { sampleFlag: true }
            }
          ]
        }
      ]
    }),
    baseScenario({
      id: 'second-campaign',
      title: 'Second Campaign Scenario',
      description: 'Second scenario baseline description.',
      precedentConditions: [
        {
          precedent: 'sampleFlag',
          value: true,
          descriptionAppend: 'Precedent note is now active.',
          stepModifications: [
            {
              stepIndex: 0,
              choiceIndex: 0,
              textAppend: 'Adjusted by precedent.'
            }
          ]
        }
      ]
    })
  ];

  await initGame({
    skipTransition: true,
    scenarioData: clone(scenarios),
    orderedScenarioIds: ['first-campaign', 'second-campaign'],
    selections: { mode: 'campaign', difficulty: 'easy', timerMinutes: 30 }
  });

  await clickFirstChoiceAndWait();
  document.getElementById('feedback-continue-btn').click();
  await wait(50);

  const state = __testHooks.getStateSnapshot();
  assert(state.precedentState.sampleFlag === true, 'Expected precedent flag to be saved in state.');
  includes(document.getElementById('scenario-description').textContent, 'Precedent note is now active.');
  includes(document.querySelector('.choice-btn').textContent, 'Adjusted by precedent.');
});

test('Exam Prep mode starts the timer and counts down.', async () => {
  prepareEnvironment();
  const scenarios = [baseScenario()];

  await initGame({
    skipTransition: true,
    scenarioData: clone(scenarios),
    orderedScenarioIds: ['alpha'],
    selections: { mode: 'examPrep', difficulty: 'easy', timerMinutes: 0.05 }
  });

  assert(!document.getElementById('timer-display').classList.contains('hidden'), 'Timer should be visible in Exam Prep mode.');
  const initial = __testHooks.getStateSnapshot().timerRemainingSeconds;
  await wait(1100);
  const afterTick = __testHooks.getStateSnapshot().timerRemainingSeconds;
  assert(afterTick < initial, `Expected timer to count down from ${initial}, received ${afterTick}.`);
});

test('Finishing the last scenario displays the final score and grade.', async () => {
  prepareEnvironment();
  const scenarios = [baseScenario()];

  await initGame({
    skipTransition: true,
    scenarioData: clone(scenarios),
    orderedScenarioIds: ['alpha'],
    selections: { mode: 'standard', difficulty: 'easy', timerMinutes: 30 }
  });

  await clickFirstChoiceAndWait();
  document.getElementById('feedback-continue-btn').click();
  await wait(600);

  assert(document.getElementById('end-screen').classList.contains('active'), 'End screen should be active.');
  equal(document.getElementById('end-total-score').textContent, '10');
  equal(document.getElementById('end-percentage').textContent, '100%');
  equal(document.querySelector('#end-grade-badge .grade-letter').textContent, 'A');
});


test('Case popup shows citation cleanly when a reference has no decision year.', async () => {
  prepareEnvironment();

  const anchorButton = document.createElement('button');
  anchorButton.type = 'button';
  anchorButton.textContent = 'Open reference';
  document.body.appendChild(anchorButton);

  const popup = renderCasePopup({
    id: 'federal-preemption-framework',
    name: 'Federal Preemption Framework (Supremacy Clause, Article VI)',
    year: null,
    citation: 'U.S. Const. art. VI, cl. 2',
    holding: 'Federal law preempts state law when Congress intends it.',
    significance: 'Constitutional authority entries should still render cleanly in the popup.',
    doctrineAreas: ['Federal Preemption'],
    keyQuote: ''
  }, anchorButton);

  assert(popup, 'Expected case popup to render for reference data.');
  equal(popup.querySelector('.case-popup-year').textContent, 'U.S. Const. art. VI, cl. 2');

  hideCasePopup();
  anchorButton.remove();
});


const progressionCatalog = [
  { id: 'alpha', title: 'Alpha Scenario', doctrineArea: 'Doctrine Alpha', branch: 'judiciary', difficulty: 'easy' },
  { id: 'beta', title: 'Beta Scenario', doctrineArea: 'Doctrine Beta', branch: 'judiciary', difficulty: 'medium' },
  { id: 'gamma', title: 'Gamma Scenario', doctrineArea: 'Doctrine Gamma', branch: 'judiciary', difficulty: 'hard' }
];

const progressionCampaign = {
  version: 1,
  regions: [
    { id: 'executive-power', label: 'Executive Power' }
  ],
  nodes: [
    { id: 'alpha', scenarioId: 'alpha', regionId: 'executive-power', requiresAll: [], requiresAny: [], requiresMinStarsInRegion: 0 },
    { id: 'beta', scenarioId: 'beta', regionId: 'executive-power', requiresAll: ['alpha'], requiresAny: [], requiresMinStarsInRegion: 0 },
    { id: 'gamma', scenarioId: 'gamma', regionId: 'executive-power', requiresAll: ['beta'], requiresAny: [], requiresMinStarsInRegion: 0 }
  ],
  edges: [
    { from: 'alpha', to: 'beta' },
    { from: 'beta', to: 'gamma' }
  ],
  mainPath: ['alpha', 'beta', 'gamma']
};

function buildProgressResult({
  sessionId = `session-${Date.now()}`,
  scenarioId = 'alpha',
  title = 'Alpha Scenario',
  doctrineArea = 'Doctrine Alpha',
  difficulty = 'easy',
  pointsEarned = 10,
  maxPoints = 10,
  percentage = 100,
  mode = 'freePlay',
  playedAt = '2026-03-26T12:00:00.000Z'
} = {}) {
  return {
    sessionId,
    playedAt,
    mode,
    difficulty,
    finalScore: pointsEarned,
    maxScore: maxPoints,
    percentage,
    totalTimeMs: 1000,
    scenarioResults: [{
      scenarioId,
      title,
      doctrineArea,
      difficulty,
      pointsEarned,
      maxPoints,
      choicesMade: []
    }]
  };
}

function recordResultAnalytics(result) {
  const scenario = result.scenarioResults[0];
  recordCompletedSession({
    sessionId: result.sessionId,
    playedAt: result.playedAt,
    mode: result.mode,
    difficulty: result.difficulty,
    finalScore: result.finalScore,
    maxScore: result.maxScore,
    percentage: result.percentage,
    grade: { letter: 'A', title: 'Excellent' },
    totalTimeMs: result.totalTimeMs || 1000,
    scenarios: [{
      scenarioId: scenario.scenarioId,
      title: scenario.title,
      doctrineArea: scenario.doctrineArea,
      scoreEarned: scenario.pointsEarned,
      maxScore: scenario.maxPoints,
      choices: []
    }]
  });
}

function resetProgressionEnvironment() {
  localStorage.clear();
}

test('Completing an official free-play scenario grants stars and unlocks the next node.', async () => {
  resetProgressionEnvironment();
  const profile = await loadPlayerProfile({ scenarioCatalog: progressionCatalog, campaignData: progressionCampaign, analyticsHistory: [] });
  const result = buildProgressResult();
  recordResultAnalytics(result);

  const outcome = await applySessionProgress(result, {
    profile,
    scenarioCatalog: progressionCatalog,
    campaignData: progressionCampaign,
    practiceOnly: false,
    analyticsHistory: loadAnalyticsHistory(),
    launchContext: { scenarioId: 'alpha', source: 'library' },
    mode: 'freePlay'
  });

  equal(outcome.profile.scenarioProgress.alpha.stars, 3);
  assert(outcome.profile.campaign.unlockedNodeIds.includes('beta'), 'Official free play should unlock the downstream node.');
});

test('Completing a locked sandbox run records analytics but does not grant progression.', async () => {
  resetProgressionEnvironment();
  const profile = await loadPlayerProfile({ scenarioCatalog: progressionCatalog, campaignData: progressionCampaign, analyticsHistory: [] });
  const result = buildProgressResult({
    sessionId: 'sandbox-beta',
    scenarioId: 'beta',
    title: 'Beta Scenario',
    doctrineArea: 'Doctrine Beta',
    difficulty: 'medium',
    mode: 'freePlay'
  });
  recordResultAnalytics(result);

  const outcome = await applySessionProgress(result, {
    profile,
    scenarioCatalog: progressionCatalog,
    campaignData: progressionCampaign,
    practiceOnly: true,
    analyticsHistory: loadAnalyticsHistory(),
    launchContext: { scenarioId: 'beta', source: 'library' },
    mode: 'freePlay'
  });

  equal(loadAnalyticsHistory().length, 1);
  assert(outcome.profile.scenarioProgress.beta.completed === false, 'Sandbox runs should not mark locked scenarios complete.');
  assert(outcome.profile.campaign.unlockedNodeIds.includes('beta') === false, 'Sandbox runs should not unlock campaign nodes.');
});

test('Completing a campaign node advances the campaign to the next node.', async () => {
  resetProgressionEnvironment();
  const profile = await loadPlayerProfile({ scenarioCatalog: progressionCatalog, campaignData: progressionCampaign, analyticsHistory: [] });
  const result = buildProgressResult({ sessionId: 'campaign-alpha' });
  recordResultAnalytics(result);

  const outcome = await applySessionProgress(result, {
    profile,
    scenarioCatalog: progressionCatalog,
    campaignData: progressionCampaign,
    practiceOnly: false,
    analyticsHistory: loadAnalyticsHistory(),
    launchContext: { scenarioId: 'alpha', source: 'campaign' },
    mode: 'freePlay'
  });

  equal(outcome.profile.campaign.currentNodeId, 'beta');
  assert(outcome.profile.campaign.unlockedNodeIds.includes('beta'), 'The next campaign node should unlock after a campaign clear.');
});

test('Profile and current campaign state persist after a refresh.', async () => {
  resetProgressionEnvironment();
  const profile = await loadPlayerProfile({ scenarioCatalog: progressionCatalog, campaignData: progressionCampaign, analyticsHistory: [] });
  const result = buildProgressResult({ sessionId: 'persist-alpha' });
  recordResultAnalytics(result);

  await applySessionProgress(result, {
    profile,
    scenarioCatalog: progressionCatalog,
    campaignData: progressionCampaign,
    practiceOnly: false,
    analyticsHistory: loadAnalyticsHistory(),
    launchContext: { scenarioId: 'alpha', source: 'campaign' },
    mode: 'freePlay'
  });

  const reloaded = await loadPlayerProfile({ scenarioCatalog: progressionCatalog, campaignData: progressionCampaign, analyticsHistory: loadAnalyticsHistory() });
  equal(reloaded.scenarioProgress.alpha.stars, 3);
  equal(reloaded.campaign.currentNodeId, 'beta');
  assert(reloaded.campaign.unlockedNodeIds.includes('beta'), 'Unlocked campaign state should persist after reload.');
});
