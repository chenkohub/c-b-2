/**
 * dashboard.js
 * Expanded dashboard rendering using profile + analytics history.
 */

import { loadAnalyticsHistory, getDoctrineBreakdown, getWeakestDoctrines } from './analytics.js';
import { computeCompletionSummary } from './progress.js';
import { loadAchievementDefinitions } from './achievements.js';
import { getDashboardMentorContent } from './character.js';
import { renderMentorPanel } from './ui.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString();
  } catch (_error) {
    return value;
  }
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function buildDoctrineLabelMap(scenarioCatalog = []) {
  const labelMap = new Map();
  scenarioCatalog.forEach((scenario) => {
    const key = String(scenario.doctrineArea || '').trim().toLowerCase();
    if (key && !labelMap.has(key)) {
      labelMap.set(key, scenario.doctrineArea);
    }
  });
  return labelMap;
}

function scenarioTitleById(scenarioCatalog, scenarioId) {
  return scenarioCatalog.find((scenario) => scenario.id === scenarioId)?.title || scenarioId;
}

function buildRecommendations(profile, analyticsHistory, scenarioCatalog) {
  const recommendations = [];
  const weakest = getWeakestDoctrines(analyticsHistory, 3);
  weakest.forEach((entry) => {
    const matchingScenario = scenarioCatalog.find((scenario) => scenario.doctrineArea === entry.doctrineArea);
    recommendations.push({
      title: matchingScenario?.title || entry.doctrineArea,
      description: `Replay a ${entry.doctrineArea} scenario. Your current average is ${entry.accuracy}%.`,
      scenarioId: matchingScenario?.id || null,
      tag: 'Weak doctrine'
    });
  });

  scenarioCatalog.forEach((scenario) => {
    if (recommendations.length >= 3) {
      return;
    }
    const progress = profile?.scenarioProgress?.[scenario.id];
    if (progress?.unlocked && !progress?.completed) {
      recommendations.push({
        title: scenario.title,
        description: 'Unlocked and ready to clear for the first time.',
        scenarioId: scenario.id,
        tag: 'Unlocked'
      });
    }
  });

  while (recommendations.length < 3 && scenarioCatalog[recommendations.length]) {
    const scenario = scenarioCatalog[recommendations.length];
    recommendations.push({
      title: scenario.title,
      description: scenario.doctrineArea,
      scenarioId: scenario.id,
      tag: 'Suggested'
    });
  }

  return recommendations.slice(0, 3);
}

export async function renderDashboard(profile, scenarioCatalog = []) {
  const analyticsHistory = loadAnalyticsHistory();
  const achievements = await loadAchievementDefinitions();
  const mentor = await getDashboardMentorContent(profile);
  const emptyState = document.getElementById('dashboard-empty-state');
  const content = document.getElementById('dashboard-content');

  const completion = computeCompletionSummary(profile, scenarioCatalog);
  const hasAnyProgress = completion.completed > 0 || analyticsHistory.length > 0;

  if (!hasAnyProgress) {
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.innerHTML = `
        <div class="dashboard-empty-card">
          <h3>No saved progress yet</h3>
          <p>Complete a scenario to start building XP, unlocks, doctrine mastery, and session history.</p>
        </div>
      `;
    }
    if (content) {
      content.classList.add('hidden');
    }
    renderMentorPanel('dashboard-mentor-panel', mentor);
    return;
  }

  if (emptyState) {
    emptyState.classList.add('hidden');
  }
  if (content) {
    content.classList.remove('hidden');
  }

  const currentXp = Number(profile?.xp || 0);
  const level = Number(profile?.level || 1);
  const xpIntoLevel = currentXp % 250;
  const xpBar = document.getElementById('dashboard-xp-bar');
  if (xpBar) {
    xpBar.style.width = `${Math.min(100, Math.max(0, Math.round((xpIntoLevel / 250) * 100)))}%`;
  }

  const setText = (id, text) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
    }
  };

  setText('dashboard-level', `Level ${level}`);
  setText('dashboard-xp', `${currentXp} XP`);
  setText('dashboard-current-streak', `${profile?.streak?.currentDays || 0}-day streak`);
  setText('dashboard-completion-percent', `${completion.completed}/${completion.total} scenarios complete (${completion.percent}%)`);

  const doctrineRows = getDoctrineBreakdown(analyticsHistory);
  const doctrineContainer = document.getElementById('dashboard-doctrine-breakdown');
  if (doctrineContainer) {
    doctrineContainer.innerHTML = doctrineRows.map((entry) => `
      <div class="doctrine-row">
        <div class="doctrine-row-main">
          <strong>${escapeHtml(entry.doctrineArea)}</strong>
          <span>${entry.attempts} attempt${entry.attempts === 1 ? '' : 's'}</span>
        </div>
        <div class="doctrine-meter" aria-label="${escapeHtml(entry.doctrineArea)} average accuracy ${entry.accuracy}%">
          <span class="doctrine-meter-fill" style="width:${entry.accuracy}%;"></span>
        </div>
        <div class="doctrine-score">${entry.accuracy}%</div>
      </div>
    `).join('');
  }

  const earnedIds = profile?.achievements?.earnedIds || [];
  const achievementGrid = document.getElementById('dashboard-achievements-grid');
  if (achievementGrid) {
    const earnedAchievements = achievements.filter((entry) => earnedIds.includes(entry.id));
    achievementGrid.innerHTML = earnedAchievements.length > 0
      ? earnedAchievements.slice(-8).reverse().map((entry) => `
          <article class="achievement-badge ${profile?.achievements?.seenIds?.includes(entry.id) ? '' : 'is-new'}">
            <div class="achievement-icon">${entry.icon || '🏅'}</div>
            <div>
              <strong>${escapeHtml(entry.title)}</strong>
              <p>${escapeHtml(entry.description)}</p>
            </div>
          </article>
        `).join('')
      : '<p class="muted-copy">No achievements earned yet. Your first clear will show up here.</p>';
  }

  const recommendationsEl = document.getElementById('dashboard-recommendations');
  if (recommendationsEl) {
    const recommendations = buildRecommendations(profile, analyticsHistory, scenarioCatalog);
    recommendationsEl.innerHTML = recommendations.map((entry) => `
      <article class="recommendation-card" data-scenario-id="${escapeHtml(entry.scenarioId || '')}">
        <span class="recommendation-tag">${escapeHtml(entry.tag)}</span>
        <h4>${escapeHtml(entry.title)}</h4>
        <p>${escapeHtml(entry.description)}</p>
      </article>
    `).join('');
  }

  const recentActivityEl = document.getElementById('dashboard-recent-activity');
  if (recentActivityEl) {
    recentActivityEl.innerHTML = analyticsHistory.slice(0, 5).map((session) => `
      <article class="activity-row">
        <div>
          <strong>${escapeHtml(session.mode || 'standard')}</strong>
          <p>${escapeHtml((session.scenarios || []).slice(0, 2).map((scenario) => scenario.title).join(' · ') || 'Completed session')}</p>
        </div>
        <div class="activity-meta">
          <span>${Number(session.percentage || 0)}%</span>
          <span>${escapeHtml(formatDate(session.playedAt))}</span>
        </div>
      </article>
    `).join('');
  }

  const tableBody = document.getElementById('dashboard-session-history-body');
  if (tableBody) {
    tableBody.innerHTML = analyticsHistory.map((session) => `
      <tr>
        <td>${escapeHtml(formatDate(session.playedAt))}</td>
        <td>${escapeHtml(session.mode || 'standard')}</td>
        <td>${Number(session.finalScore || 0)}/${Number(session.maxScore || 0)}</td>
        <td>${Number(session.percentage || 0)}%</td>
        <td>${escapeHtml(session.grade?.letter || '')}</td>
        <td>${escapeHtml(formatDuration(session.totalTimeMs))}</td>
      </tr>
    `).join('');
  }

  renderMentorPanel('dashboard-mentor-panel', mentor);
}
