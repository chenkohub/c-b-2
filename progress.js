/**
 * progress.js
 * Long-lived player profile, unlock logic, and progression updates.
 */

import { loadAnalyticsHistory } from './analytics.js';

export const PROFILE_STORAGE_KEY = 'cb-sim-profile-v1';
const PROFILE_VERSION = 1;

let campaignDataCache = null;
let scenarioCatalogCache = null;

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function toLocalDateKey(dateLike = Date.now()) {
  const date = new Date(dateLike);
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 10);
}

function daysBetween(dateKeyA, dateKeyB) {
  if (!dateKeyA || !dateKeyB) {
    return null;
  }
  const a = new Date(`${dateKeyA}T00:00:00Z`);
  const b = new Date(`${dateKeyB}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function normalizeSlug(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'unknown';
}

function getScenarioProgressDefaults(unlocked = false) {
  return {
    unlocked,
    completed: false,
    bestPercent: 0,
    bestScore: 0,
    stars: 0,
    attempts: 0,
    firstCompletedAt: null,
    lastPlayedAt: null,
    lastMode: null
  };
}

function getDoctrineDefaults() {
  return {
    earned: 0,
    possible: 0,
    accuracy: 0,
    attempts: 0,
    lastPlayedAt: null
  };
}

async function loadScenarioCatalog() {
  if (Array.isArray(scenarioCatalogCache) && scenarioCatalogCache.length > 0) {
    return scenarioCatalogCache;
  }

  const response = await fetch('./data/scenarios.json');
  if (!response.ok) {
    throw new Error(`Unable to load scenarios.json: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  scenarioCatalogCache = Array.isArray(payload) ? payload : (Array.isArray(payload?.scenarios) ? payload.scenarios : []);
  return scenarioCatalogCache;
}

export async function loadCampaignData() {
  if (campaignDataCache) {
    return campaignDataCache;
  }

  const response = await fetch('./data/campaigns.json');
  if (!response.ok) {
    throw new Error(`Unable to load campaigns.json: ${response.status} ${response.statusText}`);
  }

  campaignDataCache = await response.json();
  return campaignDataCache;
}

function getRootNode(campaignData) {
  return (campaignData?.nodes || []).find((node) => {
    return (!Array.isArray(node.requiresAll) || node.requiresAll.length === 0)
      && (!Array.isArray(node.requiresAny) || node.requiresAny.length === 0);
  }) || campaignData?.nodes?.[0] || null;
}

export function computeStars(percentage = 0) {
  const numeric = toNumber(percentage);
  if (numeric >= 95) {
    return 3;
  }
  if (numeric >= 80) {
    return 2;
  }
  if (numeric >= 60) {
    return 1;
  }
  return 0;
}

export function computeLevel(xp = 0) {
  return Math.max(1, Math.floor(toNumber(xp) / 250) + 1);
}

export function computeXpAward({ difficulty = 'medium', percentage = 0, isFirstClear = false, threeStarUpgrade = false } = {}) {
  const difficultyBase = {
    easy: 20,
    medium: 35,
    hard: 50
  };

  return toNumber(difficultyBase[difficulty], 35)
    + Math.round(toNumber(percentage) / 5)
    + (isFirstClear ? 15 : 0)
    + (threeStarUpgrade ? 10 : 0);
}

export function buildDoctrineId(doctrineArea = '') {
  return normalizeSlug(doctrineArea);
}

export function buildProfileSkeleton({ scenarioCatalog = [], campaignData, createdAt = nowIso() } = {}) {
  const rootNode = getRootNode(campaignData);
  const firstNodeId = rootNode?.id || scenarioCatalog[0]?.id || null;
  const firstScenarioId = rootNode?.scenarioId || firstNodeId;
  const firstRegionId = rootNode?.regionId || null;

  const profile = {
    version: PROFILE_VERSION,
    createdAt,
    updatedAt: createdAt,
    xp: 0,
    level: 1,
    streak: {
      currentDays: 0,
      bestDays: 0,
      lastPlayedDate: null
    },
    achievements: {
      earnedIds: [],
      seenIds: []
    },
    scenarioProgress: {},
    doctrineMastery: {},
    campaign: {
      currentNodeId: firstNodeId,
      unlockedNodeIds: firstNodeId ? [firstNodeId] : [],
      completedNodeIds: [],
      discoveredRegionIds: firstRegionId ? [firstRegionId] : []
    },
    settings: {
      mentorCharacterId: 'chief-clerk',
      sandboxEnabled: false
    }
  };

  (scenarioCatalog || []).forEach((scenario) => {
    profile.scenarioProgress[scenario.id] = getScenarioProgressDefaults(scenario.id === firstScenarioId);
  });

  return profile;
}

function ensureScenarioProgress(profile, scenarioCatalog, campaignData) {
  const unlockedNodeIds = new Set(profile?.campaign?.unlockedNodeIds || []);
  const nodeByScenarioId = new Map((campaignData?.nodes || []).map((node) => [node.scenarioId, node]));

  (scenarioCatalog || []).forEach((scenario) => {
    const existing = profile.scenarioProgress[scenario.id] || getScenarioProgressDefaults(false);
    const node = nodeByScenarioId.get(scenario.id);
    const shouldBeUnlocked = node ? unlockedNodeIds.has(node.id) : Boolean(existing.unlocked);
    profile.scenarioProgress[scenario.id] = {
      ...getScenarioProgressDefaults(shouldBeUnlocked),
      ...existing,
      unlocked: shouldBeUnlocked
    };
  });
}

function ensureCampaignState(profile, campaignData) {
  const rootNode = getRootNode(campaignData);
  const unlockedNodeIds = new Set(profile?.campaign?.unlockedNodeIds || []);
  const completedNodeIds = new Set(profile?.campaign?.completedNodeIds || []);
  const discoveredRegionIds = new Set(profile?.campaign?.discoveredRegionIds || []);

  if (unlockedNodeIds.size === 0 && rootNode?.id) {
    unlockedNodeIds.add(rootNode.id);
  }
  if (discoveredRegionIds.size === 0 && rootNode?.regionId) {
    discoveredRegionIds.add(rootNode.regionId);
  }

  profile.campaign = {
    currentNodeId: profile?.campaign?.currentNodeId || rootNode?.id || null,
    unlockedNodeIds: [...unlockedNodeIds],
    completedNodeIds: [...completedNodeIds],
    discoveredRegionIds: [...discoveredRegionIds]
  };
}

function ensureProfileSchema(profile, scenarioCatalog, campaignData) {
  const createdAt = profile?.createdAt || nowIso();
  const base = buildProfileSkeleton({ scenarioCatalog, campaignData, createdAt });
  const merged = {
    ...base,
    ...(profile || {}),
    streak: {
      ...base.streak,
      ...(profile?.streak || {})
    },
    achievements: {
      ...base.achievements,
      ...(profile?.achievements || {}),
      earnedIds: Array.isArray(profile?.achievements?.earnedIds) ? profile.achievements.earnedIds : [],
      seenIds: Array.isArray(profile?.achievements?.seenIds) ? profile.achievements.seenIds : []
    },
    campaign: {
      ...base.campaign,
      ...(profile?.campaign || {})
    },
    settings: {
      ...base.settings,
      ...(profile?.settings || {})
    },
    scenarioProgress: typeof profile?.scenarioProgress === 'object' && profile?.scenarioProgress !== null
      ? deepClone(profile.scenarioProgress)
      : {},
    doctrineMastery: typeof profile?.doctrineMastery === 'object' && profile?.doctrineMastery !== null
      ? deepClone(profile.doctrineMastery)
      : {}
  };

  ensureCampaignState(merged, campaignData);
  ensureScenarioProgress(merged, scenarioCatalog, campaignData);
  merged.level = computeLevel(merged.xp);
  merged.updatedAt = merged.updatedAt || createdAt;
  return merged;
}

function collectScenarioHistory(history = []) {
  const scenarioStats = new Map();

  (history || []).forEach((session) => {
    const playedAt = session?.playedAt || nowIso();
    (session?.scenarios || []).forEach((scenario) => {
      const entry = scenarioStats.get(scenario.scenarioId) || {
        attempts: 0,
        bestPercent: 0,
        bestScore: 0,
        completed: false,
        firstCompletedAt: null,
        lastPlayedAt: null,
        lastMode: null,
        stars: 0
      };

      const earned = toNumber(scenario.scoreEarned);
      const possible = Math.max(0, toNumber(scenario.maxScore));
      const percent = possible > 0 ? Math.round((earned / possible) * 100) : 0;

      entry.attempts += 1;
      entry.completed = true;
      entry.firstCompletedAt = entry.firstCompletedAt || playedAt;
      entry.lastPlayedAt = playedAt;
      entry.lastMode = session?.mode || null;

      if (percent >= entry.bestPercent) {
        entry.bestPercent = percent;
        entry.bestScore = earned;
      }
      entry.stars = computeStars(entry.bestPercent);
      scenarioStats.set(scenario.scenarioId, entry);
    });
  });

  return scenarioStats;
}

function collectDoctrineHistory(history = []) {
  const doctrineStats = new Map();

  (history || []).forEach((session) => {
    const playedAt = session?.playedAt || nowIso();
    (session?.scenarios || []).forEach((scenario) => {
      const doctrineId = buildDoctrineId(scenario.doctrineArea || 'uncategorized');
      const entry = doctrineStats.get(doctrineId) || getDoctrineDefaults();
      entry.earned += toNumber(scenario.scoreEarned);
      entry.possible += Math.max(0, toNumber(scenario.maxScore));
      entry.attempts += 1;
      entry.lastPlayedAt = playedAt;
      entry.accuracy = entry.possible > 0 ? Math.round((entry.earned / entry.possible) * 100) : 0;
      doctrineStats.set(doctrineId, entry);
    });
  });

  return doctrineStats;
}

function addCompletedNodesFromScenarios(profile, campaignData) {
  const completedNodeIds = new Set(profile?.campaign?.completedNodeIds || []);
  const nodes = campaignData?.nodes || [];
  nodes.forEach((node) => {
    const scenarioProgress = profile?.scenarioProgress?.[node.scenarioId];
    if (scenarioProgress?.completed) {
      completedNodeIds.add(node.id);
    }
  });
  profile.campaign.completedNodeIds = [...completedNodeIds];
}

function getRegionStarTotal(profile, campaignData, regionId) {
  return (campaignData?.nodes || [])
    .filter((node) => node.regionId === regionId)
    .reduce((sum, node) => sum + toNumber(profile?.scenarioProgress?.[node.scenarioId]?.stars), 0);
}

export function getScenarioRegionId(campaignData, scenarioId) {
  return (campaignData?.nodes || []).find((node) => node.scenarioId === scenarioId)?.regionId || null;
}

function isNodeUnlocked(profile, campaignData, node) {
  const unlockedNodeIds = new Set(profile?.campaign?.unlockedNodeIds || []);
  return unlockedNodeIds.has(node.id);
}

function canUnlockNode(profile, campaignData, node) {
  if (!node) {
    return false;
  }

  const completedNodeIds = new Set(profile?.campaign?.completedNodeIds || []);
  if (completedNodeIds.has(node.id)) {
    return true;
  }

  const requiresAll = Array.isArray(node.requiresAll) ? node.requiresAll : [];
  const requiresAny = Array.isArray(node.requiresAny) ? node.requiresAny : [];
  const allSatisfied = requiresAll.every((nodeId) => completedNodeIds.has(nodeId));
  const anySatisfied = requiresAny.length === 0 || requiresAny.some((nodeId) => completedNodeIds.has(nodeId));
  const starsSatisfied = toNumber(node.requiresMinStarsInRegion) <= 0
    || getRegionStarTotal(profile, campaignData, node.regionId) >= toNumber(node.requiresMinStarsInRegion);

  return allSatisfied && anySatisfied && starsSatisfied;
}

function determineCurrentNodeId(profile, campaignData) {
  const completedNodeIds = new Set(profile?.campaign?.completedNodeIds || []);
  const unlockedNodeIds = new Set(profile?.campaign?.unlockedNodeIds || []);

  const mainPathCandidate = (campaignData?.mainPath || []).find((nodeId) => {
    return unlockedNodeIds.has(nodeId) && !completedNodeIds.has(nodeId);
  });
  if (mainPathCandidate) {
    return mainPathCandidate;
  }

  const anyUnlocked = (campaignData?.nodes || []).find((node) => {
    return unlockedNodeIds.has(node.id) && !completedNodeIds.has(node.id);
  });
  if (anyUnlocked) {
    return anyUnlocked.id;
  }

  return profile?.campaign?.currentNodeId || campaignData?.mainPath?.[0] || campaignData?.nodes?.[0]?.id || null;
}

export function unlockAvailableNodes(profile, campaignData) {
  const unlockedNodeIds = new Set(profile?.campaign?.unlockedNodeIds || []);
  const discoveredRegionIds = new Set(profile?.campaign?.discoveredRegionIds || []);
  const newlyUnlockedNodeIds = [];

  let changed = true;
  while (changed) {
    changed = false;
    (campaignData?.nodes || []).forEach((node) => {
      if (unlockedNodeIds.has(node.id)) {
        return;
      }
      if (!canUnlockNode(profile, campaignData, node)) {
        return;
      }
      unlockedNodeIds.add(node.id);
      discoveredRegionIds.add(node.regionId);
      newlyUnlockedNodeIds.push(node.id);
      changed = true;
    });
  }

  profile.campaign.unlockedNodeIds = [...unlockedNodeIds];
  profile.campaign.discoveredRegionIds = [...discoveredRegionIds];
  profile.campaign.currentNodeId = determineCurrentNodeId(profile, campaignData);

  const unlockedSet = new Set(profile.campaign.unlockedNodeIds);
  Object.entries(profile.scenarioProgress || {}).forEach(([scenarioId, entry]) => {
    const node = (campaignData?.nodes || []).find((candidate) => candidate.scenarioId === scenarioId);
    if (node) {
      entry.unlocked = unlockedSet.has(node.id);
    }
  });

  return newlyUnlockedNodeIds;
}

function migrateFromAnalytics(history, scenarioCatalog, campaignData) {
  const profile = buildProfileSkeleton({ scenarioCatalog, campaignData });
  const scenarioHistory = collectScenarioHistory(history);
  const doctrineHistory = collectDoctrineHistory(history);

  Object.entries(profile.scenarioProgress).forEach(([scenarioId, entry]) => {
    const historical = scenarioHistory.get(scenarioId);
    if (!historical) {
      return;
    }
    profile.scenarioProgress[scenarioId] = {
      ...entry,
      ...historical,
      unlocked: entry.unlocked
    };
  });

  doctrineHistory.forEach((entry, doctrineId) => {
    profile.doctrineMastery[doctrineId] = entry;
  });

  addCompletedNodesFromScenarios(profile, campaignData);
  unlockAvailableNodes(profile, campaignData);
  profile.updatedAt = nowIso();
  return profile;
}

export async function loadPlayerProfile(options = {}) {
  const campaignData = options.campaignData || await loadCampaignData();
  const scenarioCatalog = options.scenarioCatalog || await loadScenarioCatalog();
  const rawProfile = safeParse(localStorage.getItem(PROFILE_STORAGE_KEY), null);

  let profile;
  if (!rawProfile || Number(rawProfile?.version) !== PROFILE_VERSION) {
    const history = options.analyticsHistory || loadAnalyticsHistory();
    profile = history.length > 0
      ? migrateFromAnalytics(history, scenarioCatalog, campaignData)
      : buildProfileSkeleton({ scenarioCatalog, campaignData });
    savePlayerProfile(profile);
    return profile;
  }

  profile = ensureProfileSchema(rawProfile, scenarioCatalog, campaignData);
  addCompletedNodesFromScenarios(profile, campaignData);
  unlockAvailableNodes(profile, campaignData);
  savePlayerProfile(profile);
  return profile;
}

export function savePlayerProfile(profile) {
  const merged = deepClone(profile || {});
  merged.version = PROFILE_VERSION;
  merged.level = computeLevel(merged.xp);
  merged.updatedAt = nowIso();
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

function updateStreak(profile, playedAt = nowIso()) {
  const currentDate = toLocalDateKey(playedAt);
  const previousDate = profile?.streak?.lastPlayedDate;
  const gap = daysBetween(previousDate, currentDate);

  if (!previousDate) {
    profile.streak.currentDays = 1;
  } else if (gap === 0) {
    profile.streak.currentDays = Math.max(1, toNumber(profile.streak.currentDays, 1));
  } else if (gap === 1) {
    profile.streak.currentDays = Math.max(1, toNumber(profile.streak.currentDays, 0) + 1);
  } else {
    profile.streak.currentDays = 1;
  }

  profile.streak.bestDays = Math.max(toNumber(profile.streak.bestDays), toNumber(profile.streak.currentDays));
  profile.streak.lastPlayedDate = currentDate;
}

function updateDoctrineMastery(profile, scenarioResult, playedAt = nowIso()) {
  const doctrineId = buildDoctrineId(scenarioResult?.doctrineArea || 'uncategorized');
  const entry = profile.doctrineMastery[doctrineId] || getDoctrineDefaults();
  entry.earned += toNumber(scenarioResult?.pointsEarned);
  entry.possible += Math.max(0, toNumber(scenarioResult?.maxPoints));
  entry.attempts += 1;
  entry.lastPlayedAt = playedAt;
  entry.accuracy = entry.possible > 0 ? Math.round((entry.earned / entry.possible) * 100) : 0;
  profile.doctrineMastery[doctrineId] = entry;
}

function updateScenarioProgress(profile, scenarioResult, playedAt, options = {}) {
  const entry = profile.scenarioProgress[scenarioResult.scenarioId] || getScenarioProgressDefaults(false);
  const percent = toNumber(scenarioResult.maxPoints) > 0
    ? Math.round((toNumber(scenarioResult.pointsEarned) / toNumber(scenarioResult.maxPoints)) * 100)
    : 0;

  entry.attempts += 1;
  entry.lastPlayedAt = playedAt;
  entry.lastMode = options.mode || null;

  if (options.practiceOnly) {
    profile.scenarioProgress[scenarioResult.scenarioId] = entry;
    return {
      isFirstClear: false,
      previousStars: toNumber(entry.stars),
      currentStars: toNumber(entry.stars),
      percent
    };
  }

  const previousStars = toNumber(entry.stars);
  const nextStars = Math.max(previousStars, computeStars(percent));
  const isFirstClear = !entry.completed;

  entry.completed = true;
  entry.unlocked = true;
  entry.bestPercent = Math.max(toNumber(entry.bestPercent), percent);
  if (entry.bestPercent === percent) {
    entry.bestScore = Math.max(toNumber(entry.bestScore), toNumber(scenarioResult.pointsEarned));
  }
  entry.stars = nextStars;
  entry.firstCompletedAt = entry.firstCompletedAt || playedAt;
  profile.scenarioProgress[scenarioResult.scenarioId] = entry;

  return {
    isFirstClear,
    previousStars,
    currentStars: nextStars,
    percent
  };
}

export function computeCompletionSummary(profile, scenarioCatalog = []) {
  const scenarios = Array.isArray(scenarioCatalog) ? scenarioCatalog : [];
  const total = scenarios.length;
  const completed = scenarios.filter((scenario) => Boolean(profile?.scenarioProgress?.[scenario.id]?.completed)).length;
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

export function getScenarioProgress(profile, scenarioId) {
  return profile?.scenarioProgress?.[scenarioId] || getScenarioProgressDefaults(false);
}

export function isScenarioUnlocked(profile, scenarioId, campaignData = null) {
  const progress = getScenarioProgress(profile, scenarioId);
  if (!campaignData) {
    return Boolean(progress.unlocked);
  }
  const node = (campaignData?.nodes || []).find((entry) => entry.scenarioId === scenarioId);
  if (!node) {
    return Boolean(progress.unlocked);
  }
  return (profile?.campaign?.unlockedNodeIds || []).includes(node.id);
}

export async function setSandboxEnabled(enabled, options = {}) {
  const profile = await loadPlayerProfile(options);
  profile.settings.sandboxEnabled = Boolean(enabled);
  savePlayerProfile(profile);
  return profile;
}

export async function setMentorCharacter(characterId, options = {}) {
  const profile = await loadPlayerProfile(options);
  profile.settings.mentorCharacterId = characterId || 'chief-clerk';
  savePlayerProfile(profile);
  return profile;
}

export async function applySessionProgress(results, options = {}) {
  const scenarioCatalog = options.scenarioCatalog || await loadScenarioCatalog();
  const campaignData = options.campaignData || await loadCampaignData();
  const analyticsHistory = options.analyticsHistory || loadAnalyticsHistory();
  const profile = options.profile || await loadPlayerProfile({ scenarioCatalog, campaignData, analyticsHistory });
  const playedAt = results?.playedAt || nowIso();
  const practiceOnly = Boolean(options.practiceOnly);

  const rewards = {
    xpEarned: 0,
    levelBefore: profile.level,
    levelAfter: profile.level,
    starUpdates: [],
    unlockedNodeIds: [],
    unlockedScenarioIds: [],
    achievements: []
  };

  updateStreak(profile, playedAt);

  (results?.scenarioResults || []).forEach((scenarioResult) => {
    updateDoctrineMastery(profile, scenarioResult, playedAt);

    const progressUpdate = updateScenarioProgress(profile, scenarioResult, playedAt, {
      practiceOnly,
      mode: options.mode || results?.mode
    });

    if (!practiceOnly) {
      const threeStarUpgrade = progressUpdate.currentStars >= 3 && progressUpdate.previousStars < 3;
      const xp = computeXpAward({
        difficulty: scenarioResult?.difficulty || 'medium',
        percentage: progressUpdate.percent,
        isFirstClear: progressUpdate.isFirstClear,
        threeStarUpgrade
      });
      profile.xp += xp;
      rewards.xpEarned += xp;

      if (progressUpdate.currentStars > progressUpdate.previousStars) {
        rewards.starUpdates.push({
          scenarioId: scenarioResult.scenarioId,
          title: scenarioResult.title,
          previousStars: progressUpdate.previousStars,
          currentStars: progressUpdate.currentStars
        });
      }
    }
  });

  if (!practiceOnly) {
    addCompletedNodesFromScenarios(profile, campaignData);
    rewards.unlockedNodeIds = unlockAvailableNodes(profile, campaignData);
    rewards.unlockedScenarioIds = rewards.unlockedNodeIds
      .map((nodeId) => (campaignData?.nodes || []).find((node) => node.id === nodeId)?.scenarioId)
      .filter(Boolean);
  }

  profile.level = computeLevel(profile.xp);
  rewards.levelAfter = profile.level;

  const { evaluateAchievements } = await import('./achievements.js');
  rewards.achievements = await evaluateAchievements(profile, analyticsHistory, {
    campaignData,
    scenarioCatalog,
    results,
    practiceOnly,
    launchContext: options.launchContext || null
  });

  savePlayerProfile(profile);
  return { profile, rewards };
}

export const __testHooks = {
  buildProfileSkeleton,
  ensureProfileSchema,
  collectScenarioHistory,
  collectDoctrineHistory,
  updateStreak,
  updateDoctrineMastery,
  updateScenarioProgress,
  migrateFromAnalytics,
  determineCurrentNodeId,
  getRegionStarTotal,
  canUnlockNode,
  resetCaches() {
    campaignDataCache = null;
    scenarioCatalogCache = null;
  }
};
