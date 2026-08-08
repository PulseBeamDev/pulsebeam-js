import tseslint from 'typescript-eslint';

// Robustness guardrail: the QoE E2E suite must never use fixed sleeps or assert on
// exact media metrics — those are the top causes of WebRTC-test flake. This lint
// makes the rules mechanical (fail CI/review), not a matter of discipline.
export default tseslint.config({
  // Scoped to the new QoE infrastructure. The legacy DOM-driven specs
  // (connection/edge-cases/…) still use waitForTimeout and are pending migration;
  // widen this glob to `tests/**/*.ts` once they are converted.
  files: ['tests/specs/qoe.*.spec.ts', 'tests/utils/**/*.ts', 'tests/fixtures/**/*.ts'],
  languageOptions: {
    parser: tseslint.parser,
  },
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.property.name='waitForTimeout']",
        message:
          'No fixed sleeps. Use waitForStats()/waitFor()/expect.poll() to wait on a condition, not page.waitForTimeout().',
      },
      {
        selector: "CallExpression[callee.name='sleep']",
        message:
          'No fixed sleeps. Use waitForStats()/waitFor()/expect.poll() to wait on a condition.',
      },
      {
        selector: "AwaitExpression > CallExpression[callee.name='setTimeout']",
        message:
          'No promise-wrapped setTimeout sleeps. Use waitForStats()/waitFor()/expect.poll().',
      },
      {
        // The form the rule above misses: `await new Promise(r => setTimeout(r, n))`
        // is a NewExpression, not a CallExpression, so it slipped past the guardrail
        // and put two 10s sleeps into qoe.e2ee.spec.ts unnoticed.
        selector: "NewExpression[callee.name='Promise'] CallExpression[callee.name='setTimeout']",
        message:
          'No promise-wrapped setTimeout sleeps (`await new Promise(r => setTimeout(r, n))`). ' +
          'Use waitForStats()/waitFor()/expect.poll() to wait on a condition.',
      },
    ],
  },
});
