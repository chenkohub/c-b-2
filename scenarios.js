/**
 * scenarios.js
 * Scenario-data loading plus DOM rendering for gameplay, feedback, and
 * end-of-session summaries.
 */

import { loadCaseData, findCaseByReference, renderCasePopup } from './cases.js';
import { showModal, announce } from './ui.js';

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text ?? '';
  }
}

function setHtml(id, html) {
  const element = document.getElementById(id);
  if (element) {
    element.innerHTML = html ?? '';
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRichText(text = '') {
  return String(text)
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`)
    .join('');
}

function badgeClassForDifficulty(difficulty = 'medium') {
  return ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
}

// Accessibility fix: outcome badges pair color with icons and text labels.
function outcomeBadge(outcome = 'incorrect') {
  if (outcome === 'correct') {
    return '<span class="result-pill result-pill-correct">✅ Correct</span>';
  }
  if (outcome === 'partial') {
    return '<span class="result-pill result-pill-partial">⚠️ Partial</span>';
  }
  return '<span class="result-pill result-pill-incorrect">❌ Incorrect</span>';
}

function clearStepContainers() {
  document.getElementById('choices-container')?.classList.add('hidden');
  document.getElementById('argument-builder-container')?.classList.add('hidden');
  document.getElementById('counter-argument-container')?.classList.add('hidden');
}

function renderChoiceButtons(container, choices, onChoiceCallback, buttonClass = 'choice-btn') {
  container.innerHTML = '';
  choices.forEach((choice, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = buttonClass;
    button.dataset.choiceIndex = String(index);
    button.setAttribute('aria-label', `Choice ${index + 1}: ${choice.text}`);
    button.innerHTML = `
      <span class="choice-index" aria-hidden="true">${String.fromCharCode(65 + index)}</span>
      <span class="choice-text">${escapeHtml(choice.text)}</span>
    `;
    button.addEventListener('click', () => onChoiceCallback(index, button));
    container.appendChild(button);
  });
}

async function wireCaseLinks(root) {
  try {
    await loadCaseData();
  } catch (_error) {
    return;
  }

  root.querySelectorAll('.case-link').forEach((element) => {
    const openPopup = () => {
      const reference = element.getAttribute('data-case-reference') || element.textContent || '';
      const record = findCaseByReference(reference);
      if (record) {
        renderCasePopup(record, element);
      }
    };

    element.addEventListener('click', openPopup);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPopup();
      }
    });
  });
}

function renderCaseReferenceList(caseReferences = []) {
  if (!Array.isArray(caseReferences) || caseReferences.length === 0) {
    return '';
  }

  return `
    <section class="feedback-section feedback-cases">
      <h4 class="feedback-subheading">Key Cases</h4>
      <ul class="case-reference-list">
        ${caseReferences
          .map((reference) => `
            <li>
              <button type="button" class="case-link case-reference-button" data-case-reference="${escapeHtml(reference)}">
                ${escapeHtml(reference)}
              </button>
            </li>
          `)
          .join('')}
      </ul>
    </section>
  `;
}

export async function loadScenarioData() {
  const response = await fetch('data/scenarios.json');
  if (!response.ok) {
    throw new Error(`Unable to load scenarios.json: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : (Array.isArray(data.scenarios) ? data.scenarios : []);
}

export function renderScenario(scenario, stepIndex, onChoiceCallback) {
  const steps = Array.isArray(scenario.steps) ? scenario.steps : [];
  const step = steps[stepIndex];
  if (!step) {
    return;
  }

  setText('scenario-title', scenario.title);
  setHtml('scenario-description', formatRichText(scenario.description));
  setText('scenario-prompt', step.prompt || '');
  setText('doctrine-tag', scenario.doctrineArea || '');

  const difficultyBadge = document.getElementById('difficulty-badge');
  if (difficultyBadge) {
    difficultyBadge.textContent = scenario.difficulty || 'medium';
    difficultyBadge.className = `difficulty-badge ${badgeClassForDifficulty(scenario.difficulty)}`;
  }

  const stepIndicator = document.getElementById('step-indicator');
  if (stepIndicator) {
    if (steps.length > 1) {
      stepIndicator.classList.remove('hidden');
      stepIndicator.innerHTML = `<span>Step ${stepIndex + 1} of ${steps.length}</span>`;
    } else {
      stepIndicator.classList.add('hidden');
      stepIndicator.innerHTML = '';
    }
  }

  clearStepContainers();
  const choicesContainer = document.getElementById('choices-container');
  if (!choicesContainer) {
    return;
  }

  choicesContainer.classList.remove('hidden');
  renderChoiceButtons(choicesContainer, step.choices || [], onChoiceCallback);
}

export function renderCounterArgument(step, onChoiceCallback) {
  clearStepContainers();
  setText('scenario-prompt', step.prompt || 'Counter-argument');

  const container = document.getElementById('counter-argument-container');
  if (!container) {
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="counter-argument-card">
      ${step.counterText ? `<p class="counter-text">${escapeHtml(step.counterText)}</p>` : ''}
      <div id="counter-choice-list" class="choices-container"></div>
    </div>
  `;

  const list = document.getElementById('counter-choice-list');
  if (!list) {
    return;
  }

  renderChoiceButtons(list, step.choices || [], onChoiceCallback, 'choice-btn counter-choice-btn');
}

export function renderArgumentBuilder(step, onSubmitCallback) {
  clearStepContainers();
  setText('scenario-prompt', step.prompt || 'Build your argument.');

  const container = document.getElementById('argument-builder-container');
  if (!container) {
    return;
  }

  const options = Array.isArray(step.argumentOptions) ? step.argumentOptions : [];
  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="argument-builder">
      <section class="argument-builder-context" aria-labelledby="argument-builder-heading">
        <h3 id="argument-builder-heading" class="builder-section-title">Scenario Context</h3>
        <p>${escapeHtml(step.contextText || 'Select the strongest constitutional arguments. Weak arguments cost points.')}</p>
      </section>
      <section class="argument-builder-options-panel" aria-labelledby="argument-options-heading">
        <h3 id="argument-options-heading" class="builder-section-title">Select Supporting Arguments</h3>
        <p class="builder-instructions">Choose every argument you want to include. Strong arguments add points; weak arguments subtract points.</p>
        <div id="argument-option-list" class="argument-builder-options"></div>
        <button type="button" id="submit-args-btn" class="btn btn-primary btn-submit-args" disabled>
          Evaluate Arguments
        </button>
      </section>
    </div>
  `;

  const list = document.getElementById('argument-option-list');
  const submitButton = document.getElementById('submit-args-btn');
  const selectedIndexes = new Set();

  if (!list || !submitButton) {
    return;
  }

  options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'argument-option';
    label.innerHTML = `
      <input type="checkbox" data-argument-index="${index}" aria-label="Select argument ${index + 1}" />
      <span>${escapeHtml(option.text)}</span>
    `;

    const input = label.querySelector('input');
    input?.addEventListener('change', () => {
      if (input.checked) {
        selectedIndexes.add(index);
        label.classList.add('selected');
      } else {
        selectedIndexes.delete(index);
        label.classList.remove('selected');
      }
      submitButton.disabled = selectedIndexes.size === 0;
    });

    list.appendChild(label);
  });

  submitButton.addEventListener('click', () => {
    const selectedOptions = [...selectedIndexes]
      .sort((a, b) => a - b)
      .map((index) => options[index]);

    const rawPoints = selectedOptions.reduce((sum, option) => sum + Number(option.points || 0), 0);
    const feedbackItems = selectedOptions.map((option) => ({
      id: option.id,
      text: option.text,
      points: Number(option.points || 0),
      feedback: option.feedback,
      isStrong: Boolean(option.isStrong)
    }));

    container.innerHTML = `
      <div class="argument-builder-results">
        <h4>Argument Review</h4>
        <p class="arg-total-score">Raw score before difficulty: ${rawPoints >= 0 ? '+' : ''}${rawPoints}</p>
        ${feedbackItems.map((item) => `
          <div class="arg-result ${item.isStrong ? 'arg-result-strong' : 'arg-result-weak'}">
            <div class="arg-result-header">
              <span aria-hidden="true">${item.isStrong ? '✅' : '⚠️'}</span>
              <strong>${escapeHtml(item.text)}</strong>
              <span class="arg-result-points">${item.points >= 0 ? '+' : ''}${item.points}</span>
            </div>
            <p class="arg-result-feedback">${escapeHtml(item.feedback || '')}</p>
          </div>
        `).join('')}
        <button type="button" id="argument-results-continue-btn" class="btn btn-primary btn-continue">
          Apply Score & Continue
        </button>
      </div>
    `;

    document.getElementById('argument-results-continue-btn')?.addEventListener('click', () => {
      onSubmitCallback({ rawPoints, feedbackItems });
    });
  }, { once: true });
}

export async function renderFeedback({ scenario, choicesMade, pointsEarned, maxPoints, onContinue }) {
  const feedbackContent = document.getElementById('feedback-content');
  const closeButton = document.getElementById('feedback-close-btn');
  if (!feedbackContent) {
    return;
  }

  const percentage = maxPoints > 0 ? Math.round((pointsEarned / maxPoints) * 100) : 0;
  const performanceLabel = percentage >= 80
    ? { icon: '✅', title: 'Strong performance', cssClass: 'review-correct' }
    : percentage >= 50
      ? { icon: '⚠️', title: 'Partial credit earned', cssClass: 'review-partial' }
      : { icon: '❌', title: 'Needs review', cssClass: 'review-incorrect' };

  const choiceRows = (choicesMade || []).map((choice) => `
    <div class="choice-review-row ${choice.outcome === 'correct' ? 'review-correct' : choice.outcome === 'partial' ? 'review-partial' : 'review-incorrect'}">
      <div class="choice-review-header">
        <span class="choice-review-step">Step ${choice.stepNumber}</span>
        ${outcomeBadge(choice.outcome)}
        <span class="choice-review-points">${choice.points >= 0 ? '+' : ''}${choice.points} pts</span>
      </div>
      <p class="choice-review-text">${escapeHtml(choice.choiceText)}</p>
      <p class="choice-review-explanation">${escapeHtml(choice.explanation)}</p>
    </div>
  `).join('');

  feedbackContent.innerHTML = `
    <div class="result-banner ${performanceLabel.cssClass}">
      <h3 id="feedback-title">${performanceLabel.icon} ${performanceLabel.title}</h3>
      <p>You earned <strong>${pointsEarned}</strong> of <strong>${maxPoints}</strong> available points in this crisis.</p>
    </div>
    <section class="feedback-section feedback-explanation">
      <h4 class="feedback-subheading">Doctrinal Explanation</h4>
      <div class="feedback-explanation-text">${formatRichText(scenario.overallExplanation || 'No explanation provided.')}</div>
    </section>
    ${renderCaseReferenceList(scenario.caseReferences || [])}
    <details class="feedback-collapsible" open>
      <summary class="feedback-collapsible-header">📋 Step-by-step review</summary>
      <div class="feedback-collapsible-body">${choiceRows}</div>
    </details>
    ${scenario.professorNote ? `
      <details class="feedback-collapsible professor-note">
        <summary class="feedback-collapsible-header">🎓 Professor's Note</summary>
        <div class="feedback-collapsible-body">${formatRichText(scenario.professorNote)}</div>
      </details>
    ` : ''}
    ${scenario.otherSide ? `
      <details class="feedback-collapsible other-side">
        <summary class="feedback-collapsible-header">⚔️ Argue the Other Side</summary>
        <div class="feedback-collapsible-body">${formatRichText(scenario.otherSide)}</div>
      </details>
    ` : ''}
    <button type="button" id="feedback-continue-btn" class="btn btn-primary btn-continue">Continue</button>
  `;

  await wireCaseLinks(feedbackContent);

  document.getElementById('feedback-continue-btn')?.addEventListener('click', onContinue, { once: true });
  if (closeButton) {
    closeButton.onclick = onContinue;
  }

  showModal('feedback-modal', {
    initialFocusId: 'feedback-continue-btn',
    onEscape: onContinue
  });
  announce(`Feedback opened for ${scenario.title}.`);
}

export function renderEndGame(results) {
  setText('end-total-score', String(results.totalPoints));
  setText('end-max-score', String(results.maxPoints));
  setText('end-percentage', `${results.percentage}%`);
  setText('end-grade-description', results.grade.description);

  const gradeBadge = document.getElementById('end-grade-badge');
  if (gradeBadge) {
    gradeBadge.innerHTML = `
      <div class="grade-ring">
        <div class="grade-ring-inner">
          <span class="grade-letter">${escapeHtml(results.grade.letter)}</span>
          <span class="grade-title-text">${escapeHtml(results.grade.title)}</span>
        </div>
      </div>
    `;
  }

  const breakdown = document.getElementById('end-breakdown');
  if (breakdown) {
    breakdown.innerHTML = results.scenarioResults
      .map((scenario) => {
        const percentage = scenario.maxPoints > 0
          ? Math.round((scenario.pointsEarned / scenario.maxPoints) * 100)
          : 0;
        const performanceClass = percentage >= 80
          ? 'review-correct'
          : percentage >= 50
            ? 'review-partial'
            : 'review-incorrect';

        return `
          <article class="breakdown-card ${performanceClass}">
            <div class="breakdown-card-header">
              <h4>${escapeHtml(scenario.title)}</h4>
              <span class="breakdown-card-score">${scenario.pointsEarned}/${scenario.maxPoints}</span>
            </div>
            <p class="breakdown-card-meta">${escapeHtml(scenario.branch)} · ${escapeHtml(scenario.doctrineArea || 'Uncategorized')}</p>
            <p class="breakdown-card-meta">${percentage}%</p>
          </article>
        `;
      })
      .join('');
  }
}

export function renderExamReview(scenarioResults = []) {
  const container = document.getElementById('exam-review-container');
  if (!container) {
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = `
    <h3 class="review-answers-heading">📚 Exam Prep Review</h3>
    <p class="exam-review-intro">Exam Prep mode defers explanations until the end. Expand each crisis to review your answers, outcomes, and doctrinal notes.</p>
    ${scenarioResults.map((scenario, index) => `
      <details class="exam-review-scenario feedback-collapsible">
        <summary class="exam-review-summary">
          <span class="exam-review-number">#${index + 1}</span>
          <span class="exam-review-title">${escapeHtml(scenario.title)}</span>
          <span class="exam-review-score">${scenario.pointsEarned}/${scenario.maxPoints}</span>
        </summary>
        <div class="exam-review-body feedback-collapsible-body">
          ${(scenario.choicesMade || []).map((choice) => `
            <div class="choice-review-row ${choice.outcome === 'correct' ? 'review-correct' : choice.outcome === 'partial' ? 'review-partial' : 'review-incorrect'}">
              <div class="choice-review-header">
                <span class="choice-review-step">Step ${choice.stepNumber}</span>
                ${outcomeBadge(choice.outcome)}
                <span class="choice-review-points">${choice.points >= 0 ? '+' : ''}${choice.points} pts</span>
              </div>
              <p class="choice-review-text">${escapeHtml(choice.choiceText)}</p>
              <p class="choice-review-explanation">${escapeHtml(choice.explanation)}</p>
            </div>
          `).join('')}
          ${scenario.overallExplanation ? `
            <div class="exam-review-explanation">
              <h5>Doctrinal Explanation</h5>
              ${formatRichText(scenario.overallExplanation)}
            </div>
          ` : ''}
        </div>
      </details>
    `).join('')}
  `;
}
