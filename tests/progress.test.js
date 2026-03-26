import {
  loadPlayerProfile,
  applySessionProgress,
  unlockAvailableNodes,
  PROFILE_STORAGE_KEY,
  __testHooks
} from '../progress.js';
import { saveAnalyticsHistory } from '../analytics.js';
import { test, assert, equal } from './test-utils.js';

const scenarioCatalog = [
  { id: 'alpha', title: 'Alpha', doctrineArea: 'Doctrine Alpha', branch: 'judiciary', difficulty: 'easy' },
  { id: 'beta', title: 'Beta', doctrineArea: 'Doctrine Beta', branch: 'judiciary', difficulty: 'medium' },
  { id: 'gamma', title: 'Gamma', doctrineArea: 'Doctrine Gamma', branch: 'judiciary', difficulty: 'hard' }
];

const campaignData = {
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

function clearProgressEnvironment() {
  localStorage.clear();
  __testHooks.resetCaches();
}

test('Profile initializes with the root campaign node unlocked.', async () => {
  clearProgressEnvironment();
  const profile = await loadPlayerProfile({ scenarioCatalog, campaignData, analyticsHistory: [] });

  equal(profile.level, 1);
  assert(profile.scenarioProgress.alpha.unlocked === true, 'Root scenario should be unlocked.');
  assert(profile.scenarioProgress.beta.unlocked === false, 'Dependent scenario should start locked.');
  equal(profile.campaign.currentNodeId, 'alpha');
  assert(Boolean(localStorage.getItem(PROFILE_STORAGE_KEY)), 'Profile should be persisted to localStorage.');
});

test('Analytics migration backfills scenario progress and doctrine mastery.', async () => {
  clearProgressEnvironment();
  const history = [{
    sessionId: 's1',
    playedAt: '2026-03-20T12:00:00.000Z',
    mode: 'standard',
    difficulty: 'easy',
    finalScore: 10,
    maxScore: 10,
    percentage: 100,
    grade: { letter: 'A' },
    totalTimeMs: 1000,
    scenarios: [{
      scenarioId: 'alpha',
      title: 'Alpha',
      doctrineArea: 'Doctrine Alpha',
      scoreEarned: 10,
      maxScore: 10,
      choices: []
    }]
  }];
  saveAnalyticsHistory(history);

  const profile = await loadPlayerProfile({ scenarioCatalog, campaignData, analyticsHistory: history });
  equal(profile.scenarioProgress.alpha.bestPercent, 100);
  equal(profile.scenarioProgress.alpha.stars, 3);
  assert(profile.campaign.completedNodeIds.includes('alpha'), 'Historical completion should mark the node complete.');
  assert(profile.campaign.unlockedNodeIds.includes('beta'), 'Child node should unlock during migration.');
  assert(profile.doctrineMastery['doctrine-alpha'].accuracy === 100, 'Doctrine mastery should be derived from analytics history.');
});

test('Unlocking logic opens downstream nodes after an official clear.', async () => {
  clearProgressEnvironment();
  const profile = await loadPlayerProfile({ scenarioCatalog, campaignData, analyticsHistory: [] });
  profile.scenarioProgress.alpha.completed = true;
  profile.scenarioProgress.alpha.stars = 2;
  profile.campaign.completedNodeIds = ['alpha'];

  const newUnlocks = unlockAvailableNodes(profile, campaignData);
  assert(newUnlocks.includes('beta'), 'Completing alpha should unlock beta.');
  assert(profile.scenarioProgress.beta.unlocked === true, 'Scenario progress should reflect the unlocked child node.');
});

test('Sandbox runs record attempts but do not unlock nodes or award official completion.', async () => {
  clearProgressEnvironment();
  const profile = await loadPlayerProfile({ scenarioCatalog, campaignData, analyticsHistory: [] });

  const results = {
    sessionId: 'sandbox-1',
    playedAt: '2026-03-21T12:00:00.000Z',
    mode: 'freePlay',
    difficulty: 'medium',
    totalPoints: 10,
    maxPoints: 10,
    percentage: 100,
    scenarioResults: [{
      scenarioId: 'beta',
      title: 'Beta',
      doctrineArea: 'Doctrine Beta',
      difficulty: 'medium',
      pointsEarned: 10,
      maxPoints: 10,
      choicesMade: []
    }]
  };

  const outcome = await applySessionProgress(results, {
    profile,
    scenarioCatalog,
    campaignData,
    practiceOnly: true,
    analyticsHistory: []
  });

  equal(outcome.profile.scenarioProgress.beta.attempts, 1);
  assert(outcome.profile.scenarioProgress.beta.completed === false, 'Sandbox attempt should not mark the scenario complete.');
  assert(outcome.profile.campaign.unlockedNodeIds.includes('beta') === false, 'Sandbox attempt should not unlock the node.');
  equal(outcome.rewards.xpEarned, 0);
});
