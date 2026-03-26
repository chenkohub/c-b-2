const registeredTests = [];

export function test(name, fn) {
  registeredTests.push({ name, fn });
}

export function assert(condition, message = 'Assertion failed.') {
  if (!condition) {
    throw new Error(message);
  }
}

export function equal(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
  }
}

export function deepEqual(actual, expected, message = '') {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(message || `Expected ${expectedJson}, received ${actualJson}.`);
  }
}

export function includes(haystack, needle, message = '') {
  if (!String(haystack).includes(String(needle))) {
    throw new Error(message || `Expected ${JSON.stringify(haystack)} to include ${JSON.stringify(needle)}.`);
  }
}

export function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function renderResultRow(container, status, name, detail = '') {
  const row = document.createElement('div');
  row.className = `test-result test-result-${status}`;
  row.innerHTML = `
    <span class="test-status">${status === 'pass' ? 'PASS' : 'FAIL'}</span>
    <div class="test-copy">
      <strong>${name}</strong>
      ${detail ? `<pre>${detail}</pre>` : ''}
    </div>
  `;
  container.appendChild(row);
}

export async function runRegisteredTests(outputElement) {
  let passed = 0;
  let failed = 0;

  for (const entry of registeredTests) {
    try {
      await entry.fn();
      passed += 1;
      renderResultRow(outputElement, 'pass', entry.name);
    } catch (error) {
      failed += 1;
      renderResultRow(outputElement, 'fail', entry.name, error?.stack || error?.message || String(error));
      console.error(error);
    }
  }

  return {
    total: registeredTests.length,
    passed,
    failed
  };
}
