/**
 * cases.js
 * Lookup helpers and tooltip rendering for case references.
 */

let casesCache = [];
let caseMap = new Map();
let doctrineMap = new Map();
let activeAnchor = null;

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildIndexes(cases = []) {
  caseMap = new Map();
  doctrineMap = new Map();

  cases.forEach((record) => {
    caseMap.set(record.id, record);
    (record.doctrineAreas || []).forEach((area) => {
      const key = normalize(area);
      if (!doctrineMap.has(key)) {
        doctrineMap.set(key, []);
      }
      doctrineMap.get(key).push(record);
    });
  });
}

export async function loadCaseData() {
  if (casesCache.length > 0) {
    return casesCache;
  }

  const response = await fetch('data/cases.json');
  if (!response.ok) {
    throw new Error(`Unable to load cases.json: ${response.status} ${response.statusText}`);
  }

  casesCache = await response.json();
  buildIndexes(casesCache);
  return casesCache;
}

export function getAllCases() {
  return casesCache;
}

export function getCaseById(id) {
  return caseMap.get(id) ?? null;
}

export function getCasesByDoctrine(doctrineArea = '') {
  return doctrineMap.get(normalize(doctrineArea)) ?? [];
}

/**
 * Attempts to match a scenario reference string to a case in cases.json.
 * This is intentionally forgiving because the scenario data mixes full
 * citations, shorthand names, and explanatory parentheticals.
 *
 * @param {string} reference
 * @returns {object|null}
 */
export function findCaseByReference(reference = '') {
  if (!reference || casesCache.length === 0) {
    return null;
  }

  const direct = getCaseById(reference);
  if (direct) {
    return direct;
  }

  const beforeComma = reference.split(',')[0].trim();
  const beforeParen = beforeComma.replace(/\([^)]*\)/g, '').trim();
  const target = normalize(beforeParen || reference);

  if (!target) {
    return null;
  }

  let best = null;
  let bestScore = 0;

  for (const record of casesCache) {
    const candidateName = normalize(record.name);
    const candidateId = normalize(record.id);
    let score = 0;

    if (candidateName === target || candidateId === target) {
      return record;
    }

    if (candidateName.includes(target) || target.includes(candidateName)) {
      score = 3;
    }

    const targetTokens = new Set(target.split(' '));
    const nameTokens = new Set(candidateName.split(' '));
    let overlap = 0;
    targetTokens.forEach((token) => {
      if (nameTokens.has(token)) {
        overlap += 1;
      }
    });

    score += overlap;

    if (score > bestScore) {
      best = record;
      bestScore = score;
    }
  }

  return bestScore >= 2 ? best : null;
}

function positionPopup(popup, anchorElement) {
  const rect = anchorElement.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  const padding = 16;

  let top = rect.bottom + window.scrollY + 10;
  let left = rect.left + window.scrollX;

  if (left + popupRect.width > window.scrollX + window.innerWidth - padding) {
    left = window.scrollX + window.innerWidth - popupRect.width - padding;
  }

  if (top + popupRect.height > window.scrollY + window.innerHeight - padding) {
    top = rect.top + window.scrollY - popupRect.height - 10;
  }

  popup.style.top = `${Math.max(window.scrollY + padding, top)}px`;
  popup.style.left = `${Math.max(window.scrollX + padding, left)}px`;
}

function formatCaseMetadata(record = {}) {
  const parts = [];
  const hasDisplayYear = record.year !== null && record.year !== '' && Number.isFinite(Number(record.year));

  if (hasDisplayYear) {
    parts.push(String(record.year));
  }

  if (typeof record.citation === 'string' && record.citation.trim()) {
    parts.push(record.citation.trim());
  }

  return parts.join(' — ');
}

export function hideCasePopup() {
  const popup = document.getElementById('case-popup');
  if (!popup) {
    return;
  }

  popup.classList.add('hidden');
  popup.innerHTML = '';
  activeAnchor = null;
}

export function renderCasePopup(caseOrReference, anchorElement) {
  const popup = document.getElementById('case-popup');
  if (!popup || !anchorElement) {
    return null;
  }

  const record = typeof caseOrReference === 'string'
    ? (findCaseByReference(caseOrReference) || getCaseById(caseOrReference))
    : caseOrReference;

  if (!record) {
    return null;
  }

  const caseMetadata = formatCaseMetadata(record);

  popup.innerHTML = `
    <button type="button" class="case-popup-close" aria-label="Close case details">&times;</button>
    <h4 class="case-popup-name">${record.name}</h4>
    ${caseMetadata ? `<p class="case-popup-year">${caseMetadata}</p>` : ''}
    <p class="case-popup-holding"><strong>Holding:</strong> ${record.holding}</p>
    <p class="case-popup-significance"><strong>Significance:</strong> ${record.significance}</p>
    ${record.keyQuote ? `<blockquote class="case-popup-quote">“${record.keyQuote}”</blockquote>` : ''}
  `;

  popup.classList.remove('hidden');
  positionPopup(popup, anchorElement);
  activeAnchor = anchorElement;

  const closeBtn = popup.querySelector('.case-popup-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideCasePopup, { once: true });
  }

  return popup;
}

function handleDocumentClick(event) {
  const popup = document.getElementById('case-popup');
  if (!popup || popup.classList.contains('hidden')) {
    return;
  }

  const clickedInsidePopup = popup.contains(event.target);
  const clickedAnchor = activeAnchor && activeAnchor.contains(event.target);

  if (!clickedInsidePopup && !clickedAnchor) {
    hideCasePopup();
  }
}

function handleEscape(event) {
  if (event.key === 'Escape') {
    hideCasePopup();
  }
}

document.addEventListener('click', handleDocumentClick);
document.addEventListener('keydown', handleEscape);
