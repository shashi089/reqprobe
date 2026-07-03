# reqprobe — Roadmap

> **Living document.** Priorities shift as the community grows. Open an issue to discuss or upvote items.

---

## Phase 0 — v0.1.0 & v0.2.0: Shipped ✅

Everything below is implemented and available today via `npm install reqprobe`.

| Feature | Notes |
|---|---|
| ✅ TypeScript-native test runner | Tests are `.ts` files — real code, not collections |
| ✅ DSL style: `test()` + hooks | `beforeAll` / `beforeEach` / `afterEach` / `afterAll` |
| ✅ Suite style: `TestSuite` | Object-based test grouping with shared context |
| ✅ Fluent HTTP client | `ctx.api.get/post/put/patch/delete()` + `ctx.request()` |
| ✅ Full assertion library | `toBe`, `toEqual`, `toContain`, `toHaveStatus`, `toBeTruthy`, `toHaveProperty`, `toRespondWithin` |
| ✅ OpenAPI 3.x contract validation | Automatic per-request schema validation via Ajv — no extra assertions needed |
| ✅ `$ref` resolution | Local ref resolution + inlining |
| ✅ Path template matching | `/users/{id}` matched correctly against request paths |
| ✅ Schema-driven fuzzing | `ctx.fuzz.generate('/users', 'POST')` generates realistic payloads from spec |
| ✅ CLI fuzz command | `reqprobe fuzz --from openapi.json` — hit every endpoint with generated data |
| ✅ Test stub generator | `reqprobe generate --from openapi.json` — scaffold typed tests from spec |
| ✅ Self-contained HTML reports | Dark theme, expandable errors, zero external dependencies |
| ✅ JSON reports | Machine-readable — suitable for dashboards and downstream tooling |
| ✅ JUnit XML reports | `reporters: { junit: true }` — Jenkins, GitLab CI, Azure DevOps, TeamCity |
| ✅ Watch mode | `reqprobe run --watch` — re-runs tests on file save with debounce |
| ✅ Environment config | `.env` support + per-environment config files (`reqprobe.config.staging.ts`) |
| ✅ Monorepo support | Per-package config — each service owns its tests |
| ✅ Parallel execution | `reqprobe run --workers 8` — concurrent file execution with isolated registries |
| ✅ Tag filtering | `test('name @smoke', …)` → `reqprobe run --tag smoke` / `--skip destructive` |
| ✅ Auth helpers | `bearer`, `basic`, `api-key`, `oauth2` — configured once in `reqprobe.config.ts`, applied to every request. OAuth2 token cached and refreshed automatically. |
| ✅ `ctx.api.poll()` | Async polling for job queues, webhooks, and background tasks with configurable interval and timeout |
| ✅ CI/CD ready | Exit code `1` on failure — works with GitHub Actions, GitLab CI, Jenkins, Azure DevOps |
| ✅ Auto tsx loader | Detects `.ts` files and re-spawns with the correct loader automatically |
| ✅ Retry logic | `retry: { times, delay, on }` per-request or global — retries on status codes or network errors |
| ✅ Richer failure diagnostics | Full HTTP exchange on every failure — request, masked auth headers, response body, assertion diff |

---

## Phase 1 — v0.3.0: Production Hardening

**Theme:** Remove the remaining friction that stops teams from adopting reqprobe on real projects.

> Target: 2–3 weeks

### Multipart Form / File Upload

```typescript
test('upload avatar', async (ctx) => {
  const res = await ctx.api.upload('/users/1/avatar', {
    file: './fixtures/avatar.png',
    contentType: 'image/png',
    fieldName: 'avatar',
  });
  ctx.expect(res).toHaveStatus(200);
});
```

### Cookie Jar

Automatic cookie handling across requests in a test — essential for session-based APIs.

```typescript
test('login and access protected route', async (ctx) => {
  await ctx.api.post('/auth/login', { email: 'user@example.com', password: 'secret' });
  // Cookie stored automatically
  const res = await ctx.api.get('/account/profile');
  ctx.expect(res).toHaveStatus(200);
});
```

### `ctx.store` — Cross-Request State

Ergonomic cross-request value extraction without manual closures.

```typescript
test('create then fetch user', async (ctx) => {
  const created = await ctx.api.post('/users', { name: 'Alice', email: 'alice@example.com' });
  ctx.expect(created).toHaveStatus(201);

  ctx.store.set('userId', created.body.id);

  const fetched = await ctx.api.get(`/users/${ctx.store.get('userId')}`);
  ctx.expect(fetched.body.email).toBe('alice@example.com');
});
```

### Environment Profiles (enhanced)

Multi-environment config in a single file, with per-environment overrides.

```ts
// reqprobe.config.ts
const config: Config = {
  environments: {
    local:      { baseUrl: 'http://localhost:3000' },
    staging:    { baseUrl: 'https://api-staging.example.com' },
    production: { baseUrl: 'https://api.example.com', timeout: 15000 },
  },
  timeout: 10000,
  headers: { Accept: 'application/json' },
};
```

```bash
reqprobe run --env staging
reqprobe run --env production --tag smoke
```

---

## Phase 2 — v0.4.0: Developer Ecosystem

**Theme:** Expand the developer audience. Establish reqprobe as a platform, not just a runner.

> Target: 4–6 weeks

### GraphQL Support

```typescript
import { test } from 'reqprobe/dsl';

test('query user by ID', async (ctx) => {
  const res = await ctx.api.graphql('/graphql', {
    query: `
      query GetUser($id: ID!) {
        user(id: $id) { id name email createdAt }
      }
    `,
    variables: { id: '123' },
  });

  ctx.expect(res).toHaveStatus(200);
  ctx.expect(res.body.data.user.name).toBeTruthy();
  ctx.expect(res.body.errors).toBe(undefined);
});
```

### Mock Server from OpenAPI Spec

Serve realistic mock responses generated by SchemaFuzzer. Zero configuration — point it at a spec.

```bash
reqprobe mock --from ./openapi.json --port 3001
reqprobe mock --from ./openapi.json --port 3001 --delay 50  # simulate latency
```

The mock server:
- Routes all paths defined in the spec
- Generates schema-valid response bodies on every request
- Returns correct status codes (first 2xx defined in spec)
- Supports `Prefer: example=error` header to force error responses
- Hot-reloads when the spec file changes

Useful for: frontend development without a running backend, consumer-driven contract testing, CI environments without access to downstream services.

### Snapshot Testing

```typescript
test('user response shape is stable', async (ctx) => {
  const res = await ctx.api.get('/users/1');
  ctx.expect(res).toHaveStatus(200);
  ctx.expect(res.body).toMatchSnapshot('user-get-by-id');
});
```

First run saves `reqprobe-snapshots/user-get-by-id.json`. Subsequent runs deep-compare and fail on structural drift.

```bash
reqprobe run --update-snapshots
```

### OpenAPI Spec Diff — Breaking Change Detection

```bash
reqprobe diff --from ./openapi-v1.json --to ./openapi-v2.json
```

```
  BREAKING
  ├ DELETE  GET /users/{id}                (endpoint removed)
  ├ CHANGED POST /users — body.email       (was optional, now required)
  └ CHANGED GET  /users/{id} — body.id    (type changed: string → number)

  NON-BREAKING
  ├ ADDED   GET /users/{id}/permissions   (new endpoint)
  └ ADDED   body.displayName              (new optional field)
```

Gate deploys on breaking changes. Run in CI on OpenAPI spec PRs.

### WebSocket & SSE Testing

```typescript
test('real-time order updates', async (ctx) => {
  const ws = await ctx.api.ws('/ws/orders');

  await ws.send({ type: 'subscribe', orderId: '123' });

  const update = await ws.receive({ timeout: 5000 });
  ctx.expect(update.type).toBe('order.status_changed');

  await ws.close();
});

test('server-sent events stream', async (ctx) => {
  const events = await ctx.api.sse('/events/feed', { take: 3, timeout: 10000 });
  ctx.expect(events).toHaveLength(3);
  ctx.expect(events[0].type).toBe('connected');
});
```

### Plugin / Middleware System

Enable community ecosystem growth without bloating the core.

```typescript
// reqprobe.config.ts
import { opentelemetry } from '@reqprobe/plugin-otel';
import { awsSigV4 } from '@reqprobe/plugin-aws-auth';

const config: Config = {
  plugins: [
    opentelemetry({ endpoint: 'http://jaeger:4318/v1/traces' }),
    awsSigV4({ region: 'us-east-1', service: 'execute-api' }),
  ],
};
```

Plugin API:

```typescript
interface ReqProbePlugin {
  name: string;
  onRequest?: (req: HttpRequest) => HttpRequest | Promise<HttpRequest>;
  onResponse?: (res: HttpResponse, req: HttpRequest) => void | Promise<void>;
  onTestStart?: (test: TestCase) => void;
  onTestEnd?: (result: TestResult) => void;
  onSuiteEnd?: (summary: ReportSummary) => void;
}
```

### HTML Report Server

```bash
reqprobe report serve               # serves last report at localhost:4000
reqprobe report serve --port 8080
reqprobe run --watch --serve        # live-reload report in watch mode
```

### Schema-Driven Load Testing

**The insight:** Most load testing tools require you to write load test scripts as a separate discipline. reqprobe derives load scenarios from what you already have — your OpenAPI spec and your existing tests.

```bash
reqprobe load --from ./openapi.json --vus 50 --duration 60s
reqprobe load --from ./openapi.json --vus 100 --ramp 0:10,30s:100,60s:100,90s:0
reqprobe load --test tests/users.test.ts --vus 20 --duration 30s
```

**What it does:**

1. Reads the OpenAPI spec
2. Generates stateful scenarios: `POST /users` → `GET /users/{id}` → `PUT /users/{id}` → `DELETE /users/{id}`
3. Pre-generates realistic payload pools (SchemaFuzzer, avoids re-generating per-request)
4. Runs scenarios at configured concurrency using Node.js worker threads
5. Collects metrics with HDR histogram accuracy (no data loss on tail latency)
6. Streams live metrics to console, generates detailed report on completion

**Live console during load run:**

```
reqprobe load  ████████████░░░░░░░░  61% | 00:23 remaining

VUs: 50   Throughput: 1,247 req/s   Errors: 0.3%   Elapsed: 37s

Endpoint                  p50     p95     p99     Errors   RPS
POST /users               48ms    89ms    142ms   0.0%     312/s
GET  /users/{id}          12ms    28ms    51ms    0.1%     614/s
PUT  /users/{id}          31ms    67ms    98ms    0.0%     210/s
DELETE /users/{id}        18ms    41ms    73ms    1.4%  ⚠  111/s

Bottleneck: DELETE /users/{id} error rate rising above threshold
```

---

## Phase 3 — v0.5.0: Enterprise & Scale

**Theme:** The features enterprises pay for, kept open-source and self-hostable.

> Target: 2–3 months

### Spec Coverage Report

The API testing equivalent of code coverage — know which endpoints have tests and which don't.

```bash
reqprobe coverage --from ./openapi.json

  Coverage: 31/47 endpoints (66%)

  Missing
  ├ PUT    /users/{id}       — no test found
  ├ DELETE /users/{id}       — no test found
  └ GET    /users/{id}/roles — no test found
```

### OpenTelemetry Native Integration

Every test run exports distributed traces. Each test = one span, each HTTP request = child span. Trace a test failure straight through to the backend service in your observability platform.

```typescript
// reqprobe.config.ts
telemetry: {
  endpoint: 'http://otel-collector:4318',
  serviceName: 'reqprobe',
  attributes: {
    'deployment.environment': process.env.ENV,
    'git.commit': process.env.GITHUB_SHA,
  },
},
```

No test code changes needed.

### Consumer-Driven Contract Testing

Built-in consumer-driven contract testing. Define what your service expects from its providers, verify providers deliver it.

```typescript
// tests/contracts/user-service.contract.ts
import { contract } from 'reqprobe/contracts';

contract('payments-service → user-service', {
  provider: 'user-service',
  interactions: [
    {
      description: 'get user by ID for payment processing',
      request: { method: 'GET', path: '/users/123' },
      response: {
        status: 200,
        body: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          paymentMethodId: { type: 'string' },
        },
      },
    },
  ],
});
```

```bash
reqprobe contracts verify --provider user-service --url https://user-service.internal
```

### Diff-Based CI Test Selection

In CI, only re-run tests touching endpoints that changed in the current PR.

```bash
reqprobe run --affected-since origin/main
```

reqprobe computes the git diff, maps changed files to affected API paths via OpenAPI spec analysis, and filters the test suite.

### Chaos / Fault Injection

Test how your clients handle server-side failures.

```typescript
test('client retries on 503', async (ctx) => {
  ctx.chaos.failNext(1, { status: 503 });
  const res = await ctx.api.get('/users');
  ctx.expect(res).toHaveStatus(200);  // succeeds on retry
});

test('client handles slow responses', async (ctx) => {
  ctx.chaos.delayNext(1, 2000);
  const res = await ctx.api.get('/users');
  ctx.expect(res.duration).toBeGreaterThan(1900);
});
```

### gRPC / Protobuf Support

```typescript
import { test } from 'reqprobe/dsl';

test('GetUser RPC', async (ctx) => {
  const res = await ctx.api.rpc('UserService/GetUser', {
    protoPath: './protos/user.proto',
    request: { id: '123' },
  });
  ctx.expect(res.body.email).toBeTruthy();
});
```

### Multi-Region Performance Testing

**The gap:** Most multi-region testing solutions are paid SaaS products — no credible open-source option exists. reqprobe fills this.

**Phase A: GitHub Actions Matrix (zero infrastructure)**

```bash
reqprobe generate ci --multi-region --provider github
```

Generates a GitHub Actions workflow that runs tests in parallel across runners on different continents, uploads JSON reports, and produces a unified multi-region comparison report.

```yaml
strategy:
  matrix:
    region: [us-east, eu-west, ap-southeast]
```

**Phase B: Self-hostable agent network**

```bash
# On your EU server:
reqprobe-agent --bind 0.0.0.0:7432 --token $SECRET

# Run from anywhere:
reqprobe cloud run \
  --agents us-east:https://agent.us.company.com,eu-west:https://agent.eu.company.com \
  --test ./api.test.ts
```

The controller distributes test bundles, collects results, and generates a unified multi-region report. 100% self-hostable — no reqprobe cloud dependency.

**Multi-region report:**

```
Multi-Region Results — POST /users                     2024-01-15 14:32:00 UTC

Region          p50     p95     p99     TTFB    DNS     TLS     Errors
us-east-1       48ms    89ms    142ms   31ms    2ms     8ms     0.0%
eu-west-1       92ms    167ms   241ms   74ms    3ms     11ms    0.1%
ap-southeast-1  187ms   312ms   489ms   142ms   8ms     24ms    0.8%   ⚠

Bottleneck: ap-southeast-1 — high TLS overhead suggests no session resumption
Recommendation: Verify CDN TLS session tickets are enabled for APAC edge nodes.

Global p95: 167ms  |  Worst region: ap-southeast-1  |  Global availability: 99.7%
```

---

## Phase 4 — v1.0.0: Platform Vision

**Theme:** From CLI tool to team platform — still self-hostable, still open-source.

> Target: 6+ months

### Self-Hostable Dashboard

A web UI for teams. Run `docker compose up` — no cloud dependency, no data leaves your network.

- Test history with trends and flakiness scores
- Per-endpoint latency charts over time
- Regression detection (automatic baseline comparison)
- Team collaboration: annotate failures, assign owners
- PR integration: inline test results on GitHub/GitLab PRs

### AI Test Generation from Spec

Point at an OpenAPI spec, get back meaningful tests with real assertions — not just stubs.

```bash
reqprobe generate --from ./openapi.json --ai --output tests/generated/
```

Understands: required vs optional fields, enum values, format constraints, min/max, relationship patterns (POST → GET → DELETE sequences).

### AI Anomaly Detection

After enough test runs, reqprobe learns what "normal" looks like for each endpoint. Automatically flags latency regressions, new error patterns, throughput degradation, and schema drift — no thresholds to configure manually.

### Enterprise Features

- SSO / SAML integration
- RBAC on shared test suites and reports
- Audit logs (who ran what, when, against which environment)
- Private report hosting with access control
- SLA reporting

---

## What makes reqprobe different

- Tests are **real TypeScript code** — not a DSL, not a GUI format, not a proprietary sandbox
- **Git-native** — diff, blame, PR review, branch per environment, just like your app code
- **OpenAPI contract testing built-in** — automatic per-request validation, no extra assertions needed
- **Schema-driven fuzzing** — generate realistic payloads directly from your OpenAPI spec
- **Import your app's own types** — `import type { User } from './src'` works natively in tests
- **Self-hostable** — no cloud dependency, no data leaves your network
- **Free and open-source** — MIT License

---

## Contributing

The highest-leverage contributions right now are in **Phase 1 (v0.3.0)**:

- `file-upload` — multipart form / binary file upload via `ctx.api.upload()`
- `cookie-jar` — automatic cookie handling across requests within a test
- `ctx-store` — cross-request value storage without manual closures
- `env-profiles` — `environments` block in config for multi-environment switching

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions and project conventions.

Open an issue tagged `roadmap` to discuss prioritization, propose new items, or share use cases that aren't covered.

---

## Versioning

reqprobe follows [Semantic Versioning](https://semver.org/).

- **Patch** (0.x.y) — bug fixes, no API changes
- **Minor** (0.x.0) — new features, backwards compatible
- **1.0.0** — stable release, API locked, long-term support begins

Config files and test files written for any `0.x` release will continue to work on all subsequent `0.x` releases.

---

*MIT License — Shashidhar Naik*
