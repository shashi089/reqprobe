<div align="center">

# reqprobe

**The open-source TypeScript API testing framework — code-first, Git-native, OpenAPI-aware.**

[![npm](https://img.shields.io/npm/v/req-probe?color=0ea5e9&label=npm)](https://www.npmjs.com/package/req-probe)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)](https://www.typescriptlang.org)

Write REST API tests in TypeScript. Validate responses against your OpenAPI spec automatically. Run from the CLI. Ship with confidence.

</div>

---

## What is reqprobe?

**reqprobe** is a lightweight, open-source API testing framework for TypeScript developers who want their tests to live in the codebase — not locked inside a GUI tool.

Unlike Postman, Bruno, Insomnia, or Hoppscotch, reqprobe treats API tests as **real TypeScript code**: versioned in Git, reviewable in PRs, executable in any CI/CD pipeline with zero configuration.

### Why reqprobe over GUI-based tools?

| | GUI Tools (Postman, Insomnia, Bruno) | reqprobe |
|---|---|---|
| **Lives in Git** | ❌ JSON exports, not real code | ✅ `.ts` files — diff, blame, review |
| **TypeScript** | ❌ Proprietary scripting | ✅ Native, typed, full IDE support |
| **OpenAPI contract testing** | ❌ Manual, optional | ✅ Automatic per-request validation |
| **CI/CD** | ⚠️ Requires extra runners or paid plans | ✅ `npx reqprobe run` — done |
| **Schema-driven fuzzing** | ❌ Not available | ✅ Built-in, from your OpenAPI spec |
| **Cost** | 💸 Subscription required for team features | ✅ Free, open-source, self-hostable |

If your API tests live in a GUI, they belong to a vendor — not your team. reqprobe puts them back in your codebase where they belong.

---

## Why TypeScript for API testing?

Most developers use Postman or Bruno for API testing. Both are great tools — but they use proprietary scripting that is disconnected from your codebase. reqprobe tests are TypeScript, which unlocks four things no GUI tool can match:

### 1. Import your own app's types directly into tests

```ts
// Your NestJS / Express app already defines this type:
import type { User } from '../src/users/user.entity';
import { test } from 'req-probe/dsl';

test('POST /users — response is a valid User', async (ctx) => {
  const res = await ctx.api.post('/users', { name: 'Alice', email: 'alice@example.com' });

  // res.body is typed as User — IDE autocomplete, type checking, everything
  const user = res.body as User;
  ctx.expect(user.id).toBeTruthy();
  ctx.expect(user.email).toBe('alice@example.com');
});
```

If you rename a field in your app, TypeScript will flag the test at compile time — before CI runs, before the test even executes. No other API testing tool can do this.

### 2. Full IDE support — autocomplete, go-to-definition, inline docs

Every method on `ctx.api`, every assertion on `ctx.expect`, every option in `reqprobe.config.ts` has complete type information. Your IDE autocompletes them, flags wrong arguments, and shows docs on hover. No tab-switching to documentation pages.

### 3. Share fixtures, helpers, and constants from your codebase

```ts
// shared test helpers live in your repo alongside the tests
import { createTestUser, cleanupTestUser } from '../helpers/test-fixtures';
import { API_ROUTES } from '../src/constants/routes';

test(`GET ${API_ROUTES.USERS} — returns paginated list`, async (ctx) => {
  const user = await createTestUser();
  const res  = await ctx.api.get(API_ROUTES.USERS);
  ctx.expect(res).toHaveStatus(200);
  await cleanupTestUser(user.id);
});
```

In Postman, you'd hard-code the route string and copy-paste setup/teardown scripts into every collection. Here it's just a normal import.

### 4. Tests break at compile time, not at 2am in production

When your API changes — a renamed field, a removed endpoint, a changed status code — TypeScript catches the mismatch immediately when you run `tsc`. The feedback loop is seconds, not "CI failed after a 4-minute run."

---

## Features

| | Feature | Description |
|---|---|---|
| 📝 | **TypeScript Native** | Tests are `.ts` files with full IDE support, type checking, and refactoring. |
| 🛡️ | **OpenAPI Contract Validation** | Automatically validate every API response against your OpenAPI 3.x spec using Ajv. No extra assertions needed. |
| 🔐 | **Auth Helpers** | Bearer, Basic, API Key, and OAuth2 (client credentials) — configured once, applied to every request. Token caching included. |
| ⏳ | **Async Polling** | `ctx.api.poll()` — test job queues, webhooks, and background tasks with configurable interval and timeout. |
| 🏷️ | **Tag Filtering** | Tag tests with `@smoke`, `@regression`, `@destructive` — run subsets via `--tag` or `--skip`. |
| ⚡ | **Parallel Execution** | `reqprobe run --workers 8` — run test files concurrently for faster CI pipelines. |
| 🔀 | **Schema Fuzzing** | `ctx.fuzz.generate('/users', 'POST')` generates realistic payloads from your OpenAPI spec. |
| 📊 | **Rich Reports** | Self-contained HTML, JSON, and JUnit XML reports. JUnit output works natively with Jenkins, GitLab CI, and Azure DevOps. |
| 🌱 | **Git-Native** | Tests are code — full diff history, PR reviews, and code coverage tooling just work. |
| ⚙️ | **CI/CD Ready** | Exits with code `1` on failure. Works with GitHub Actions, GitLab CI, Jenkins, and any CI runner. |
| 🏗️ | **Monorepo Support** | Per-package config files — each service owns its own tests and base URL. |
| 👁️ | **Watch Mode** | `reqprobe run --watch` — re-run tests on file save during development. |
| 📋 | **Scaffold Generator** | `reqprobe generate --from openapi.json` — generate typed test stubs from any OpenAPI spec. |

---

## Installation

```bash
# npm
npm install req-probe

# yarn
yarn add req-probe

# pnpm
pnpm add req-probe
```

**Requirements:** Node.js 18 or higher.

---

## Quick Start

### 1. Create a config file

```ts
// reqprobe.config.ts
import type { Config } from 'req-probe';

const config: Config = {
  baseUrl: 'https://your-api.com',
  timeout: 10_000,
  auth: {
    type: 'bearer',
    token: process.env.API_TOKEN ?? '',
  },
};

export default config;
```

### 2. Write a test

```ts
// tests/users.test.ts
import { test } from 'req-probe/dsl';

test('GET /users — returns 200', async (ctx) => {
  const res = await ctx.api.get('/users');
  ctx.expect(res).toHaveStatus(200);
  ctx.expect(res.body).toHaveProperty('data');
});

test('POST /users — creates a user @smoke', async (ctx) => {
  const res = await ctx.api.post('/users', { name: 'Alice', email: 'alice@example.com' });
  ctx.expect(res).toHaveStatus(201);
  ctx.expect(res.body.name).toBe('Alice');
});
```

### 3. Run

```bash
npx reqprobe run "tests/**/*.test.ts"

# Run only smoke tests
npx reqprobe run --tag smoke

# Run 8 files in parallel
npx reqprobe run --workers 8
```

Output:

```
❯ users.test.ts

  ✓ GET /users — returns 200        312ms
  ✓ POST /users — creates a user    189ms

────────────────────────────────────────
   PASSED   501ms
────────────────────────────────────────
  ✓ Passed  2
  ✖ Failed  0
    Total   2
────────────────────────────────────────
```

Exit code `1` on any failure — CI-ready with zero configuration.

---

## Try It Now — No API Needed

Run this against the free [PokéAPI](https://pokeapi.co) — no auth, no setup:

```ts
// tests/pokeapi.test.ts
import { test } from 'req-probe/dsl';

test('GET /pokemon/pikachu — returns correct name', async (ctx) => {
  const res = await ctx.api.get('/pokemon/pikachu');
  ctx.expect(res).toHaveStatus(200);
  ctx.expect(res.body.name).toBe('pikachu');
});
```

```ts
// reqprobe.config.ts
export default { baseUrl: 'https://pokeapi.co/api/v2', timeout: 10_000 };
```

```bash
npx reqprobe run "tests/pokeapi.test.ts"
```

---

## Configuration

```ts
// reqprobe.config.ts
import type { Config } from 'req-probe';

const config: Config = {
  baseUrl: 'https://api.yourservice.com',
  timeout: 10_000,

  // Auth applied automatically to every request — no per-test boilerplate
  auth: {
    type: 'bearer',                      // 'bearer' | 'basic' | 'api-key' | 'oauth2'
    token: process.env.API_TOKEN ?? '',
  },

  // OpenAPI contract validation — optional, additive
  openapi: {
    specPath: './openapi.json',
    strict: false,                       // true = fail if endpoint not in spec
  },

  // Reports — all optional
  reporters: {
    outDir: './reqprobe-reports',
    html: true,                          // reqprobe-reports/report.html
    json: true,                          // reqprobe-reports/report.json
    junit: true,                         // reqprobe-reports/report.xml (Jenkins/GitLab/Azure)
  },
};

export default config;
```

### Environment profiles

```bash
reqprobe run --env staging      # loads reqprobe.config.staging.ts
reqprobe run --env production
```

---

## Writing Tests

### DSL style (recommended)

```ts
import { test, beforeAll, afterAll } from 'req-probe/dsl';

let authToken: string;

beforeAll(async () => {
  const res = await fetch('https://api.example.com/auth/token', { method: 'POST' });
  authToken = (await res.json()).token;
});

test('GET /users @smoke', async (ctx) => {
  const res = await ctx.api.get('/users');
  ctx.expect(res).toHaveStatus(200);
  ctx.expect(res.body).toHaveProperty('data');
});

test('POST /users @regression', async (ctx) => {
  const res = await ctx.api.post('/users', { name: 'Alice', email: 'alice@example.com' });
  ctx.expect(res).toHaveStatus(201);
  ctx.expect(res.body.id).toBeTruthy();
});
```

### Suite style

```ts
import type { TestSuite } from 'req-probe';

const suite: TestSuite = {
  name: 'Auth API',
  tests: [
    {
      name: 'POST /auth/login — returns token',
      run: async (ctx) => {
        const res = await ctx.api.post('/auth/login', {
          email: 'admin@example.com',
          password: 'secret',
        });
        ctx.expect(res).toHaveStatus(200);
        ctx.expect(res.body.token).toBeTruthy();
      },
    },
  ],
};

export default suite;
```

### Async polling — test background jobs and webhooks

```ts
test('background export job completes', async (ctx) => {
  const job = await ctx.api.post('/jobs', { type: 'export', format: 'csv' });
  ctx.expect(job).toHaveStatus(202);

  const result = await ctx.api.poll(`/jobs/${job.body.id}`, {
    until: (res) => res.body.status === 'complete',
    interval: 1000,    // ms between checks
    timeout: 30_000,   // throws if never met
  });

  ctx.expect(result.body.downloadUrl).toBeTruthy();
});
```

### Schema-driven fuzzing — auto-generate test data from OpenAPI

```ts
test('POST /users with generated payload', async (ctx) => {
  const payload = ctx.fuzz.generate('/users', 'POST');
  const res = await ctx.api.post('/users', payload);
  ctx.expect(res).toHaveStatus(201);
});
```

### Available assertions

```ts
ctx.expect(res).toHaveStatus(200);
ctx.expect(res).toRespondWithin(500);       // response time in ms
ctx.expect(res.body.name).toBe('Alice');
ctx.expect(res.body.items).toEqual([1, 2, 3]);
ctx.expect(res.body.message).toContain('success');
ctx.expect(res.body.token).toBeTruthy();
ctx.expect(res.body).toHaveProperty('id');
```

---

## OpenAPI Contract Validation

Point reqprobe at your OpenAPI 3.x spec and every API response is **automatically validated** against its schema — no extra assertions needed in tests.

```ts
// reqprobe.config.ts
openapi: {
  specPath: './openapi.json',
  strict: false,   // true = fail on endpoints missing from the spec
}
```

```ts
// Every ctx.api call now validates the response automatically
test('GET /products/:id — response matches schema', async (ctx) => {
  const res = await ctx.api.get('/products/42');
  ctx.expect(res).toHaveStatus(200);
  // reqprobe validates res.body against GET /products/{id} → 200 in the spec
  // No extra assertion needed
});
```

When a response doesn't match the schema, reqprobe gives a precise error:

```
  ✖ GET /products/42 — response matches schema  (67ms)
    ├ [reqprobe/openapi] Response body failed schema validation:
    ├   • body.price: must be number
    └   • body.stock: must have required property 'stock'
```

**Supported:**
- OpenAPI 3.x JSON specs
- Local `$ref` resolution
- Path template matching (`/users/{id}`)
- `default` response fallback
- `strict: false` silently skips missing schemas (safe for partial specs)

---

## Reports

```ts
reporters: {
  outDir: './reqprobe-reports',
  html:  true,   // self-contained HTML — attach to PRs or upload as CI artifact
  json:  true,   // machine-readable — dashboards, Slack bots, downstream tools
  junit: true,   // JUnit XML — Jenkins, GitLab CI test dashboard, Azure DevOps
}
```

The **HTML report** is fully self-contained — open it in any browser with no server needed.

---

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/api-tests.yml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run API tests
        run: npx reqprobe run "tests/**/*.test.ts" --workers 4
        env:
          API_TOKEN: ${{ secrets.API_TOKEN }}
          API_BASE_URL: ${{ vars.STAGING_URL }}
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: reqprobe-report
          path: reqprobe-reports/
```

### GitLab CI

```yaml
api-tests:
  image: node:20-alpine
  script:
    - npm ci
    - npx reqprobe run "tests/**/*.test.ts"
  artifacts:
    when: always
    reports:
      junit: reqprobe-reports/report.xml   # shows inline in GitLab MR
    paths:
      - reqprobe-reports/
    expire_in: 7 days
```

### Jenkins

```groovy
stage('API Tests') {
  steps {
    sh 'npm ci'
    sh 'npx reqprobe run "tests/**/*.test.ts"'
  }
  post {
    always {
      junit 'reqprobe-reports/report.xml'
    }
  }
}
```

---

## Monorepo Usage

reqprobe reads the nearest `reqprobe.config.ts`. Each service owns its own config:

```
apps/
  users-service/
    reqprobe.config.ts      # baseUrl: http://users-service
    tests/
  orders-service/
    reqprobe.config.ts      # baseUrl: http://orders-service
    tests/
```

```bash
# From monorepo root
npx reqprobe run "apps/users-service/tests/**/*.test.ts"

# From within the service
cd apps/users-service && npx reqprobe run "tests/**/*.test.ts"
```

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full backlog with code examples and architecture notes.

### Phase 0 — Shipped ✅

| Feature | Notes |
|---|---|
| ✅ TypeScript-native test runner | `test()` DSL + `TestSuite` object pattern |
| ✅ Lifecycle hooks | `beforeAll` / `beforeEach` / `afterEach` / `afterAll` |
| ✅ Full assertion library | `toBe`, `toEqual`, `toContain`, `toHaveStatus`, `toRespondWithin`, … |
| ✅ OpenAPI 3.x contract validation | Automatic per-request schema check via Ajv — no extra assertions needed |
| ✅ Schema-driven fuzzing | `ctx.fuzz.generate('/users', 'POST')` + `reqprobe fuzz` CLI |
| ✅ Auth helpers | `bearer`, `basic`, `api-key`, `oauth2` — configured once, applied everywhere. OAuth2 token cached automatically. |
| ✅ Async polling | `ctx.api.poll()` for job queues, webhooks, and background tasks |
| ✅ Tag filtering | `test('name @smoke', …)` → `reqprobe run --tag smoke` / `--skip destructive` |
| ✅ Parallel execution | `reqprobe run --workers 8` — concurrent file execution with isolated registries |
| ✅ HTML + JSON + JUnit XML reports | JUnit for Jenkins, GitLab CI, Azure DevOps, TeamCity |
| ✅ Watch mode | `reqprobe run --watch` — re-runs on file save |
| ✅ Scaffold generator | `reqprobe generate --from openapi.json` — typed test stubs from spec |
| ✅ CI exit codes | Exits `1` on failure — zero config required |
| ✅ `.env` support + environment profiles | Per-environment config files (`reqprobe.config.staging.ts`) |

### Phase 1 — v1.2 · In Progress · *~2–3 weeks*

Retry logic · Richer failure diagnostics (full request + response on failure) · Multipart file upload · Cookie jar · `ctx.store` cross-request state · Multi-environment config block

### Phase 2 — v1.3 · Planned · *~4–6 weeks*

GraphQL support · Mock server from spec · Snapshot testing · OpenAPI spec diff · WebSocket & SSE testing · Plugin API · Schema-driven load testing

### Phase 3 — v1.4 · Planned · *~2–3 months*

Spec coverage report · OpenTelemetry tracing · Consumer-driven contract testing · Chaos/fault injection · gRPC support · Multi-region performance testing (open-source, self-hostable)

### Phase 4 — v2.0 · Vision · *~6+ months*

Self-hostable team dashboard · AI test generation from spec · AI anomaly detection · Enterprise SSO / RBAC

---

## Contributing

Contributions are welcome. reqprobe is intentionally small — keep PRs focused.

```bash
git clone https://github.com/shashi089/reqprobe.git
cd reqprobe
npm install
npm run build
```

**Conventions:**
- No new runtime dependencies without discussion — current footprint is intentionally minimal (`ajv`, `commander`, `dotenv`, `fast-glob`, `picocolors`, `tsx`)
- Single responsibility — each module in `src/` has one job
- No circular imports — dependency graph is strictly one-way
- TypeScript strict mode — `tsc` must exit 0 before any PR merges

**Submitting a PR:**
1. Fork and create a feature branch
2. Make your change + add or update examples in `examples/`
3. Run `npm run build` — must exit 0
4. Open a PR with a clear description of what and why

**Reporting bugs** — open an issue with:
- reqprobe version (`npx reqprobe --version`)
- Node version (`node --version`)
- Minimal reproduction (test file + config)
- Actual vs expected output

---

## License

MIT © Shashidhar Naik
