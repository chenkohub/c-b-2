import { loadCampaignData, unlockAvailableNodes } from '../progress.js';
import { renderCampaignMap, __testHooks, computeNodeState } from '../map.js';
import { test, assert, equal, wait } from './test-utils.js';

const scenarioCatalog = [
  {
    id: 'youngstown-steel-seizure',
    title: 'The Steel Seizure Crisis',
    doctrineArea: 'Youngstown Framework / Separation of Powers',
    branch: 'judiciary',
    difficulty: 'medium'
  },
  {
    id: 'ins-v-chadha-legislative-veto',
    title: 'The Legislative Veto Showdown',
    doctrineArea: 'Bicameralism and Presentment / Legislative Veto',
    branch: 'judiciary',
    difficulty: 'easy'
  },
  {
    id: 'scenario_006',
    title: 'The Frozen Accounts',
    doctrineArea: 'Youngstown Zone 2 / Frankfurter Historical Practice Test',
    branch: 'judiciary',
    difficulty: 'medium'
  }
];

function mountMapShell() {
  const root = document.getElementById('fixture-root');
  root.innerHTML = `
    <div class="map-toolbar">
      <div class="map-toolbar-group">
        <label for="map-region-filter">Region</label>
        <select id="map-region-filter">
          <option value="all">All Regions</option>
        </select>
      </div>
      <div class="map-toolbar-group">
        <label class="toggle-row" for="map-emphasize-toggle">
          <span>Highlight related nodes</span>
          <input id="map-emphasize-toggle" type="checkbox" checked />
        </label>
      </div>
      <div class="map-toolbar-summary">
        <span id="map-summary-count"></span>
      </div>
    </div>
    <details class="map-legend-details">
      <summary>Region Progress</summary>
      <ul id="map-region-list"></ul>
      <div class="map-legend-key"></div>
    </details>
    <svg id="map-svg-layer"></svg>
    <div id="map-node-layer"></div>
    <div id="map-selected-title"></div>
    <div id="map-selected-meta"></div>
    <div id="map-selected-region"></div>
    <div id="map-selected-requirements"></div>
    <div id="map-selected-status"></div>
    <div id="map-selected-rewards"></div>
    <div id="map-selected-hint"></div>
    <div id="map-selected-stars"></div>
    <button id="map-play-btn" type="button"></button>
    <button id="map-view-library-btn" type="button"></button>
    <div id="map-practice-only-label" class="hidden"></div>
    <div id="map-mentor-panel"></div>
  `;
}

function baseProfile() {
  return {
    settings: { mentorCharacterId: 'chief-clerk', sandboxEnabled: true },
    scenarioProgress: {
      'youngstown-steel-seizure': { unlocked: true, completed: true, stars: 3 },
      'ins-v-chadha-legislative-veto': { unlocked: true, completed: false, stars: 0 },
      scenario_006: { unlocked: false, completed: false, stars: 0 }
    },
    campaign: {
      currentNodeId: 'ins-v-chadha-legislative-veto',
      unlockedNodeIds: ['youngstown-steel-seizure', 'ins-v-chadha-legislative-veto'],
      completedNodeIds: ['youngstown-steel-seizure'],
      discoveredRegionIds: ['executive-power', 'administrative-state']
    }
  };
}

test('Map node state classes render correctly.', async () => {
  mountMapShell();
  __testHooks.clear();
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const completedNode = document.querySelector('[data-node-id="youngstown-steel-seizure"]');
  const activeNode = document.querySelector('[data-node-id="ins-v-chadha-legislative-veto"]');

  assert(completedNode.classList.contains('is-completed'), 'Completed node should be marked completed.');
  assert(completedNode.classList.contains('is-mastered'), 'Three-star node should be marked mastered.');
  assert(activeNode.classList.contains('is-unlocked'), 'Active node should be unlocked.');
  assert(activeNode.classList.contains('is-active'), 'Current campaign node should be active.');
});

test('Selected nodes show labels while unrelated side-path nodes stay hidden.', async () => {
  mountMapShell();
  __testHooks.clear();
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const selectableNode = document.querySelector('[data-node-id="scenario_006"]');
  selectableNode.click();
  await wait(60);

  const selectedNode = document.querySelector('[data-node-id="scenario_006"]');
  const unrelatedNode = document.querySelector('[data-node-id="scenario_009"]');

  assert(selectedNode.classList.contains('show-label'), 'Selected nodes should surface their label.');
  assert(!unrelatedNode.classList.contains('show-label'), 'Unrelated non-main-path nodes should keep labels hidden.');
});

test('Selecting a node updates the sidebar detail panel.', async () => {
  mountMapShell();
  __testHooks.clear();
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const activeNode = document.querySelector('[data-node-id="ins-v-chadha-legislative-veto"]');
  activeNode.click();
  await wait(60);

  equal(document.getElementById('map-selected-title').textContent, 'The Legislative Veto Showdown');
  assert(document.getElementById('map-selected-status').textContent.includes('Active') || document.getElementById('map-selected-status').textContent.includes('Unlocked'), 'Sidebar status should update for the selected node.');
  assert(document.getElementById('map-selected-region').textContent.includes('Region:'), 'Sidebar should include region context.');
  assert(document.getElementById('map-selected-requirements').textContent.length > 0, 'Sidebar should include requirement context.');
});

test('Region focus dims out-of-region nodes.', async () => {
  mountMapShell();
  __testHooks.clear();
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const regionFilter = document.getElementById('map-region-filter');
  regionFilter.value = 'executive-power';
  regionFilter.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(60);

  const executiveNode = document.querySelector('[data-node-id="youngstown-steel-seizure"]');
  const administrativeNode = document.querySelector('[data-node-id="ins-v-chadha-legislative-veto"]');

  assert(!executiveNode.classList.contains('is-dimmed'), 'Focused-region nodes should stay emphasized.');
  assert(administrativeNode.classList.contains('is-dimmed'), 'Out-of-region nodes should be dimmed after filtering.');
});

test('Selected nodes highlight adjacent edges.', async () => {
  mountMapShell();
  __testHooks.clear();
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const node = document.querySelector('[data-node-id="scenario_006"]');
  node.click();
  await wait(60);

  equal(document.querySelectorAll('.campaign-edge.is-connected').length, 2, 'The selected side-path node should emphasize its parent and child edges.');
});

test('Nodes render pin markup instead of star text blocks.', async () => {
  mountMapShell();
  __testHooks.clear();
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const node = document.querySelector('[data-node-id="youngstown-steel-seizure"]');
  assert(node.querySelector('.campaign-node-dot'), 'Node pins should render a compact dot.');
  assert(!node.querySelector('.campaign-node-stars'), 'Legacy star text blocks should not render inside nodes.');
});

test('Completed nodes unlock expected children on the map.', async () => {
  mountMapShell();
  __testHooks.clear();
  const campaignData = await loadCampaignData();
  const profile = baseProfile();
  profile.campaign.unlockedNodeIds = ['youngstown-steel-seizure'];
  profile.campaign.completedNodeIds = ['youngstown-steel-seizure'];

  const newUnlocks = unlockAvailableNodes(profile, campaignData);
  assert(newUnlocks.includes('ins-v-chadha-legislative-veto'), 'The next main-path node should unlock after Youngstown.');
  await renderCampaignMap({ profile, scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const childNode = document.querySelector('[data-node-id="ins-v-chadha-legislative-veto"]');
  assert(childNode.classList.contains('is-unlocked'), 'Unlocked child node should render with the unlocked class.');
});

test('computeNodeState marks sandbox-only scenarios without changing unlock state.', () => {
  const node = {
    id: 'scenario_006',
    scenarioId: 'scenario_006'
  };

  const state = computeNodeState(baseProfile(), node, { allowSandboxPractice: true });
  assert(state.practiceOnly, 'Locked nodes should be marked practice-only when sandbox is enabled.');
  assert(!state.unlocked, 'Practice-only nodes should remain locked for campaign progression.');
});
