import { evaluateAchievements, __testHooks } from '../achievements.js';
import { test, assert, equal } from './test-utils.js';

const campaignData = {
  version: 1,
  regions: [
    { id: 'executive-power', label: 'Executive Power' },
    { id: 'federalism', label: 'Federalism' }
  ],
  nodes: [
    { id: 'alpha', scenarioId: 'alpha', regionId: 'executive-power' },
    { id: 'beta', scenarioId: 'beta', regionId: 'executive-power' },
    { id: 'gamma', scenarioId: 'gamma', regionId: 'executive-power' },
    { id: 'delta', scenarioId: 'delta', regionId: 'federalism' }
  ],
  edges: [
    { from: 'alpha', to: 'beta' },
    { from: 'beta', to: 'gamma' }
  ],
  mainPath: ['alpha', 'beta', 'gamma']
};

function createProfile(overrides = {}) {
  return {
    version: 1,
    createdAt: '2026-03-26T00:00:00.000Z',
    updatedAt: '2026-03-26T00:00:00.000Z',
    xp: 0,
    level: 1,
    streak: {
      currentDays: 0,
      bestDays: 0,
      lastPlayedDate: null,
      ...(overrides.streak || {})
    },
    achievements: {
      earnedIds: [],
      seenIds: [],
      ...(overrides.achievements || {})
    },
    scenarioProgress: {
      alpha: { unlocked: true, completed: false, bestPercent: 0, bestScore: 0, stars: 0, attempts: 0, firstCompletedAt: null, lastPlayedAt: null, lastMode: null },
      beta: { unlocked: true, completed: false, bestPercent: 0, bestScore: 0, stars: 0, attempts: 0, firstCompletedAt: null, lastPlayedAt: null, lastMode: null },
      gamma: { unlocked: false, completed: false, bestPercent: 0, bestScore: 0, stars: 0, attempts: 0, firstCompletedAt: null, lastPlayedAt: null, lastMode: null },
      delta: { unlocked: false, completed: false, bestPercent: 0, bestScore: 0, stars: 0, attempts: 0, firstCompletedAt: null, lastPlayedAt: null, lastMode: null },
      ...(overrides.scenarioProgress || {})
    },
    doctrineMastery: {},
    campaign: {
      currentNodeId: 'alpha',
      unlockedNodeIds: ['alpha'],
      completedNodeIds: [],
      discoveredRegionIds: ['executive-power'],
      ...(overrides.campaign || {})
    },
    settings: {
      mentorCharacterId: 'chief-clerk',
      sandboxEnabled: false,
      ...(overrides.settings || {})
    }
  };
}

function ids(list) {
  return list.map((entry) => entry.id).sort();
}

test('Achievements award only once even when evaluated repeatedly.', async () => {
  __testHooks.clearCache();
  const profile = createProfile({
    scenarioProgress: {
      alpha: { unlocked: true, completed: true, bestPercent: 100, bestScore: 10, stars: 3, attempts: 1, firstCompletedAt: '2026-03-26T00:00:00.000Z', lastPlayedAt: '2026-03-26T00:00:00.000Z', lastMode: 'freePlay' },
      beta: { unlocked: true, completed: false, bestPercent: 0, bestScore: 0, stars: 0, attempts: 0, firstCompletedAt: null, lastPlayedAt: null, lastMode: null },
      gamma: { unlocked: false, completed: false, bestPercent: 0, bestScore: 0, stars: 0, attempts: 0, firstCompletedAt: null, lastPlayedAt: null, lastMode: null },
      delta: { unlocked: false, completed: false, bestPercent: 0, bestScore: 0, stars: 0, attempts: 0, firstCompletedAt: null, lastPlayedAt: null, lastMode: null }
    },
    campaign: {
      currentNodeId: 'beta',
      unlockedNodeIds: ['alpha', 'beta'],
      completedNodeIds: ['alpha'],
      discoveredRegionIds: ['executive-power']
    }
  });

  const firstPass = await evaluateAchievements(profile, [], { campaignData });
  const firstIds = ids(firstPass);
  assert(firstIds.includes('first-scenario-completed'), 'First completion achievement should be earned.');
  assert(firstIds.includes('first-campaign-node-cleared'), 'First campaign clear achievement should be earned.');
  assert(firstIds.includes('three-star-performance'), 'Three-star achievement should be earned.');

  const secondPass = await evaluateAchievements(profile, [], { campaignData });
  equal(secondPass.length, 0, 'No duplicate achievements should be awarded on re-evaluation.');
});

test('Streak achievements evaluate correctly.', async () => {
  __testHooks.clearCache();
  const threeDayProfile = createProfile({
    streak: { currentDays: 3, bestDays: 3, lastPlayedDate: '2026-03-26' }
  });

  const threeDayEarned = await evaluateAchievements(threeDayProfile, [], { campaignData });
  assert(ids(threeDayEarned).includes('three-day-streak'), 'Three-day streak should award the 3-day achievement.');

  const sevenDayProfile = createProfile({
    streak: { currentDays: 7, bestDays: 7, lastPlayedDate: '2026-03-26' },
    achievements: { earnedIds: ['three-day-streak'], seenIds: [] }
  });

  const sevenDayEarned = await evaluateAchievements(sevenDayProfile, [], { campaignData });
  const earnedIds = ids(sevenDayEarned);
  assert(earnedIds.includes('seven-day-streak'), 'Seven-day streak should award the 7-day achievement.');
  assert(!earnedIds.includes('three-day-streak'), 'Already-earned streak achievements should not re-award.');
});

test('Completion achievements evaluate correctly.', async () => {
  __testHooks.clearCache();
  const profile = createProfile({
    scenarioProgress: {
      alpha: { unlocked: true, completed: true, bestPercent: 100, bestScore: 10, stars: 3, attempts: 1, firstCompletedAt: '2026-03-20T00:00:00.000Z', lastPlayedAt: '2026-03-20T00:00:00.000Z', lastMode: 'freePlay' },
      beta: { unlocked: true, completed: true, bestPercent: 90, bestScore: 9, stars: 2, attempts: 1, firstCompletedAt: '2026-03-21T00:00:00.000Z', lastPlayedAt: '2026-03-21T00:00:00.000Z', lastMode: 'freePlay' },
      gamma: { unlocked: true, completed: true, bestPercent: 95, bestScore: 19, stars: 3, attempts: 1, firstCompletedAt: '2026-03-22T00:00:00.000Z', lastPlayedAt: '2026-03-22T00:00:00.000Z', lastMode: 'freePlay' },
      delta: { unlocked: true, completed: true, bestPercent: 88, bestScore: 17, stars: 2, attempts: 1, firstCompletedAt: '2026-03-23T00:00:00.000Z', lastPlayedAt: '2026-03-23T00:00:00.000Z', lastMode: 'freePlay' },
      epsilon: { unlocked: true, completed: true, bestPercent: 84, bestScore: 16, stars: 2, attempts: 1, firstCompletedAt: '2026-03-24T00:00:00.000Z', lastPlayedAt: '2026-03-24T00:00:00.000Z', lastMode: 'freePlay' },
      zeta: { unlocked: true, completed: true, bestPercent: 80, bestScore: 16, stars: 2, attempts: 1, firstCompletedAt: '2026-03-25T00:00:00.000Z', lastPlayedAt: '2026-03-25T00:00:00.000Z', lastMode: 'freePlay' },
      eta: { unlocked: true, completed: true, bestPercent: 78, bestScore: 15, stars: 1, attempts: 1, firstCompletedAt: '2026-03-25T00:00:00.000Z', lastPlayedAt: '2026-03-25T00:00:00.000Z', lastMode: 'freePlay' },
      theta: { unlocked: true, completed: true, bestPercent: 82, bestScore: 16, stars: 2, attempts: 1, firstCompletedAt: '2026-03-25T00:00:00.000Z', lastPlayedAt: '2026-03-25T00:00:00.000Z', lastMode: 'freePlay' },
      iota: { unlocked: true, completed: true, bestPercent: 91, bestScore: 18, stars: 2, attempts: 1, firstCompletedAt: '2026-03-25T00:00:00.000Z', lastPlayedAt: '2026-03-25T00:00:00.000Z', lastMode: 'freePlay' },
      kappa: { unlocked: true, completed: true, bestPercent: 96, bestScore: 19, stars: 3, attempts: 1, firstCompletedAt: '2026-03-25T00:00:00.000Z', lastPlayedAt: '2026-03-25T00:00:00.000Z', lastMode: 'freePlay' }
    },
    campaign: {
      currentNodeId: 'delta',
      unlockedNodeIds: ['alpha', 'beta', 'gamma', 'delta'],
      completedNodeIds: ['alpha', 'beta', 'gamma'],
      discoveredRegionIds: ['executive-power', 'federalism']
    }
  });

  const earned = await evaluateAchievements(profile, [], { campaignData });
  const earnedIds = ids(earned);
  assert(earnedIds.includes('ten-scenarios-completed'), 'Ten-scenario completion achievement should be earned.');
  assert(earnedIds.includes('complete-main-path'), 'Main path completion achievement should be earned.');
  assert(earnedIds.includes('complete-every-scenario'), 'Complete-all-scenarios achievement should be earned.');
});
