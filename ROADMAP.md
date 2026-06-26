# ReqProbe — Roadmap

> **Living document.** Priorities shift as the community grows. Open an issue to discuss or upvote items.

---

## Current State (v1.0 — Shipped)

Everything below is implemented and available today.

| Feature | Notes |
|---|---|
| TypeScript-native test runner | Tests are `.ts` files — real code, not collections |
| DSL style: `test()` + hooks | `beforeAll` / `beforeEach` / `afterEach` / `afterAll` |
| Suite style: `TestSuite` | Object-based test grouping with shared context |
| Fluent HTTP client | `ctx.api.get/post/put/patch/delete()` + `ctx.request()` |
| Full assertion library | `toBe`, `toEqual`, `toContain`, `toHaveStatus`, `toBeTruthy`, `toHaveProperty`, `toRespondWithin` |
| OpenAPI 3.x contract validation | Automatic per-request schema validation via Ajv — no extra assertions needed |
| `$ref` resolution | Local ref resolution + inlining |
| Path template matching | `/users/{id}` matched correctly against request paths |
| Schema-driven fuzzing | `ctx.fuzz.generate('/users', 'POST')` generates realistic payloads from spec |
| CLI fuzz command | `reqprobe fuzz --from openapi.json` — hit every endpoint with generated data |
| Test stub generator | `reqprobe generate --from openapi.json` — scaffold typed tests from spec |
| Self-contained HTML reports | Dark theme, expandable errors, zero external dependencies |
| JSON reports | Machine-readable, suitable for dashboards and downstream tooling |
| Watch mode | `reqprobe run --watch` — re-runs tests on file save with debounce |
| Environment config | `.env` support + per-environment config files (`reqprobe.config.staging.ts`) |
| Monorepo support | Per-package config, each service owns its tests |
| CI/CD ready | Exit code `1` on failure — works with GitHub Actions, GitLab CI, Jenkins, Azure DevOps |
| Auto tsx loader | Detects `.ts` files and re-spawns with the correct loader automatically |

---

## v1.1 — Production Ready

**Theme:** Remove the barriers that stop teams from adopting ReqProbe on real projects.

> Target: Next 1–3 months

### Must Have

#### Parallel Test Execution
Run test files concurrently using worker threads. A 200-test suite at 200ms/test drops from 40s to 4s with 10-way parallelism.

```bash
reqprobe run "tests/**/*.test.ts" --workers 8
reqprobe run "tests/**/*.test.ts" --workers auto  # CPU core count
```

The existing `TestRegistry` is file-scoped — parallel execution isolates registries per worker. Results are streamed back to the main thread for aggregation.

#### JUnit XML Reporter
Required for Jenkins, GitLab CI test dashboards, Azure DevOps, and TeamCity. Without this, ReqProbe is blocked from many enterprise CI pipelines.

```ts
// reqprobe.config.ts
reporters: {
  outDir: './reqprobe-reports',
  json: true,
  html: true,
  junit: true,  // outputs reqprobe-reports/report.xml
}
```

#### Test Filtering by Tag
```typescript
test('GET /users @smoke @regression', async (ctx) => { ... });
test('DELETE /users/:id @regression @destructive', async (ctx) => { ... });
```

```bash
reqprobe run --tag smoke            # only @smoke tests
reqprobe run --tag regression       # only @regression tests
reqprobe run --tag smoke,regression # union: any test matching either tag
reqprobe run --skip destructive     # exclude @destructive tests
```

Enables smoke tests on every deploy, full regression suites nightly.

#### `ctx.api.poll()` — Async API Support
Critical for testing job queues, webhooks, background processing, and any async API pattern.

```typescript
test('background job completes', async (ctx) => {
  const job = await ctx.api.post('/jobs', { type: 'export', format: 'csv' });
  ctx.expect(job).toHaveStatus(202);

  const result = await ctx.api.poll(`/jobs/${job.body.id}`, {
    until: (res) => res.body.status === 'complete',
    interval: 1000,   // ms between checks
    timeout: 30000,   // max wait
  });

  ctx.expect(result.body.status).toBe('complete');
  ctx.expect(result.body.downloadUrl).toBeTruthy();
});
```

#### Authentication Helpers
Remove the most common boilerplate from every test file. Auth is config-level and applied automatically.

```ts
// reqprobe.config.ts
auth: {
  type: 'bearer',
  token: process.env.API_TOKEN,
},
// OR
auth: {
  type: 'oauth2',
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  tokenEndpoint: '/oauth/token',
  scopes: ['read:users', 'write:users'],
  // Token cached and refreshed automatically
},
// OR
auth: {
  type: 'basic',
  username: process.env.API_USER,
  password: process.env.API_PASS,
},
// OR
auth: {
  type: 'api-key',
  header: 'X-API-Key',
  value: process.env.API_KEY,
},
```

#### Richer Failure Diagnostics
Currently failures show error message + response body. Add the full HTTP exchange so developers can debug without adding temporary `console.log` calls.

```
  ✖ POST /users — creates new user   (89ms)

  Request
  ├ POST https://api.example.com/users
  ├ Headers: { Authorization: Bearer ***, Content-Type: application/json }
  └ Body: { "name": "Alice", "email": "alice@example.com" }

  Response
  ├ 422 Unprocessable Entity
  ├ Headers: { Content-Type: application/json }
  └ Body: { "error": "email already exists" }

  Assertion
  ├ Expected status: 201
  └ Received status: 422
```

#### Environment Profiles
```ts
// reqprobe.config.ts
const config: Config = {
  environments: {
    local:      { baseUrl: 'http://localhost:3000' },
    staging:    { baseUrl: 'https://api-staging.example.com' },
    production: { baseUrl: 'https://api.example.com', timeout: 15000 },
  },
  // defaults applied to all environments
  timeout: 10000,
  headers: { Accept: 'application/json' },
};
```

```bash
reqprobe run --env staging
reqprobe run --env production --tag smoke
```

#### Retry Logic
```typescript
test('flaky third-party API', async (ctx) => {
  const res = await ctx.api.get('/external/status', {
    retry: { times: 3, delay: 500, on: [429, 503] }
  });
  ctx.expect(res).toHaveStatus(200);
});
```

Also configurable globally in `reqprobe.config.ts`.

#### Multipart Form / File Upload
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

#### Cookie Jar
Automatic cookie handling across requests in a test — essential for session-based APIs.

```typescript
test('login and access protected route', async (ctx) => {
  await ctx.api.post('/auth/login', { email: 'user@example.com', password: 'secret' });
  // Cookie is stored automatically
  const res = await ctx.api.get('/account/profile');
  ctx.expect(res).toHaveStatus(200);
});
```

#### `ctx.store` — Cross-Request State
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

---

## v1.2 — Developer Ecosystem

**Theme:** Expand the developer audience. Establish ReqProbe as a platform, not just a runner.

> Target: 3–6 months

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

test('mutation — update email', async (ctx) => {
  const res = await ctx.api.graphql('/graphql', {
    query: `mutation UpdateEmail($id: ID!, $email: String!) {
      updateUser(id: $id, email: $email) { id email }
    }`,
    variables: { id: '123', email: 'new@example.com' },
  });
  ctx.expect(res.body.data.updateUser.email).toBe('new@example.com');
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
- Returns correct status codes (uses first 2xx in spec)
- Supports `Prefer: example=error` header to force error responses
- Hot-reloads when spec file changes

Useful for: frontend development without a running backend, consumer-driven contract testing, CI environments without access to downstream services.

### Snapshot Testing
```typescript
test('user response shape is stable', async (ctx) => {
  const res = await ctx.api.get('/users/1');
  ctx.expect(res).toHaveStatus(200);
  ctx.expect(res.body).toMatchSnapshot('user-get-by-id');
});
```

First run: saves `reqprobe-snapshots/user-get-by-id.json`. Subsequent runs: deep-compares and fails on structural drift.

```bash
reqprobe run --update-snapshots  # regenerate all snapshots
```

### OpenAPI Spec Diff — Breaking Change Detection
```bash
reqprobe diff --from ./openapi-v1.json --to ./openapi-v2.json
```

Output:
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
  ctx.expect(update.status).toBe('processing');

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
reqprobe report serve --port 8080   # custom port
reqprobe run --watch --serve        # live reload report in watch mode
```

### Schema-Driven Load Testing
See [Load Testing](#load-testing-schema-driven) section below.

---

## v1.3 — Enterprise & Scale

**Theme:** The features enterprises pay for, kept open-source and self-hostable.

> Target: 6–12 months

### OpenTelemetry Native Integration
Every test run exports distributed traces. Each test = one span, each HTTP request = child span. In your Jaeger or Datadog dashboard, you can trace a test failure straight through to the backend service that failed.

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
ReqProbe-native alternative to Pact. Define what your service expects from its providers, verify providers actually deliver it.

```typescript
// consumer: payments-service
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
In CI, only re-run tests touching endpoints that changed in the current PR. Dramatically reduces CI feedback time on large test suites.

```bash
reqprobe run --affected-since origin/main  # only tests for changed endpoints
```

ReqProbe computes the git diff, maps changed files to affected API paths via OpenAPI spec analysis, and filters the test suite.

### Chaos / Fault Injection
Test how your clients handle server-side failures. ReqProbe acts as a transparent proxy and injects faults programmatically.

```typescript
test('client retries on 503', async (ctx) => {
  ctx.chaos.failNext(1, { status: 503 });           // first request fails
  const res = await ctx.api.get('/users');            // client should retry
  ctx.expect(res).toHaveStatus(200);                  // succeeds on retry
});

test('client handles slow responses', async (ctx) => {
  ctx.chaos.delayNext(1, 2000);                      // add 2s delay
  const res = await ctx.api.get('/users');
  ctx.expect(res.duration).toBeGreaterThan(1900);
});

test('circuit breaker opens after failures', async (ctx) => {
  ctx.chaos.failNext(5, { status: 503 });
  // ... verify circuit opens and returns fallback
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

### Multi-Region Testing
See [Multi-Region Testing](#multi-region-performance-testing) section below.

### Spec Coverage Report
The API testing equivalent of code coverage. Know exactly which endpoints in your OpenAPI spec have tests and which don't.

```bash
reqprobe coverage --from ./openapi.json

  Coverage: 31/47 endpoints (66%)

  Covered
  ├ GET  /users              ✓
  ├ POST /users              ✓
  ├ GET  /users/{id}         ✓
  └ ... 28 more

  Missing
  ├ PUT    /users/{id}       — no test found
  ├ DELETE /users/{id}       — no test found
  ├ GET    /users/{id}/roles — no test found
  └ ... 13 more
```

---

## v2.0 — Platform Vision

**Theme:** From CLI tool to team platform — still self-hostable, still open-source.

> Target: 12+ months

### Self-Hostable Dashboard
A web UI for teams. Run `docker compose up` — no cloud dependency, no data leaves your network.

- Test history with trends and flakiness scores
- Per-endpoint latency charts over time
- Regression detection (automatic baseline comparison)
- Team collaboration: annotate failures, assign owners
- PR integration: inline test results on GitHub/GitLab PRs

### AI Test Generation from Spec
Give ReqProbe an OpenAPI spec, get back meaningful test cases — not just stubs, but tests with actual assertions based on schema semantics, business rules inferred from field names and descriptions, and edge cases.

```bash
reqprobe generate --from ./openapi.json --ai --output tests/generated/
```

Uses the Claude API. Understands: required vs optional fields, enum values, format constraints, min/max, relationship patterns (POST → GET → DELETE sequences).

### AI Anomaly Detection
After enough load test runs, ReqProbe learns what "normal" looks like for each endpoint. Automatically flags:
- Latency regressions (> 2 standard deviations from baseline)
- New error patterns
- Throughput degradation
- Schema drift (responses changing shape over time)

No thresholds to configure manually.

### Enterprise Features
- SSO / SAML integration
- RBAC on shared test suites and reports
- Audit logs (who ran what, when, against which environment)
- Private report hosting with access control
- SLA reporting

---

## Load Testing (Schema-Driven)

> Planned for v1.2

**The insight:** k6, Artillery, JMeter, and Locust require you to write load test scripts as a separate discipline. ReqProbe derives load scenarios from what you already have — your OpenAPI spec and your existing tests.

```bash
reqprobe load --from ./openapi.json --vus 50 --duration 60s
reqprobe load --from ./openapi.json --vus 100 --ramp 0:10,30s:100,60s:100,90s:0
reqprobe load --test tests/users.test.ts --vus 20 --duration 30s  # run existing test under load
```

### What it does

1. Reads the OpenAPI spec
2. Generates stateful scenarios: `POST /users` → `GET /users/{id}` → `PUT /users/{id}` → `DELETE /users/{id}`
3. Pre-generates realistic payload pools (uses SchemaFuzzer, avoids re-generating per-request)
4. Runs scenarios at configured concurrency using Node.js worker threads
5. Collects metrics with HDR histogram accuracy (no data loss on tail latency)
6. Streams live metrics to console. Generates detailed report on completion.

### Live Console During Load Run

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

### Metrics Collected

| Metric | Detail |
|---|---|
| Latency percentiles | p50, p95, p99, p99.9 (HDR histogram — accurate tail latency) |
| TTFB | Time to first byte — separates server processing from transfer |
| DNS resolution time | Per-request DNS timing |
| TLS handshake time | Connection overhead |
| Throughput | Requests/second sustained over full duration |
| Error rate | Broken down by 4xx / 5xx / timeout / connection |
| Throughput stability | Variance in RPS over time — detects degradation under sustained load |

### Bottleneck Detection

ReqProbe automatically identifies:
- Which endpoint degrades first under increasing load
- Whether degradation is in DNS, TLS, TTFB, or transfer phase
- Correlation between error rate and latency spikes

### Architecture

```
LoadEngine
 ├── ScenarioPlanner     OpenAPI spec → ordered request sequences
 │    ├── StateExtractor   POST /users → extracts {id} for GET /users/{id}
 │    └── DataPool         Pre-generate N payloads per schema
 ├── VirtualUserPool      Worker threads — one thread per VU
 │    └── VirtualUser      Independent fetch loop, no shared mutable state
 ├── MetricsAggregator    SharedArrayBuffer — lock-free, no IPC on hot path
 │    ├── HDRHistogram     Per-endpoint latency distribution
 │    ├── RpsCounter       Sliding window throughput
 │    └── ErrorClassifier  4xx / 5xx / timeout / connection refused
 └── LoadReporter
      ├── LiveConsole      Refreshes every 250ms during run
      └── LoadReport       HTML with charts + JSON for CI artifacts
```

---

## Multi-Region Performance Testing

> Planned for v1.3

**The gap:** Datadog Synthetics, Checkly, New Relic Synthetics, k6 Cloud all do multi-region testing — all paid SaaS. No credible open-source option exists. ReqProbe fills this.

### Phase 1: GitHub Actions Matrix (Open-Source, Zero Infrastructure)

```bash
reqprobe generate ci --multi-region --provider github
```

Generates a GitHub Actions workflow that runs your tests in parallel across GitHub-hosted runners on different continents, uploads JSON reports as artifacts, and produces a unified multi-region comparison report.

```yaml
# Generated: .github/workflows/reqprobe-multi-region.yml
strategy:
  matrix:
    region: [us-east, eu-west, ap-southeast]
```

### Phase 2: Self-Hostable Agent Network

Deploy a lightweight agent anywhere — your own VMs, cloud instances, on-prem servers.

```bash
# On your EU server:
reqprobe-agent --bind 0.0.0.0:7432 --token $SECRET

# Run from anywhere:
reqprobe cloud run \
  --agents us-east:https://agent.us.company.com,eu-west:https://agent.eu.company.com \
  --test ./api.test.ts
```

The controller distributes test bundles, collects results, and generates a unified multi-region report. 100% self-hostable. No ReqProbe cloud dependency.

### Multi-Region Report

```
Multi-Region Results — POST /users                     2024-01-15 14:32:00 UTC

Region          p50     p95     p99     TTFB    DNS     TLS     Errors
us-east-1       48ms    89ms    142ms   31ms    2ms     8ms     0.0%
eu-west-1       92ms    167ms   241ms   74ms    3ms     11ms    0.1%
ap-southeast-1  187ms   312ms   489ms   142ms   8ms     24ms    0.8%   ⚠

Bottleneck: ap-southeast-1 — high TLS overhead suggests no session resumption
Recommendation: Verify CDN is configured with TLS session tickets for APAC edge nodes.

Global p95: 167ms  |  Worst region: ap-southeast-1  |  Global availability: 99.7%
```

### Metrics Per Region

| Metric | Why it matters |
|---|---|
| DNS resolution time | Each region resolves from different nameservers — reveals routing gaps |
| TLS handshake time | High TLS overhead often means CDN session resumption is broken |
| TTFB | Separates server processing time from network |
| Cold vs warm latency | First request vs subsequent — reveals CDN warming behavior |
| Availability by region | Global 99.9% can hide 97% from a specific region |
| Error rate by region | Regional errors often indicate routing misconfiguration |

---

## Comparison with Alternatives

| Dimension | ReqProbe | Postman | Bruno | k6 | Artillery | Datadog Synthetics |
|---|---|---|---|---|---|---|
| Tests are real code | TypeScript | JS sandbox | DSL file | JS | YAML + JS | GUI |
| Git-native | Yes | No | Yes | Yes | Yes | No |
| OpenAPI contract testing | Built-in | Manual | No | No | No | No |
| Schema-driven load testing | Planned | No | No | No | No | No |
| Multi-region testing | Planned (OSS) | No | No | Paid (k6 Cloud) | No | Paid |
| Schema fuzzing | Built-in | No | No | No | No | No |
| Self-hostable | Yes | Partial | Yes | Yes | Yes | No |
| Open source | Yes | No | Yes | Yes | Yes | No |
| Cost | Free | Paid tiers | Free | Free | Free | $15+/test/mo |

---

## Contributing

The highest-leverage contributions right now are in **v1.1**:

- `parallel-execution` — worker thread model for concurrent file execution
- `junit-reporter` — ~30 lines, highest CI adoption impact
- `tag-filtering` — parse `@tag` from test names, filter on CLI
- `ctx-api-poll` — async polling with configurable interval and predicate
- `auth-helpers` — Bearer, Basic, OAuth2, API Key in config

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions and project conventions.

Open an issue tagged `roadmap` to discuss prioritization, propose new items, or share use cases that aren't covered.

---

## Versioning

ReqProbe follows [Semantic Versioning](https://semver.org/).

- **Patch** (1.0.x) — bug fixes, no API changes
- **Minor** (1.x.0) — new features, backwards compatible
- **Major** (x.0.0) — breaking changes to config schema or test API (rare, announced early)

Config files and test files written for v1.0 will work on all v1.x releases.

---

*MIT License — Shashidhar Naik*
