import { initRouter, navigate, registerScreen, __testHooks } from '../router.js';
import { test, assert, equal, wait } from './test-utils.js';

function mountRouterShell() {
  const root = document.getElementById('fixture-root');
  root.innerHTML = `
    <nav>
      <button class="app-nav-link" data-route="home" aria-current="false">Home</button>
      <button class="app-nav-link" data-route="library" aria-current="false">Library</button>
      <button class="app-nav-link" data-route="dashboard" aria-current="false">Dashboard</button>
      <button class="app-nav-link" data-route="codex" aria-current="false">Codex</button>
    </nav>
    <section id="landing-screen" class="screen"></section>
    <section id="library-screen" class="screen hidden"></section>
    <section id="dashboard-screen" class="screen hidden"></section>
    <section id="codex-screen" class="screen hidden"></section>
  `;
}

function resetRouterEnvironment() {
  __testHooks.resetForTests();
  mountRouterShell();
  registerScreen('landing-screen', 'home');
  registerScreen('library-screen', 'library');
  registerScreen('dashboard-screen', 'dashboard');
  registerScreen('codex-screen', 'codex');
}

test('Route changes show the correct screens.', async () => {
  resetRouterEnvironment();
  window.location.hash = '#/home';
  initRouter();
  await wait(20);

  navigate('library');
  await wait(20);
  assert(document.getElementById('library-screen').classList.contains('active'), 'Library screen should be active.');

  navigate('dashboard');
  await wait(20);
  assert(document.getElementById('dashboard-screen').classList.contains('active'), 'Dashboard screen should be active.');
  equal(document.querySelector('[data-route="dashboard"]').getAttribute('aria-current'), 'page');
});

test('Back and forward navigation works with the hash router.', async () => {
  resetRouterEnvironment();
  window.location.hash = '#/home';
  initRouter();
  await wait(20);

  navigate('dashboard');
  await wait(20);
  navigate('codex');
  await wait(20);

  window.history.back();
  await wait(80);
  assert(document.getElementById('dashboard-screen').classList.contains('active'), 'Dashboard screen should be restored on back navigation.');

  window.history.forward();
  await wait(80);
  assert(document.getElementById('codex-screen').classList.contains('active'), 'Codex screen should be restored on forward navigation.');
});
