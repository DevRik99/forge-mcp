---
name: playwright-master
description: >
  Unified Playwright skill covering E2E automation and AI-powered exploratory testing.
  Use when writing Playwright tests, debugging flakes, setting up CI, handling auth
  patterns, running exploratory testing with ScoutQA, or integrating AI-assisted test
  generation via Playwright MCP. Covers locator strategy, fixtures, network mocking,
  auth patterns, sharding, visual regression, and CI configurations.
---

# Playwright Master

Unified Playwright skill. Covers automated E2E test authoring, execution, debugging,
CI integration, authentication patterns, and AI-powered exploratory testing (ScoutQA).

## When to Use This Skill

- Writing or reviewing Playwright E2E tests
- Debugging flaky tests or CI failures
- Setting up Playwright in a new project or CI pipeline
- Implementing authentication patterns (storageState, multi-user, OAuth, MFA)
- Running exploratory testing with ScoutQA after implementing a feature
- Integrating Playwright MCP for AI-assisted test generation
- Setting up visual regression testing

## When NOT to Use This Skill

| Scenario | Use instead |
|----------|-------------|
| Unit testing | Jest, Vitest, pytest |
| API contract testing | dedicated API testing skill |
| Load / performance testing | k6, Locust, Artillery |
| Mobile native apps | Appium |
| Testing strategy decisions | `qa-master` skill |

---

## Part 1 — Quick Reference

### Commands

| Command | Purpose |
|---------|---------|
| `npm init playwright@latest` | Initialize Playwright |
| `npx playwright test` | Run all tests |
| `npx playwright test --grep @smoke` | Run smoke tests |
| `npx playwright test --project=chromium` | Single browser |
| `npx playwright test --ui` | Debug with UI mode |
| `npx playwright test --debug` | Step through a test |
| `npx playwright show-trace trace.zip` | Inspect trace artifact |
| `npx playwright show-report` | Open HTML report |
| `npx playwright test --workers=1` | Serial execution (flake triage) |

### Core defaults

- Locator priority: `getByRole` → `getByLabel` / `getByText` → `getByTestId` (last resort)
- Never use `page.locator('.css-class')` — CSS selectors break on refactor
- No `page.waitForTimeout()` / `sleep()` — use Playwright auto-wait and web-first assertions
- Tests must be independent: run alone, in parallel, in any order
- Retries are a debugging tool, not a fix — treat rerun-pass as a failure signal

---

## Part 2 — Authoring Rules

### Locator Strategy

```typescript
// 1. Role locators (preferred — tests from user perspective)
await page.getByRole('button', { name: 'Sign in' }).click();
await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com');
await page.getByRole('heading', { name: 'Dashboard' }).toBeVisible();
await page.getByRole('checkbox', { name: 'Email notifications' }).check();
await page.getByRole('combobox', { name: 'Language' }).selectOption('en');

// 2. Label / text locators
await page.getByLabel('Email').fill('user@example.com');
await page.getByText('Welcome back').toBeVisible();

// 3. Test IDs (fallback — only when role/label not possible)
await page.getByTestId('user-avatar-dropdown').click();
```

**When test IDs are acceptable:**
- Element has no accessible role or label
- Multiple identical elements need distinction
- Dynamic content without stable text

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    // Seed state — per test, not shared mutable state
    await page.goto('/catalog');
  });

  test('user can complete purchase', async ({ page }) => {
    // Arrange
    await page.getByLabel('Quantity').fill('1');

    // Act
    await page.getByRole('button', { name: 'Buy' }).click();

    // Assert
    await expect(page.getByText('Order confirmed')).toBeVisible();
  });
});
```

### Flake Control

- Replace brittle selectors with semantic locators before anything else
- Capture trace/screenshot/video on failure — always (`trace: 'on-first-retry'` minimum)
- Never use `force: true` to bypass visibility checks — fix the underlying state
- If it only fails in CI: look for concurrency, cold-start, CPU starvation, environment differences
- If it only passes on retry: it is broken — find the root cause, do not increase retries

---

## Part 3 — Network Mocking

```typescript
// Mock a specific endpoint
await page.route('**/api/feature-flags', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ newFeature: true }),
  });
});

// Block analytics (avoid noise)
await page.route('**/api/analytics/**', route => route.abort());

// Modify request headers
await page.route('**/api/**', route => {
  route.continue({
    headers: {
      ...route.request().headers(),
      'X-Test-Mode': 'true',
    },
  });
});

// WebSocket mocking (v1.49+)
await page.routeWebSocket('wss://api.example.com/ws', ws => {
  ws.onMessage(message => {
    if (message === 'ping') ws.send('pong');
  });
});
```

**Rule:** mock third-party dependencies at network boundaries.
Never mock internal modules to make an E2E test work — that is a unit test in disguise.

---

## Part 4 — Authentication Patterns

### StorageState (recommended default)

Log in once, reuse across all tests. Zero re-authentication overhead.

```typescript
// auth.setup.ts
import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.TEST_USER_EMAIL!);
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: authFile });
});
```

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { storageState: '.auth/user.json' },
    },
  ],
});
```

### Multi-User Roles

```typescript
// Multiple auth files for multiple roles
const users = [
  { name: 'admin', email: process.env.TEST_ADMIN_EMAIL!, file: '.auth/admin.json' },
  { name: 'user', email: process.env.TEST_USER_EMAIL!, file: '.auth/user.json' },
];

for (const user of users) {
  setup(`authenticate as ${user.name}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
    // ...
    await page.context().storageState({ path: user.file });
  });
}
```

### Pattern Decision Matrix

| Scenario | Pattern |
|----------|---------|
| Single user, simple login | StorageState + project deps |
| Multiple roles | Multiple auth files + projects |
| OAuth / SSO | API-based bypass (skip OAuth UI) |
| MFA (TOTP) | `otplib` to generate codes |
| Token refresh testing | `page.route()` to intercept refresh |
| Session expiry testing | `context.clearCookies()` |

### Security rules for test credentials

- `.auth/` directory in `.gitignore` — auth state files contain session tokens
- Credentials in `.env.test` (git-ignored) or CI secrets — never hardcoded
- Test accounts use separate database/tenant from production
- Test accounts have minimal permissions (principle of least privilege)

---

## Part 5 — Fixtures

### Database Seeding Fixture

```typescript
// fixtures/database.fixture.ts
import { test as base } from '@playwright/test';
import { prisma } from '../lib/prisma';

export const test = base.extend({
  seedUser: async ({}, use) => {
    const user = await prisma.user.create({
      data: { email: `test-${Date.now()}@example.com` },
    });
    await use({ id: user.id, email: user.email });
    await prisma.user.delete({ where: { id: user.id } });
  },
});
```

### Auth Fixture (reusable)

```typescript
// fixtures/auth.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: '.auth/user.json' });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: '.auth/admin.json' });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
export { expect } from '@playwright/test';
```

---

## Part 6 — Accessibility Testing

```typescript
import AxeBuilder from '@axe-core/playwright';

test('page has no accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('form is WCAG 2.1 AA compliant', async ({ page }) => {
  await page.goto('/signup');
  const results = await new AxeBuilder({ page })
    .include('form')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

### Aria Snapshots (v1.49+)

```typescript
test('navigation structure is correct', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation');
  await expect(nav).toMatchAriaSnapshot(`
    - navigation:
      - /children:
        - link "Home" /url: "/"
        - link "About" /url: "/about"
  `);
});
```

---

## Part 7 — Visual Regression

| Tool | Best for | Cost |
|------|----------|------|
| Playwright native (`toHaveScreenshot`) | Simple projects, single OS | Free |
| Percy | Staging, cross-browser, AI diff | $199+/mo |
| Chromatic | Component libraries, Storybook | Paid |
| Lost Pixel | Open source alternative | Free/Paid |

**Note:** Playwright native screenshots differ across OS (Mac vs Linux CI).
Use Percy or Chromatic for cross-platform visual testing.

```typescript
// Native (single OS only)
test('homepage matches snapshot', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png', { maxDiffPixels: 100 });
});
```

---

## Part 8 — CI Configuration

### playwright.config.ts for CI

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ...(process.env.CI ? [['github'] as const] : []),
    // Fail CI when any test passes only on retry (flake detection)
    ['./playwright/fail-on-flaky-reporter.js'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

### GitHub Actions (sharded)

```yaml
# .github/workflows/playwright.yml
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test --shard=${{ matrix.shard }}/${{ strategy.job-total }}
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: blob-report-${{ matrix.shard }}
          path: blob-report/
          retention-days: 1

  merge-reports:
    if: ${{ !cancelled() }}
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'npm' }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

### CI Posture

- PRs: smoke gate only (`--grep @smoke`) — fast feedback
- Scheduled / merge to main: full regression with sharding
- Always upload artifacts (`trace`, `video`, `screenshot`) — non-negotiable

---

## Part 9 — Execution Preflight

Run before any expensive E2E batch to prevent avoidable failures.

### Preflight Checklist

1. **Repository shape** — confirm working directory and spec paths exist before running
2. **Port hygiene** — check and clear stale dev server port (`lsof -i :3001`)
3. **Command validity** — validate CLI flags for current Playwright version
4. **Artifact paths** — confirm result dirs exist before reading

### Mandatory Sandbox Decisions

Before running in constrained environments (CI containers, sandboxed terminals):

- Bind host/port: confirm `127.0.0.1` vs `0.0.0.0`, verify port is free
- Escalation path: if `EPERM`/`EACCES`, escalate immediately — do not retry
- Long-flow timeouts: set explicit per-test timeout for API-heavy flows
- Build lock hygiene: clear stale `.next/lock`, terminate stale build PIDs

### Triage Sequence (fastest signal first)

1. Reproduce one failing test with `--workers=1`
2. Capture trace/video/screenshot for that single failure
3. Fix determinism root cause
4. Re-run targeted suite
5. Only then run broad regression

### Failure Patterns That Are Environment, Not Product Bugs

- `EADDRINUSE` on Playwright web server port
- Missing spec/result paths from stale assumptions
- Shell glob expansion failures for bracketed route segments

---

## Part 10 — AI-Powered Exploratory Testing (ScoutQA)

Use ScoutQA for autonomous exploratory testing — especially after implementing features,
before a release, or for accessibility audits.

### When to use ScoutQA vs Playwright tests

| Need | Use |
|------|-----|
| Verifying a specific user flow deterministically | Playwright test |
| Discovering unknown issues in a new feature | ScoutQA |
| Accessibility audit on a page or flow | ScoutQA |
| Post-deployment smoke check (broad) | ScoutQA |
| Regression test that must pass in CI | Playwright test |

### Running ScoutQA

```bash
# Install
npm i -g @scoutqa/cli@latest

# Basic test
scoutqa --url "https://example.com" --prompt "Your test instructions"

# Local app
scoutqa --url "http://localhost:3000" --prompt "Test the registration form"

# Set Bash tool timeout to 5000ms — captures execution ID in first 5 seconds,
# process continues running remotely in background
```

### Effective Prompts

Describe **what to explore and verify**, not step-by-step instructions.
ScoutQA determines how to test autonomously.

```bash
# User registration
scoutqa --url "$URL" --prompt "
Explore the user registration flow. Test form validation edge cases,
verify error handling, and check accessibility compliance.
"

# E-commerce checkout
scoutqa --url "$URL" --prompt "
Test the checkout flow. Verify pricing calculations, cart persistence,
payment options, and mobile responsiveness.
"

# Post-deployment smoke test
scoutqa --url "$URL" --prompt "
Smoke test: verify critical functionality works after deployment.
Check homepage, navigation, login/logout, and key user flows.
"

# Accessibility audit
scoutqa --url "$URL" --prompt "
Audit accessibility: WCAG 2.1 AA compliance, keyboard navigation,
screen reader support, color contrast, and semantic HTML.
"
```

### Parallel exploratory tests

Make multiple Bash tool calls in a single message (each with `timeout: 5000`):

```bash
# Authentication & security
scoutqa --url "$URL" --prompt "Explore authentication: login/logout, session handling, password reset, security edge cases."

# Core features (parallel)
scoutqa --url "$URL" --prompt "Test dashboard and main workflows. CRUD operations, search, data loading."

# Accessibility (parallel)
scoutqa --url "$URL" --prompt "Conduct accessibility audit: WCAG compliance, keyboard navigation, screen reader support."
```

### ScoutQA Commands

| Command | When |
|---------|------|
| `scoutqa --url --prompt` | Start new test |
| `scoutqa list-issues --execution-id <id>` | Find issue IDs from an execution |
| `scoutqa issue-verify --issue-id <id>` | Verify a known issue is fixed |
| `scoutqa send-message --execution-id <id> --prompt` | Unstick a running agent |
| `scoutqa get-execution --execution-id <id>` | Fetch results via CLI |
| `scoutqa auth login` | Re-authenticate (if token expired) |

### Presenting ScoutQA Results

```markdown
**ScoutQA Test Results**

Execution ID: `ex_abc123`
Full report: https://app.scoutqa.ai/t/ex_abc123

**Issues Found:**

[High] Accessibility: Missing alt text on logo image
- Impact: Screen readers cannot describe the logo
- Location: Header navigation

[Medium] Usability: Submit button not visible on mobile
- Impact: Users cannot complete form on mobile
- Location: Contact form, bottom of page
```

---

## Part 11 — AI Test Generation (Playwright MCP)

Playwright MCP bridges LLMs with Playwright via the browser's accessibility tree.
Faster than screenshot-based automation, no vision model required.

### Setup (Codex Desktop or MCP-capable IDE)

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

### Workflow

```
1. Describe the flow in natural language
2. MCP explores the accessibility tree
3. MCP scaffolds a Playwright test
4. Human reviews assertions and hardens locators
5. Add to test suite
```

### Rules for AI-generated tests

- Always review assertions — AI scaffolds structure, humans verify correctness
- Prefer the accessibility-tree-derived locators MCP produces (they are semantic by default)
- Never accept auto-healing that weakens an assertion
- Security-sensitive flows require manual review before committing AI-generated tests

---

## Playwright vs Cypress (2025 Decision Guide)

| Factor | Playwright | Cypress |
|--------|------------|---------|
| Cross-browser | Chromium, Firefox, WebKit | Chrome, Firefox, Edge (no Safari) |
| Parallelization | Native, free | Requires Cypress Cloud |
| Language support | JS/TS, Python, Java, C# | JS/TS only |
| Cross-origin | Seamless | Requires workarounds |
| AI/MCP integration | Official MCP server | Limited |
| Learning curve | Moderate | Easy |
| **Choose when** | Enterprise, multi-browser, CI scale | Small team, JS-only, DX priority |

---

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|---------|
| Flaky test | Open trace, identify selector ambiguity / missing wait / state leakage |
| Only fails in CI | Check concurrency, cold-start, CPU starvation, env differences |
| `EADDRINUSE` | Clear stale dev server port before run |
| Slow tests | Check Speedboard tab in HTML report; shard by test file |
| `command not found: scoutqa` | `npm i -g @scoutqa/cli@latest` |
| ScoutQA auth expired | `scoutqa auth login` |
| ScoutQA agent stuck | `scoutqa send-message --execution-id <id> --prompt "..."` |
