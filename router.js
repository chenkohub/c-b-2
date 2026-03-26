/**
 * router.js
 * Minimal hash router for the static PWA.
 */

const screenRegistry = new Map();
let routerInitialized = false;
let lastRoute = null;

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
}

function parseHash(hashValue = '') {
  const rawHash = hashValue || window.location.hash || '#/home';
  const normalized = rawHash.startsWith('#/') ? rawHash.slice(2) : rawHash.replace(/^#/, '') || 'home';
  const [routePart, queryString = ''] = normalized.split('?');
  const routeName = (routePart || 'home').replace(/^\//, '') || 'home';
  const params = {};
  const searchParams = new URLSearchParams(queryString);
  searchParams.forEach((value, key) => {
    params[key] = safeDecode(value);
  });

  return {
    routeName,
    params,
    hash: buildHash(routeName, params)
  };
}

function buildHash(routeName, params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return `#/${routeName}${query ? `?${query}` : ''}`;
}

function activateRegisteredScreen(routeName) {
  const targetScreenId = screenRegistry.get(routeName);
  if (!targetScreenId) {
    return;
  }

  document.querySelectorAll('.screen').forEach((screen) => {
    const isTarget = screen.id === targetScreenId;
    screen.classList.toggle('active', isTarget);
    screen.classList.toggle('hidden', !isTarget);
    screen.setAttribute('aria-hidden', String(!isTarget));
  });
}

function highlightNav(routeName) {
  document.querySelectorAll('[data-route]').forEach((element) => {
    const isActive = element.getAttribute('data-route') === routeName;
    element.classList.toggle('is-active', isActive);
    if (element.hasAttribute('aria-current')) {
      element.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
  });
}

function emitRouteChange(route) {
  document.dispatchEvent(new CustomEvent('cb:routechange', {
    detail: route
  }));
}

function handleHashChange() {
  const route = parseHash();
  lastRoute = route;
  activateRegisteredScreen(route.routeName);
  highlightNav(route.routeName);
  emitRouteChange(route);
}

export function registerScreen(screenId, routeName) {
  if (!screenId || !routeName) {
    return;
  }
  screenRegistry.set(routeName, screenId);
}

export function navigate(routeName, params = {}) {
  const targetHash = buildHash(routeName, params);
  if (window.location.hash === targetHash) {
    handleHashChange();
    return;
  }
  window.location.hash = targetHash;
}

export function getCurrentRoute() {
  return lastRoute || parseHash();
}

export function initRouter() {
  if (routerInitialized) {
    handleHashChange();
    return getCurrentRoute();
  }

  routerInitialized = true;
  window.addEventListener('hashchange', handleHashChange);

  if (!window.location.hash) {
    window.location.hash = '#/home';
  }

  handleHashChange();
  return getCurrentRoute();
}

export const __testHooks = {
  buildHash,
  parseHash,
  resetForTests() {
    lastRoute = null;
    screenRegistry.clear();
    routerInitialized = false;
    window.removeEventListener('hashchange', handleHashChange);
  }
};
