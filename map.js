/**
 * map.js
 * Campaign map rendering and node detail handling.
 */

import { loadCampaignData, computeCompletionSummary, isScenarioUnlocked, getScenarioProgress } from './progress.js';
import { getMapMentorContent } from './character.js';
import { renderMentorPanel } from './ui.js';

let lastRenderContext = null;
let viewState = {
  focusedRegionId: 'all',
  emphasizeConnected: true,
  selectedNodeId: null
};

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

function getNodeById(campaignData, nodeId) {
  return (campaignData?.nodes || []).find((node) => node.id === nodeId) || null;
}

function getRegionById(campaignData, regionId) {
  return (campaignData?.regions || []).find((region) => region.id === regionId) || null;
}

function joinWithConjunction(items = [], conjunction = 'and') {
  if (items.length <= 1) {
    return items[0] || '';
  }

  if (items.length === 2) {
    return `${items[0]} ${conjunction} ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
}

function getNodeTitle(nodeId, campaignData, scenarioCatalog) {
  const node = getNodeById(campaignData, nodeId);
  const scenario = node ? getScenarioById(scenarioCatalog, node.scenarioId) : null;
  return getShortNodeLabel(scenario?.title || nodeId);
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

function buildNodeGraph(campaignData) {
  const nodes = campaignData?.nodes || [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const parentsById = new Map(nodes.map((node) => [node.id, new Set()]));
  const childrenById = new Map(nodes.map((node) => [node.id, new Set()]));

  const linkNodes = (fromId, toId) => {
    if (!nodeById.has(fromId) || !nodeById.has(toId)) {
      return;
    }
    childrenById.get(fromId)?.add(toId);
    parentsById.get(toId)?.add(fromId);
  };

  (campaignData?.edges || []).forEach((edge) => {
    linkNodes(edge.from, edge.to);
  });

  nodes.forEach((node) => {
    [...(node.requiresAll || []), ...(node.requiresAny || [])].forEach((parentId) => {
      linkNodes(parentId, node.id);
    });
  });

  const adjacentById = new Map();
  nodeById.forEach((_, nodeId) => {
    adjacentById.set(nodeId, new Set([
      ...(parentsById.get(nodeId) || []),
      ...(childrenById.get(nodeId) || [])
    ]));
  });

  return {
    nodeById,
    parentsById,
    childrenById,
    adjacentById
  };
}

function getConnectedNodeIds(campaignData, selectedNodeId) {
  if (!selectedNodeId) {
    return new Set();
  }

  const graph = buildNodeGraph(campaignData);
  const connected = new Set([selectedNodeId]);

  (graph.parentsById.get(selectedNodeId) || new Set()).forEach((nodeId) => connected.add(nodeId));
  (graph.childrenById.get(selectedNodeId) || new Set()).forEach((nodeId) => connected.add(nodeId));

  return connected;
}

function isMainPathConnection(edge, mainPath = []) {
  const fromIndex = mainPath.indexOf(edge.from);
  const toIndex = mainPath.indexOf(edge.to);

  if (fromIndex === -1 || toIndex === -1) {
    return false;
  }

  return Math.abs(fromIndex - toIndex) === 1;
}

function computeVisualClasses(node, state, currentViewState, campaignData) {
  const connectedNodeIds = currentViewState.emphasizeConnected
    ? getConnectedNodeIds(campaignData, currentViewState.selectedNodeId)
    : new Set();
  const selectedNodeId = currentViewState.selectedNodeId;
  const isSelected = selectedNodeId === node.id;
  const isConnected = Boolean(
    currentViewState.emphasizeConnected
      && selectedNodeId
      && node.id !== selectedNodeId
      && connectedNodeIds.has(node.id)
  );
  const isInFocusRegion = currentViewState.focusedRegionId !== 'all'
    && currentViewState.focusedRegionId === node.regionId;
  const isMainPath = (campaignData?.mainPath || []).includes(node.id);

  let isDimmed = false;

  if (currentViewState.focusedRegionId !== 'all' && node.regionId !== currentViewState.focusedRegionId) {
    isDimmed = true;
  }

  if (
    currentViewState.emphasizeConnected
    && selectedNodeId
    && connectedNodeIds.size > 0
    && !connectedNodeIds.has(node.id)
  ) {
    isDimmed = true;
  }

  return [
    state.unlocked ? 'is-unlocked' : 'is-locked',
    state.completed ? 'is-completed' : '',
    state.mastered ? 'is-mastered' : '',
    state.active ? 'is-active' : '',
    state.practiceOnly ? 'is-practice-only' : '',
    isSelected ? 'is-selected' : '',
    isConnected ? 'is-connected' : '',
    isInFocusRegion ? 'is-in-focus-region' : '',
    isMainPath ? 'is-main-path' : '',
    isDimmed ? 'is-dimmed' : ''
  ].filter(Boolean);
}

function shouldShowNodeLabel(node, state, currentViewState, campaignData) {
  if (currentViewState.selectedNodeId === node.id) return true;
  if (state.active) return true;
  if ((campaignData?.mainPath || []).includes(node.id)) return true;
  if (currentViewState.focusedRegionId !== 'all' && currentViewState.focusedRegionId === node.regionId) return true;
  return false;
}

function getShortNodeLabel(title) {
  const normalized = String(title || '').replace(/^The\s+/i, '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= 24) {
    return normalized;
  }

  const primarySegment = normalized.split(/[:\-–—]/).map((segment) => segment.trim()).find(Boolean);
  if (primarySegment && primarySegment.length <= 24) {
    return primarySegment;
  }

  return `${normalized.slice(0, 21).trimEnd()}…`;
}

function getPreferredNodeIdForRegion(campaignData, profile, regionId) {
  const nodes = regionId === 'all'
    ? (campaignData?.nodes || [])
    : (campaignData?.nodes || []).filter((node) => node.regionId === regionId);

  if (!nodes.length) {
    return (campaignData?.nodes || [])[0]?.id || null;
  }

  const activeNode = nodes.find((node) => profile?.campaign?.currentNodeId === node.id);
  if (activeNode) {
    return activeNode.id;
  }

  const unlockedNode = nodes.find((node) => (profile?.campaign?.unlockedNodeIds || []).includes(node.id));
  if (unlockedNode) {
    return unlockedNode.id;
  }

  return nodes[0]?.id || null;
}

function normalizeViewState(campaignData, profile) {
  const regionIds = new Set((campaignData?.regions || []).map((region) => region.id));
  if (viewState.focusedRegionId !== 'all' && !regionIds.has(viewState.focusedRegionId)) {
    viewState.focusedRegionId = 'all';
  }

  const currentSelection = getNodeById(campaignData, viewState.selectedNodeId);
  if (!currentSelection) {
    viewState.selectedNodeId = getPreferredNodeIdForRegion(campaignData, profile, viewState.focusedRegionId);
    return;
  }

  if (viewState.focusedRegionId !== 'all' && currentSelection.regionId !== viewState.focusedRegionId) {
    viewState.selectedNodeId = getPreferredNodeIdForRegion(campaignData, profile, viewState.focusedRegionId);
  }
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

function populateRegionFilter(campaignData) {
  const regionFilter = document.getElementById('map-region-filter');
  if (!regionFilter) {
    return;
  }

  const regionOptions = (campaignData?.regions || []).map((region) => {
    return `<option value="${escapeHtml(region.id)}">${escapeHtml(region.label)}</option>`;
  }).join('');

  regionFilter.innerHTML = `
    <option value="all">All Regions</option>
    ${regionOptions}
  `;

  const availableValues = new Set(['all', ...(campaignData?.regions || []).map((region) => region.id)]);
  if (!availableValues.has(viewState.focusedRegionId)) {
    viewState.focusedRegionId = 'all';
  }

  regionFilter.value = viewState.focusedRegionId;

  const emphasizeToggle = document.getElementById('map-emphasize-toggle');
  if (emphasizeToggle) {
    emphasizeToggle.checked = Boolean(viewState.emphasizeConnected);
  }
}

function bindMapControls() {
  const regionFilter = document.getElementById('map-region-filter');
  const emphasizeToggle = document.getElementById('map-emphasize-toggle');

  if (regionFilter && !regionFilter.dataset.bound) {
    regionFilter.dataset.bound = 'true';
    regionFilter.addEventListener('change', async (event) => {
      viewState.focusedRegionId = event.target.value;
      if (lastRenderContext) {
        await renderCampaignMap(lastRenderContext);
      }
    });
  }

  if (emphasizeToggle && !emphasizeToggle.dataset.bound) {
    emphasizeToggle.dataset.bound = 'true';
    emphasizeToggle.addEventListener('change', async (event) => {
      viewState.emphasizeConnected = Boolean(event.target.checked);
      if (lastRenderContext) {
        await renderCampaignMap(lastRenderContext);
      }
    });
  }
}

function renderEdges(campaignData, profile) {
  const svg = document.getElementById('map-svg-layer');
  if (!svg) {
    return;
  }

  const graph = buildNodeGraph(campaignData);
  const connectedNodeIds = viewState.emphasizeConnected
    ? getConnectedNodeIds(campaignData, viewState.selectedNodeId)
    : new Set();

  svg.innerHTML = (campaignData?.edges || []).map((edge) => {
    const from = graph.nodeById.get(edge.from);
    const to = graph.nodeById.get(edge.to);
    if (!from || !to) {
      return '';
    }

    const isConnected = Boolean(
      viewState.emphasizeConnected
        && viewState.selectedNodeId
        && connectedNodeIds.has(edge.from)
        && connectedNodeIds.has(edge.to)
    );
    const isMainPathEdge = isMainPathConnection(edge, campaignData?.mainPath || []);

    let isDimmed = false;

    if (
      viewState.focusedRegionId !== 'all'
      && from.regionId !== viewState.focusedRegionId
      && to.regionId !== viewState.focusedRegionId
    ) {
      isDimmed = true;
    }

    if (viewState.emphasizeConnected && viewState.selectedNodeId && !isConnected) {
      isDimmed = true;
    }

    const edgeClasses = [
      'campaign-edge',
      isMainPathEdge ? 'is-main-path' : '',
      isConnected ? 'is-connected' : '',
      isDimmed ? 'is-dimmed' : ''
    ].filter(Boolean).join(' ');

    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="${edgeClasses}" />`;
  }).join('');
}

function summarizeRequirements(node, campaignData, profile, scenarioCatalog) {
  if (!node) {
    return '';
  }

  const state = computeNodeState(profile, node, { allowSandboxPractice: true });
  if (state.unlocked || state.completed) {
    return 'Unlocked';
  }

  if (state.practiceOnly) {
    return 'Campaign locked · Sandbox practice available';
  }

  const parts = [];
  const requiredAllTitles = (node.requiresAll || []).map((nodeId) => getNodeTitle(nodeId, campaignData, scenarioCatalog));
  const requiredAnyTitles = (node.requiresAny || []).map((nodeId) => getNodeTitle(nodeId, campaignData, scenarioCatalog));
  const requiredStars = Number(node.requiresMinStarsInRegion || 0);
  const regionLabel = getRegionById(campaignData, node.regionId)?.label || 'this region';

  if (requiredAllTitles.length > 0) {
    parts.push(`complete ${joinWithConjunction(requiredAllTitles, 'and')}`);
  }

  if (requiredAnyTitles.length > 0) {
    parts.push(`complete one of ${joinWithConjunction(requiredAnyTitles, 'or')}`);
  }

  if (requiredStars > 0) {
    parts.push(`${requiredStars} star${requiredStars === 1 ? '' : 's'} in ${regionLabel}`);
  }

  if (!parts.length) {
    return 'Unlocked';
  }

  return `Requires: ${parts.join(' · ')}`;
}

function summarizeNextUnlock(node, campaignData, profile, scenarioCatalog, state) {
  const graph = buildNodeGraph(campaignData);
  const childNodes = [...(graph.childrenById.get(node.id) || new Set())]
    .map((nodeId) => graph.nodeById.get(nodeId))
    .filter(Boolean);

  if (!childNodes.length) {
    return state.completed
      ? 'This node closes out the current branch.'
      : 'This node is a branch endpoint.';
  }

  const lockedChildren = childNodes.filter((childNode) => {
    return !isScenarioUnlocked(profile, childNode.scenarioId, campaignData);
  });
  const targetNodes = lockedChildren.length ? lockedChildren : childNodes;
  const targetTitle = getShortNodeLabel(
    getScenarioById(scenarioCatalog, targetNodes[0]?.scenarioId)?.title || targetNodes[0]?.id || ''
  );

  if (!targetTitle) {
    return 'Choose a node to see details.';
  }

  if (lockedChildren.length) {
    if (lockedChildren.length === 1) {
      return state.completed
        ? `Next unlock: ${targetTitle}`
        : `Clearing this node advances toward ${targetTitle}`;
    }
    return state.completed
      ? `Next unlocks: ${targetTitle} + ${lockedChildren.length - 1} more`
      : `Clearing this node advances ${lockedChildren.length} downstream nodes`;
  }

  if (childNodes.length === 1) {
    return `Leads to: ${targetTitle}`;
  }

  return `Leads to: ${targetTitle} + ${childNodes.length - 1} more`;
}

async function renderSelectedNode() {
  if (!lastRenderContext) {
    return;
  }

  const { campaignData, profile, scenarioCatalog, onPlay, onViewInLibrary } = lastRenderContext;
  const defaultNodeId = getPreferredNodeIdForRegion(campaignData, profile, viewState.focusedRegionId);
  const node = getNodeById(campaignData, viewState.selectedNodeId) || getNodeById(campaignData, defaultNodeId) || campaignData?.nodes?.[0];
  if (!node) {
    return;
  }

  viewState.selectedNodeId = node.id;

  const scenario = getScenarioById(scenarioCatalog, node.scenarioId);
  const progress = getScenarioProgress(profile, node.scenarioId);
  const state = computeNodeState(profile, node, { allowSandboxPractice: true });
  const mentor = await getMapMentorContent(profile, state.unlocked ? 'ready' : 'locked');
  const region = getRegionById(campaignData, node.regionId);

  const titleEl = document.getElementById('map-selected-title');
  const metaEl = document.getElementById('map-selected-meta');
  const statusEl = document.getElementById('map-selected-status');
  const rewardsEl = document.getElementById('map-selected-rewards');
  const hintEl = document.getElementById('map-selected-hint');
  const starsEl = document.getElementById('map-selected-stars');
  const playBtn = document.getElementById('map-play-btn');
  const libraryBtn = document.getElementById('map-view-library-btn');
  const practiceLabel = document.getElementById('map-practice-only-label');
  const requirementsEl = document.getElementById('map-selected-requirements');
  const regionEl = document.getElementById('map-selected-region');

  if (titleEl) titleEl.textContent = scenario?.title || node.id;
  if (metaEl) metaEl.textContent = `${scenario?.doctrineArea || 'Uncategorized'} · ${scenario?.branch || 'judiciary'} · ${scenario?.difficulty || 'medium'}`;
  if (statusEl) statusEl.textContent = state.statusLabel;
  if (rewardsEl) {
    rewardsEl.textContent = state.completed
      ? 'Rewards claimed · Replay for review or a higher star total.'
      : 'Rewards: XP + stars + unlock progress';
  }
  if (hintEl) hintEl.textContent = summarizeNextUnlock(node, campaignData, profile, scenarioCatalog, state);
  if (starsEl) starsEl.innerHTML = '★'.repeat(Number(progress.stars || 0)).padEnd(3, '☆');
  if (regionEl) {
    regionEl.textContent = region ? `Region: ${region.label}` : '';
  }
  if (requirementsEl) {
    requirementsEl.textContent = summarizeRequirements(node, campaignData, profile, scenarioCatalog);
  }
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

  populateRegionFilter(campaignData);
  bindMapControls();
  normalizeViewState(campaignData, profile);
  populateRegionFilter(campaignData);
  renderLegend(campaignData, profile, scenarioCatalog);
  renderEdges(campaignData, profile);

  const layer = document.getElementById('map-node-layer');
  if (!layer) {
    return campaignData;
  }

  layer.innerHTML = (campaignData?.nodes || []).map((node) => {
    const scenario = getScenarioById(scenarioCatalog, node.scenarioId);
    const state = computeNodeState(profile, node, { allowSandboxPractice: true });
    const progress = getScenarioProgress(profile, node.scenarioId);
    const starCount = Number(progress.stars || 0);
    const showLabel = shouldShowNodeLabel(node, state, viewState, campaignData);
    const shortTitle = getShortNodeLabel(scenario?.title || node.id);
    const classes = ['campaign-node', ...computeVisualClasses(node, state, viewState, campaignData), showLabel ? 'show-label' : '']
      .filter(Boolean)
      .join(' ');

    return `
      <button
        type="button"
        class="${classes}"
        data-node-id="${escapeHtml(node.id)}"
        data-region-id="${escapeHtml(node.regionId)}"
        style="left:${node.x}%; top:${node.y}%;"
        aria-label="${escapeHtml(scenario?.title || node.id)} — ${escapeHtml(state.statusLabel)} — ${starCount} stars"
        aria-pressed="${String(viewState.selectedNodeId === node.id)}"
      >
        <span class="campaign-node-core" aria-hidden="true">
          <span class="campaign-node-dot"></span>
          ${starCount > 0 ? `<span class="campaign-node-star-badge">${'★'.repeat(starCount)}</span>` : ''}
        </span>
        <span class="campaign-node-label">${escapeHtml(shortTitle)}</span>
      </button>
    `;
  }).join('');

  layer.querySelectorAll('.campaign-node').forEach((button) => {
    button.addEventListener('click', async () => {
      viewState.selectedNodeId = button.dataset.nodeId;
      await renderCampaignMap({ profile, scenarioCatalog, onPlay, onViewInLibrary });
    });
  });

  await renderSelectedNode();
  return campaignData;
}

export const __testHooks = {
  getSelectedNodeId() {
    return viewState.selectedNodeId;
  },
  setSelectedNodeId(nodeId) {
    viewState.selectedNodeId = nodeId;
  },
  getViewState() {
    return { ...viewState };
  },
  clear() {
    lastRenderContext = null;
    viewState = {
      focusedRegionId: 'all',
      emphasizeConnected: true,
      selectedNodeId: null
    };
  }
};
