/**
 * ui.js
 * Presentation-layer helpers: screens, progress, score display, live
 * announcements, dark mode, and accessible modal/focus management.
 */

const BRANCH_META = {
  congress: { label: 'Congress', icon: '🏛️', cssClass: 'branch-congress' },
  president: { label: 'President', icon: '🏢', cssClass: 'branch-president' },
  judiciary: { label: 'Judiciary', icon: '⚖️', cssClass: 'branch-judiciary' }
};

const modalState = new Map();
let announcementTimeout = null;

function getFocusableElements(container) {
  return [...container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => !element.hasAttribute('hidden') && !element.classList.contains('hidden'));
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Accessibility fix: central live-region announcements for score, timer, and modal changes.
export function announce(message, assertive = false) {
  const region = document.getElementById('aria-live-region');
  if (!region) {
    return;
  }

  region.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
  region.textContent = '';

  window.clearTimeout(announcementTimeout);
  window.requestAnimationFrame(() => {
    region.textContent = message;
    announcementTimeout = window.setTimeout(() => {
      region.textContent = '';
    }, 1800);
  });
}

export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((screen) => {
    const isTarget = screen.id === screenId;
    screen.classList.toggle('active', isTarget);
    screen.classList.toggle('hidden', !isTarget);
    screen.setAttribute('aria-hidden', String(!isTarget));
  });
}

export function animateScreenTransition(fromScreenId, toScreenId) {
  if (prefersReducedMotion()) {
    showScreen(toScreenId);
    return Promise.resolve();
  }

  const fromScreen = document.getElementById(fromScreenId);
  const toScreen = document.getElementById(toScreenId);

  if (!fromScreen || !toScreen) {
    showScreen(toScreenId);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      fromScreen.classList.remove('anim-fade-out');
      toScreen.classList.remove('anim-slide-in');
      showScreen(toScreenId);
      resolve();
    };

    toScreen.classList.remove('hidden');
    toScreen.classList.add('active');
    fromScreen.classList.add('anim-fade-out');
    toScreen.classList.add('anim-slide-in');

    window.setTimeout(finish, 450);
  });
}

export function updateBranchIndicator(branch = 'judiciary') {
  const badge = document.getElementById('branch-badge');
  if (!badge) {
    return;
  }

  const meta = BRANCH_META[branch] || BRANCH_META.judiciary;
  Object.values(BRANCH_META).forEach((value) => badge.classList.remove(value.cssClass));
  badge.classList.add(meta.cssClass);
  badge.innerHTML = `<span class="branch-icon" aria-hidden="true">${meta.icon}</span> ${meta.label}`;
  badge.setAttribute('aria-label', `Current branch: ${meta.label}`);

  badge.classList.remove('anim-pulse');
  void badge.offsetWidth;
  badge.classList.add('anim-pulse');
}

export function updateProgressBar(currentIndex = 0, total = 0, history = []) {
  const progressBar = document.getElementById('progress-bar');
  const progressLabel = document.getElementById('progress-label');
  const progressContainer = document.querySelector('.progress-container');

  if (progressLabel) {
    progressLabel.textContent = total > 0
      ? `Crisis ${Math.min(currentIndex + 1, total)} of ${total}`
      : 'No crises loaded';
  }

  if (!progressBar) {
    return;
  }

  progressBar.innerHTML = '';
  for (let index = 0; index < total; index += 1) {
    const segment = document.createElement('span');
    segment.className = 'seg';

    if (index < history.length) {
      const record = history[index];
      const ratio = record.maxPoints > 0 ? record.pointsEarned / record.maxPoints : 0;
      if (ratio >= 0.8) {
        segment.classList.add('seg-correct');
      } else if (ratio >= 0.5) {
        segment.classList.add('seg-partial');
      } else {
        segment.classList.add('seg-incorrect');
      }
    } else if (index === currentIndex) {
      segment.classList.add('seg-current');
    } else {
      segment.classList.add('seg-upcoming');
    }

    segment.setAttribute('aria-hidden', 'true');
    progressBar.appendChild(segment);
  }

  if (progressContainer) {
    progressContainer.setAttribute('aria-valuenow', String(total > 0 ? currentIndex + 1 : 0));
    progressContainer.setAttribute('aria-valuemax', String(total));
  }
}

export function updateScore(points, announceUpdate = true) {
  const scoreValue = document.getElementById('score-value');
  if (!scoreValue) {
    return;
  }

  scoreValue.textContent = String(points);
  scoreValue.classList.remove('score-flash');
  void scoreValue.offsetWidth;
  scoreValue.classList.add('score-flash');

  if (announceUpdate) {
    announce(`Legitimacy Points: ${points}.`);
  }
}

export function updateTimerDisplay(timerState, announceUpdate = false) {
  const timerDisplay = document.getElementById('timer-display');
  const timerTime = document.getElementById('timer-time');
  if (!timerDisplay || !timerTime || !timerState) {
    return;
  }

  timerTime.textContent = timerState.formatted;
  timerDisplay.classList.toggle('warning', timerState.totalSeconds <= 300 && timerState.totalSeconds > 60);
  timerDisplay.classList.toggle('critical', timerState.totalSeconds <= 60 && timerState.totalSeconds > 0);
  timerDisplay.classList.toggle('expired', timerState.totalSeconds === 0);

  if (!announceUpdate) {
    return;
  }

  const shouldAnnounceMinute = timerState.seconds === 0 && timerState.totalSeconds >= 60;
  const shouldAnnounceCritical = timerState.totalSeconds === 30 || timerState.totalSeconds === 10;
  if (shouldAnnounceMinute || shouldAnnounceCritical) {
    announce(`Time remaining: ${timerState.formatted}.`, true);
  }
}

export function flashChoiceResult(buttonElement, outcome = 'incorrect') {
  if (!buttonElement) {
    return Promise.resolve();
  }

  const classMap = {
    correct: 'flash-correct',
    partial: 'flash-partial',
    incorrect: 'flash-incorrect'
  };

  const cssClass = classMap[outcome] || classMap.incorrect;
  buttonElement.classList.add(cssClass);
  buttonElement.setAttribute('data-result-state', outcome);

  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve();
    }, prefersReducedMotion() ? 0 : 450);
  });
}

// Accessibility fix: trap focus inside open modals and support Escape to close.
function handleModalKeydown(event, modalId) {
  const modal = document.getElementById(modalId);
  const state = modalState.get(modalId);
  if (!modal || !state) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    if (typeof state.onEscape === 'function') {
      state.onEscape();
    } else {
      hideModal(modalId);
    }
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusable = getFocusableElements(modal);
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function showModal(modalId, options = {}) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    return;
  }

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const state = {
    previousFocus,
    onEscape: options.onEscape || null,
    closeOnOverlay: options.closeOnOverlay !== false,
    keydownHandler: (event) => handleModalKeydown(event, modalId),
    clickHandler: null
  };

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.addEventListener('keydown', state.keydownHandler);

  state.clickHandler = (event) => {
    if (!state.closeOnOverlay || event.target !== modal) {
      return;
    }
    if (typeof state.onEscape === 'function') {
      state.onEscape();
    } else {
      hideModal(modalId);
    }
  };
  modal.addEventListener('click', state.clickHandler);
  modalState.set(modalId, state);

  const focusTarget = options.initialFocusId
    ? document.getElementById(options.initialFocusId)
    : getFocusableElements(modal)[0];

  if (focusTarget instanceof HTMLElement) {
    focusTarget.focus();
  }
}

export function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  const state = modalState.get(modalId);

  if (!modal) {
    return;
  }

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');

  if (state) {
    modal.removeEventListener('keydown', state.keydownHandler);
    if (state.clickHandler) {
      modal.removeEventListener('click', state.clickHandler);
    }
    if (state.previousFocus instanceof HTMLElement) {
      state.previousFocus.focus();
    }
    modalState.delete(modalId);
  }
}

export function populateAppModal({ title, bodyHtml, confirmText, cancelText, onConfirm, onCancel, closeOnOverlay = true }) {
  const titleEl = document.getElementById('app-modal-title');
  const bodyEl = document.getElementById('app-modal-body');
  const actionsEl = document.getElementById('app-modal-actions');
  const closeBtn = document.getElementById('app-modal-close-btn');

  if (!titleEl || !bodyEl || !actionsEl) {
    return;
  }

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  actionsEl.innerHTML = '';

  if (cancelText) {
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'btn btn-secondary';
    cancelButton.id = 'app-modal-cancel-btn';
    cancelButton.textContent = cancelText;
    cancelButton.addEventListener('click', () => {
      hideModal('app-modal');
      if (typeof onCancel === 'function') {
        onCancel();
      }
    });
    actionsEl.appendChild(cancelButton);
  }

  if (confirmText) {
    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'btn btn-primary';
    confirmButton.id = 'app-modal-confirm-btn';
    confirmButton.textContent = confirmText;
    confirmButton.addEventListener('click', () => {
      hideModal('app-modal');
      if (typeof onConfirm === 'function') {
        onConfirm();
      }
    });
    actionsEl.appendChild(confirmButton);
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      hideModal('app-modal');
      if (typeof onCancel === 'function') {
        onCancel();
      }
    };
  }

  showModal('app-modal', {
    initialFocusId: confirmText ? 'app-modal-confirm-btn' : 'app-modal-cancel-btn',
    closeOnOverlay,
    onEscape: () => {
      hideModal('app-modal');
      if (typeof onCancel === 'function') {
        onCancel();
      }
    }
  });
}

export function initDarkModeToggle() {
  const toggle = document.getElementById('dark-mode-toggle');
  if (!toggle) {
    return;
  }

  const savedPreference = localStorage.getItem('cb-dark-mode');
  const shouldUseDark = savedPreference === null
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
    : savedPreference === 'true';

  document.body.classList.toggle('dark-mode', shouldUseDark);
  toggle.textContent = shouldUseDark ? '☀️' : '🌙';
  toggle.setAttribute('aria-label', shouldUseDark ? 'Switch to light mode' : 'Switch to dark mode');

  toggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('cb-dark-mode', String(isDark));
    toggle.textContent = isDark ? '☀️' : '🌙';
    toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    announce(isDark ? 'Dark mode enabled.' : 'Light mode enabled.');
  });
}

function resolveElement(target) {
  if (!target) {
    return null;
  }
  if (typeof target === 'string') {
    return document.getElementById(target);
  }
  return target;
}

export function showToast(message, options = {}) {
  const stack = document.getElementById('toast-stack');
  if (!stack) {
    return null;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${options.variant || 'info'}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    ${options.title ? `<strong>${options.title}</strong>` : ''}
    <span>${message}</span>
  `;
  stack.appendChild(toast);

  const removeToast = () => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), prefersReducedMotion() ? 0 : 220);
  };

  window.setTimeout(removeToast, Number(options.duration || 2800));
  return toast;
}

export function highlightTopNav(routeName = 'home') {
  document.querySelectorAll('.app-nav-link[data-route]').forEach((element) => {
    const isActive = element.getAttribute('data-route') === routeName;
    element.classList.toggle('is-active', isActive);
    element.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

export function setAppShellContext(routeName = 'home') {
  document.body.dataset.route = routeName;
  document.body.classList.toggle('route-game', routeName === 'game');
  document.body.classList.toggle('route-results', routeName === 'results');
}

export function renderMentorPanel(target, mentor) {
  const container = resolveElement(target);
  if (!container) {
    return;
  }

  if (!mentor) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.classList.add('mentor-panel');
  container.innerHTML = `
    <div class="mentor-avatar-wrap">
      ${mentor.avatar ? `<img src="${mentor.avatar}" alt="${mentor.name}" class="mentor-avatar" />` : ''}
    </div>
    <div class="mentor-copy">
      <span class="mentor-label">Mentor</span>
      <h3 class="mentor-name">${mentor.name}</h3>
      <p class="mentor-line">${mentor.line || ''}</p>
    </div>
  `;
}

export function animateRewardStrip(target = 'results-reward-strip') {
  const element = resolveElement(target);
  if (!element) {
    return;
  }
  element.classList.remove('reward-strip-pop');
  void element.offsetWidth;
  element.classList.add('reward-strip-pop');
}
