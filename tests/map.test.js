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
    <div id="map-summary-count"></div>
    <ul id="map-region-list"></ul>
    <svg id="map-svg-layer"></svg>
    <div id="map-node-layer"></div>
    <div id="map-selected-title"></div>
    <div id="map-selected-meta"></div>
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

test('Selecting a node updates the sidebar detail panel.', async () => {
  mountMapShell();
  __testHooks.clear();
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const activeNode = document.querySelector('[data-node-id="ins-v-chadha-legislative-veto"]');
  activeNode.click();
  await wait(40);

  equal(document.getElementById('map-selected-title').textContent, 'The Legislative Veto Showdown');
  assert(document.getElementById('map-selected-status').textContent.includes('Active') || document.getElementById('map-selected-status').textContent.includes('Unlocked'), 'Sidebar status should update for the selected node.');
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
