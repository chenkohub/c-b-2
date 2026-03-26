/**
 * map.js
 * Campaign map rendering and node detail handling.
 */

import { loadCampaignData, computeCompletionSummary, isScenarioUnlocked, getScenarioProgress } from './progress.js';
import { getMapMentorContent } from './character.js';
import { renderMentorPanel } from './ui.js';

let selectedNodeId = null;
let lastRenderContext = null;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getScenarioById(scenarioCatalog, scenarioId) {
  return scenarioCatalog.find((scenario) => scenario.id === scenarioId) || null;
}

export function computeNodeState(profile, node, options = {}) {
  const unlocked = (profile?.campaign?.unlockedNodeIds || []).includes(node.id);
  const completed = (profile?.campaign?.completedNodeIds || []).includes(node.id);
  const progress = getScenarioProgress(profile, node.scenarioId);
  const mastered = Number(progress.stars || 0) >= 3;
  const active = profile?.campaign?.currentNodeId === node.id;
  const practiceOnly = !unlocked && Boolean(profile?.settings?.sandboxEnabled) && Boolean(options.allowSandboxPractice);

  return {
    unlocked,
    completed,
    mastered,
    active,
    practiceOnly,
    statusLabel: completed
      ? (mastered ? 'Mastered' : 'Completed')
      : unlocked
        ? (active ? 'Active node' : 'Unlocked')
        : practiceOnly
          ? 'Practice only'
          : 'Locked'
  };
}

function renderLegend(campaignData, profile, scenarioCatalog) {
  const legend = document.getElementById('map-region-list');
  if (!legend) {
    return;
  }

  legend.innerHTML = (campaignData?.regions || []).map((region) => {
    const total = (campaignData?.nodes || []).filter((node) => node.regionId === region.id).length;
    const completed = (campaignData?.nodes || []).filter((node) => {
      return node.regionId === region.id && profile?.scenarioProgress?.[node.scenarioId]?.completed;
    }).length;
    return `
      <li class="region-legend-item">
        <strong>${escapeHtml(region.label)}</strong>
        <span>${completed}/${total}</span>
      </li>
    `;
  }).join('');

  const completion = computeCompletionSummary(profile, scenarioCatalog);
  const summary = document.getElementById('map-summary-count');
  if (summary) {
    summary.textContent = `${completion.completed}/${completion.total} complete`;
  }
}

function renderEdges(campaignData) {
  const svg = document.getElementById('map-svg-layer');
  if (!svg) {
    return;
  }

  const nodeById = new Map((campaignData?.nodes || []).map((node) => [node.id, node]));
  svg.innerHTML = (campaignData?.edges || []).map((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) {
      return '';
    }
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="campaign-edge" />`;
  }).join('');
}

function setSelectedNode(nodeId) {
  selectedNodeId = nodeId;
  document.querySelectorAll('.campaign-node').forEach((button) => {
    const isSelected = button.dataset.nodeId === nodeId;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
}

async function renderSelectedNode() {
  if (!lastRenderContext) {
    return;
  }

  const { campaignData, profile, scenarioCatalog, onPlay, onViewInLibrary } = lastRenderContext;
  const node = (campaignData?.nodes || []).find((entry) => entry.id === selectedNodeId) || campaignData?.nodes?.[0];
  if (!node) {
    return;
  }

  setSelectedNode(node.id);
  const scenario = getScenarioById(scenarioCatalog, node.scenarioId);
  const progress = getScenarioProgress(profile, node.scenarioId);
  const state = computeNodeState(profile, node, { allowSandboxPractice: true });
  const mentor = await getMapMentorContent(profile, state.unlocked ? 'ready' : 'locked');

  const titleEl = document.getElementById('map-selected-title');
  const metaEl = document.getElementById('map-selected-meta');
  const statusEl = document.getElementById('map-selected-status');
  const rewardsEl = document.getElementById('map-selected-rewards');
  const hintEl = document.getElementById('map-selected-hint');
  const starsEl = document.getElementById('map-selected-stars');
  const playBtn = document.getElementById('map-play-btn');
  const libraryBtn = document.getElementById('map-view-library-btn');
  const practiceLabel = document.getElementById('map-practice-only-label');

  if (titleEl) titleEl.textContent = scenario?.title || node.id;
  if (metaEl) metaEl.textContent = `${scenario?.doctrineArea || 'Uncategorized'} · ${scenario?.branch || 'judiciary'} · ${scenario?.difficulty || 'medium'}`;
  if (statusEl) statusEl.textContent = state.statusLabel;
  if (rewardsEl) rewardsEl.textContent = state.completed ? 'Rewards claimed' : 'Rewards: XP + stars + unlock progress';
  if (hintEl) hintEl.textContent = mentor?.line || 'Choose the next doctrine carefully.';
  if (starsEl) starsEl.innerHTML = '★'.repeat(Number(progress.stars || 0)).padEnd(3, '☆');
  if (practiceLabel) {
    practiceLabel.classList.toggle('hidden', !state.practiceOnly);
    practiceLabel.textContent = state.practiceOnly ? 'Practice Only' : '';
  }

  if (playBtn) {
    const canPlay = state.unlocked || state.practiceOnly;
    playBtn.disabled = !canPlay;
    playBtn.textContent = state.practiceOnly ? 'Practice Scenario' : 'Play';
    playBtn.onclick = () => {
      if (!canPlay) {
        return;
      }
      if (typeof onPlay === 'function') {
        onPlay(node, {
          practiceOnly: state.practiceOnly,
          source: 'campaign'
        });
      }
    };
  }

  if (libraryBtn) {
    libraryBtn.onclick = () => {
      if (typeof onViewInLibrary === 'function') {
        onViewInLibrary(node);
      }
    };
  }

  renderMentorPanel('map-mentor-panel', mentor);
}

export async function renderCampaignMap({ profile, scenarioCatalog = [], onPlay, onViewInLibrary } = {}) {
  const campaignData = await loadCampaignData();
  lastRenderContext = { campaignData, profile, scenarioCatalog, onPlay, onViewInLibrary };
  renderLegend(campaignData, profile, scenarioCatalog);
  renderEdges(campaignData);

  const layer = document.getElementById('map-node-layer');
  if (!layer) {
    return campaignData;
  }

  layer.innerHTML = (campaignData?.nodes || []).map((node) => {
    const scenario = getScenarioById(scenarioCatalog, node.scenarioId);
    const state = computeNodeState(profile, node, { allowSandboxPractice: true });
    const progress = getScenarioProgress(profile, node.scenarioId);
    const classes = [
      'campaign-node',
      state.unlocked ? 'is-unlocked' : 'is-locked',
      state.completed ? 'is-completed' : '',
      state.mastered ? 'is-mastered' : '',
      state.active ? 'is-active' : '',
      state.practiceOnly ? 'is-practice-only' : ''
    ].filter(Boolean).join(' ');

    return `
      <button
        type="button"
        class="${classes}"
        data-node-id="${escapeHtml(node.id)}"
        style="left:${node.x}%; top:${node.y}%;"
        aria-label="${escapeHtml(scenario?.title || node.id)} — ${escapeHtml(state.statusLabel)}"
      >
        <span class="campaign-node-label">${escapeHtml(scenario?.title || node.id)}</span>
        <span class="campaign-node-stars">${'★'.repeat(Number(progress.stars || 0)).padEnd(3, '☆')}</span>
      </button>
    `;
  }).join('');

  layer.querySelectorAll('.campaign-node').forEach((button) => {
    button.addEventListener('click', async () => {
      selectedNodeId = button.dataset.nodeId;
      await renderSelectedNode();
    });
  });

  selectedNodeId = selectedNodeId || profile?.campaign?.currentNodeId || campaignData?.nodes?.[0]?.id || null;
  await renderSelectedNode();
  return campaignData;
}

export const __testHooks = {
  getSelectedNodeId() {
    return selectedNodeId;
  },
  setSelectedNodeId(nodeId) {
    selectedNodeId = nodeId;
  },
  clear() {
    selectedNodeId = null;
    lastRenderContext = null;
  }
};
