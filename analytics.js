/**
 * analytics.js
 * Append-only session storage plus history aggregations and CSV export.
 */

export const ANALYTICS_STORAGE_KEY = 'cb-sim-analytics-v1';

function safeParse(jsonText, fallback) {
  try {
    return JSON.parse(jsonText);
  } catch (_error) {
    return fallback;
  }
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function loadAnalyticsHistory() {
  const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
  const parsed = safeParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveAnalyticsHistory(history) {
  localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(Array.isArray(history) ? history : []));
}

export function recordCompletedSession(sessionSummary) {
  const history = loadAnalyticsHistory();
  history.unshift({
    sessionId: sessionSummary.sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    playedAt: sessionSummary.playedAt || new Date().toISOString(),
    mode: sessionSummary.mode || 'standard',
    difficulty: sessionSummary.difficulty || 'all',
    finalScore: toNumber(sessionSummary.finalScore),
    maxScore: toNumber(sessionSummary.maxScore),
    percentage: toNumber(sessionSummary.percentage),
    grade: sessionSummary.grade || { letter: 'F', title: 'Overruled' },
    totalTimeMs: toNumber(sessionSummary.totalTimeMs),
    scenarios: Array.isArray(sessionSummary.scenarios) ? sessionSummary.scenarios : []
  });
  saveAnalyticsHistory(history);
  return history[0];
}

export function clearAnalyticsHistory() {
  localStorage.removeItem(ANALYTICS_STORAGE_KEY);
}

export function getAnalyticsSummary(history = loadAnalyticsHistory()) {
  const sessions = Array.isArray(history) ? history : [];
  const totalSessions = sessions.length;
  const totalScore = sessions.reduce((sum, session) => sum + toNumber(session.percentage), 0);
  const bestScore = sessions.reduce((best, session) => Math.max(best, toNumber(session.percentage)), 0);
  const averageScore = totalSessions > 0 ? Math.round(totalScore / totalSessions) : 0;
  return { totalSessions, averageScore, bestScore };
}

export function getDoctrineBreakdown(history = loadAnalyticsHistory()) {
  const doctrineMap = new Map();

  (Array.isArray(history) ? history : []).forEach((session) => {
    (session.scenarios || []).forEach((scenario) => {
      const doctrine = scenario.doctrineArea || 'Uncategorized';
      const current = doctrineMap.get(doctrine) || {
        doctrineArea: doctrine,
        earned: 0,
        possible: 0,
        attempts: 0,
        scenarioIds: new Set()
      };
      current.earned += toNumber(scenario.scoreEarned);
      current.possible += Math.max(0, toNumber(scenario.maxScore));
      current.attempts += 1;
      if (scenario.scenarioId) {
        current.scenarioIds.add(scenario.scenarioId);
      }
      doctrineMap.set(doctrine, current);
    });
  });

  return [...doctrineMap.values()]
    .map((entry) => ({
      doctrineArea: entry.doctrineArea,
      accuracy: entry.possible > 0 ? Math.round((entry.earned / entry.possible) * 100) : 0,
      attempts: entry.attempts,
      scenarioIds: [...entry.scenarioIds]
    }))
    .sort((a, b) => a.accuracy - b.accuracy || a.doctrineArea.localeCompare(b.doctrineArea));
}

export function getWeakestDoctrines(history = loadAnalyticsHistory(), limit = 3) {
  return getDoctrineBreakdown(history).slice(0, Math.max(0, limit));
}

export function buildAnalyticsCsv(history = loadAnalyticsHistory()) {
  const rows = [[
    'Session ID',
    'Played At',
    'Mode',
    'Difficulty',
    'Final Score',
    'Max Score',
    'Percentage',
    'Grade',
    'Total Time (ms)',
    'Scenario ID',
    'Scenario Title',
    'Doctrine Area',
    'Scenario Score',
    'Scenario Max',
    'Choice Outcomes'
  ]];

  (Array.isArray(history) ? history : []).forEach((session) => {
    (session.scenarios || []).forEach((scenario) => {
      const outcomes = (scenario.choices || [])
        .map((choice) => `${choice.stepNumber}:${choice.outcome}`)
        .join(' | ');
      rows.push([
        session.sessionId,
        session.playedAt,
        session.mode,
        session.difficulty,
        session.finalScore,
        session.maxScore,
        session.percentage,
        session.grade?.letter || '',
        session.totalTimeMs,
        scenario.scenarioId,
        scenario.title,
        scenario.doctrineArea,
        scenario.scoreEarned,
        scenario.maxScore,
        outcomes
      ]);
    });
  });

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function downloadAnalyticsCsv(filename = 'checks-and-balances-results.csv') {
  const csv = buildAnalyticsCsv();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
