/**
 * library.js
 * Scenario library filtering, sorting, and launch UI.
 */

import { getScenarioProgress, setSandboxEnabled } from './progress.js';
import { getLibraryMentorContent } from './character.js';
import { renderMentorPanel, populateAppModal } from './ui.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildLibraryEntries(scenarioCatalog = [], profile) {
  return scenarioCatalog.map((scenario) => {
    const progress = getScenarioProgress(profile, scenario.id);
    let status = 'locked';
    if (progress.stars >= 3) {
      status = 'mastered';
    } else if (progress.completed) {
      status = 'completed';
    } else if (progress.unlocked) {
      status = 'unlocked';
    }

    return {
      ...scenario,
      status,
      stars: Number(progress.stars || 0),
      bestPercent: Number(progress.bestPercent || 0),
      bestScore: Number(progress.bestScore || 0),
      attempts: Number(progress.attempts || 0),
      lastPlayedAt: progress.lastPlayedAt || null,
      unlocked: Boolean(progress.unlocked),
      completed: Boolean(progress.completed)
    };
  });
}

export function filterLibraryEntries(entries = [], filters = {}) {
  const search = String(filters.search || '').trim().toLowerCase();

  return entries.filter((entry) => {
    if (search) {
      const haystack = `${entry.title} ${entry.doctrineArea} ${entry.branch}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    if (filters.branch && filters.branch !== 'all' && entry.branch !== filters.branch) {
      return false;
    }
    if (filters.doctrine && filters.doctrine !== 'all' && entry.doctrineArea !== filters.doctrine) {
      return false;
    }
    if (filters.difficulty && filters.difficulty !== 'all' && entry.difficulty !== filters.difficulty) {
      return false;
    }
    if (filters.status && filters.status !== 'all' && entry.status !== filters.status) {
      return false;
    }
    return true;
  });
}

export function sortLibraryEntries(entries = [], sortBy = 'title') {
  const copy = [...entries];
  copy.sort((a, b) => {
    switch (sortBy) {
      case 'doctrine':
        return a.doctrineArea.localeCompare(b.doctrineArea) || a.title.localeCompare(b.title);
      case 'bestScore':
        return b.bestPercent - a.bestPercent || a.title.localeCompare(b.title);
      case 'recentlyPlayed':
        return String(b.lastPlayedAt || '').localeCompare(String(a.lastPlayedAt || '')) || a.title.localeCompare(b.title);
      case 'title':
      default:
        return a.title.localeCompare(b.title);
    }
  });
  return copy;
}

function getFiltersFromDom() {
  return {
    search: document.getElementById('library-search')?.value || '',
    branch: document.getElementById('library-branch-filter')?.value || 'all',
    doctrine: document.getElementById('library-doctrine-filter')?.value || 'all',
    difficulty: document.getElementById('library-difficulty-filter')?.value || 'all',
    status: document.getElementById('library-status-filter')?.value || 'all',
    sort: document.getElementById('library-sort')?.value || 'title'
  };
}

function statusLabel(entry) {
  if (entry.status === 'mastered') {
    return 'Mastered';
  }
  if (entry.status === 'completed') {
    return 'Completed';
  }
  if (entry.status === 'unlocked') {
    return 'Unlocked';
  }
  return 'Locked';
}

function previewScenario(entry) {
  populateAppModal({
    title: entry.title,
    bodyHtml: `
      <p><strong>Doctrine:</strong> ${escapeHtml(entry.doctrineArea || 'Uncategorized')}</p>
      <p><strong>Branch:</strong> ${escapeHtml(entry.branch || 'judiciary')}</p>
      <p><strong>Difficulty:</strong> ${escapeHtml(entry.difficulty || 'medium')}</p>
      <p>${escapeHtml(entry.description || '')}</p>
    `,
    confirmText: '',
    cancelText: 'Close',
    closeOnOverlay: true
  });
}

function populateFilterOptions(scenarioCatalog = []) {
  const doctrineFilter = document.getElementById('library-doctrine-filter');
  if (doctrineFilter && doctrineFilter.options.length <= 1) {
    const doctrines = [...new Set(scenarioCatalog.map((scenario) => scenario.doctrineArea).filter(Boolean))].sort();
    doctrineFilter.innerHTML = '<option value="all">All doctrines</option>'
      + doctrines.map((doctrine) => `<option value="${escapeHtml(doctrine)}">${escapeHtml(doctrine)}</option>`).join('');
  }
}

function renderCards(entries, profile, handlers = {}) {
  const container = document.getElementById('library-card-grid');
  if (!container) {
    return;
  }

  const sandboxEnabled = Boolean(profile?.settings?.sandboxEnabled);
  container.innerHTML = entries.map((entry) => {
    const locked = !entry.unlocked;
    const practiceOnly = locked && sandboxEnabled;
    const buttonDisabled = locked && !sandboxEnabled;
    return `
      <article class="scenario-card" data-scenario-id="${escapeHtml(entry.id)}">
        <div class="scenario-card-top">
          <div>
            <h3>${escapeHtml(entry.title)}</h3>
            <p class="scenario-card-meta">${escapeHtml(entry.doctrineArea)} · ${escapeHtml(entry.branch)} · ${escapeHtml(entry.difficulty)}</p>
          </div>
          <span class="status-chip status-${escapeHtml(entry.status)}">${statusLabel(entry)}</span>
        </div>
        <div class="scenario-card-stats">
          <span>${'★'.repeat(entry.stars).padEnd(3, '☆')}</span>
          <span>Best ${entry.bestPercent}%</span>
          <span>${entry.attempts} attempt${entry.attempts === 1 ? '' : 's'}</span>
        </div>
        <div class="scenario-card-actions">
          <button type="button" class="btn btn-primary library-play-btn" data-scenario-id="${escapeHtml(entry.id)}" ${buttonDisabled ? 'disabled' : ''}>
            ${practiceOnly ? 'Practice' : 'Play'}
          </button>
          <button type="button" class="btn btn-secondary library-preview-btn" data-scenario-id="${escapeHtml(entry.id)}">Preview</button>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('.library-play-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const entry = entries.find((scenario) => scenario.id === button.dataset.scenarioId);
      if (!entry) {
        return;
      }
      const practiceOnly = !entry.unlocked && sandboxEnabled;
      if (typeof handlers.onPlay === 'function') {
        handlers.onPlay(entry, { practiceOnly, source: 'library' });
      }
    });
  });

  container.querySelectorAll('.library-preview-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const entry = entries.find((scenario) => scenario.id === button.dataset.scenarioId);
      if (entry) {
        previewScenario(entry);
      }
    });
  });
}

export async function renderLibrary({ scenarioCatalog = [], profile, onPlay } = {}) {
  populateFilterOptions(scenarioCatalog);
  const mentor = await getLibraryMentorContent(profile);
  renderMentorPanel('library-mentor-panel', mentor);

  const sandboxToggle = document.getElementById('library-sandbox-toggle');
  if (sandboxToggle) {
    sandboxToggle.checked = Boolean(profile?.settings?.sandboxEnabled);
  }

  const renderWithFilters = () => {
    const entries = buildLibraryEntries(scenarioCatalog, profile);
    const filtered = filterLibraryEntries(entries, getFiltersFromDom());
    const sorted = sortLibraryEntries(filtered, getFiltersFromDom().sort);
    renderCards(sorted, profile, { onPlay });

    const count = document.getElementById('library-result-count');
    if (count) {
      count.textContent = `${sorted.length} scenario${sorted.length === 1 ? '' : 's'}`;
    }
  };

  document.querySelectorAll('.library-filter').forEach((element) => {
    if (!element.dataset.boundLibraryFilter) {
      element.addEventListener('input', renderWithFilters);
      element.addEventListener('change', renderWithFilters);
      element.dataset.boundLibraryFilter = 'true';
    }
  });

  if (sandboxToggle && !sandboxToggle.dataset.boundLibrarySandbox) {
    sandboxToggle.addEventListener('change', async () => {
      profile.settings.sandboxEnabled = sandboxToggle.checked;
      await setSandboxEnabled(sandboxToggle.checked, { scenarioCatalog });
      renderWithFilters();
    });
    sandboxToggle.dataset.boundLibrarySandbox = 'true';
  }

  renderWithFilters();
}
