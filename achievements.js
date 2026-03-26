/**
 * achievements.js
 * Achievement definition loading and award evaluation.
 */

import { loadPlayerProfile, savePlayerProfile, loadCampaignData } from './progress.js';

let achievementDefinitions = [];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getCompletedScenarioIds(profile) {
  return Object.entries(profile?.scenarioProgress || {})
    .filter(([, progress]) => Boolean(progress?.completed))
    .map(([scenarioId]) => scenarioId);
}

function getCampaignClearCount(profile) {
  return safeArray(profile?.campaign?.completedNodeIds).length;
}

function getHighestStarCount(profile) {
  return Object.values(profile?.scenarioProgress || {}).reduce((best, progress) => {
    return Math.max(best, Number(progress?.stars || 0));
  }, 0);
}

function getRegionCompletionStats(profile, campaignData, regionId) {
  const completedScenarioIds = new Set(getCompletedScenarioIds(profile));
  const nodes = safeArray(campaignData?.nodes).filter((node) => node.regionId === regionId);
  const completedNodes = nodes.filter((node) => completedScenarioIds.has(node.scenarioId));
  const totalPercent = completedNodes.reduce((sum, node) => {
    const progress = profile?.scenarioProgress?.[node.scenarioId];
    return sum + Number(progress?.bestPercent || 0);
  }, 0);

  return {
    completedCount: completedNodes.length,
    averagePercent: completedNodes.length > 0 ? Math.round(totalPercent / completedNodes.length) : 0
  };
}

function hasCompletedMainPath(profile, campaignData) {
  const mainPath = safeArray(campaignData?.mainPath);
  if (mainPath.length === 0) {
    return false;
  }
  const completedNodes = new Set(safeArray(profile?.campaign?.completedNodeIds));
  return mainPath.every((nodeId) => completedNodes.has(nodeId));
}

function hasCompletedAllScenarios(profile) {
  const progressEntries = Object.values(profile?.scenarioProgress || {});
  if (progressEntries.length === 0) {
    return false;
  }
  return progressEntries.every((progress) => Boolean(progress?.completed));
}

function evaluateRule(rule, profile, analytics, context) {
  if (!rule || typeof rule !== 'object') {
    return false;
  }

  const campaignData = context?.campaignData;

  switch (rule.type) {
    case 'completedScenarios':
      return getCompletedScenarioIds(profile).length >= Number(rule.count || 0);
    case 'campaignClears':
      return getCampaignClearCount(profile) >= Number(rule.count || 0);
    case 'anyScenarioStars':
      return getHighestStarCount(profile) >= Number(rule.count || 0);
    case 'regionMastery': {
      const stats = getRegionCompletionStats(profile, campaignData, rule.regionId);
      return stats.completedCount >= Number(rule.minCompleted || 0)
        && stats.averagePercent >= Number(rule.minAveragePercent || 0);
    }
    case 'streakDays':
      return Number(profile?.streak?.currentDays || 0) >= Number(rule.count || 0);
    case 'completeMainPath':
      return hasCompletedMainPath(profile, campaignData);
    case 'completeAllScenarios':
      return hasCompletedAllScenarios(profile);
    default:
      return false;
  }
}

export async function loadAchievementDefinitions() {
  if (achievementDefinitions.length > 0) {
    return achievementDefinitions;
  }

  const response = await fetch('./data/achievements.json');
  if (!response.ok) {
    throw new Error(`Unable to load achievements.json: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  achievementDefinitions = safeArray(payload?.achievements);
  return achievementDefinitions;
}

export async function evaluateAchievements(profile, analytics, context = {}) {
  const definitions = await loadAchievementDefinitions();
  const earnedIds = new Set(safeArray(profile?.achievements?.earnedIds));
  const campaignData = context.campaignData || await loadCampaignData();

  const newlyEarned = definitions.filter((definition) => {
    if (earnedIds.has(definition.id)) {
      return false;
    }
    return evaluateRule(definition.rule, profile, analytics, {
      ...context,
      campaignData
    });
  });

  if (newlyEarned.length > 0) {
    profile.achievements.earnedIds.push(...newlyEarned.map((entry) => entry.id));
  }

  return newlyEarned;
}

export async function markAchievementsSeen(ids = []) {
  const profile = await loadPlayerProfile();
  const seenIds = new Set(safeArray(profile?.achievements?.seenIds));
  safeArray(ids).forEach((id) => {
    if (id) {
      seenIds.add(id);
    }
  });
  profile.achievements.seenIds = [...seenIds];
  savePlayerProfile(profile);
  return profile.achievements.seenIds;
}

export const __testHooks = {
  evaluateRule,
  getCompletedScenarioIds,
  getCampaignClearCount,
  getHighestStarCount,
  getRegionCompletionStats,
  hasCompletedMainPath,
  hasCompletedAllScenarios,
  clearCache() {
    achievementDefinitions = [];
  }
};
