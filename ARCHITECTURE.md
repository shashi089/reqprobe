# reqprobe — Architecture Overview

## Module Structure

```
src/
├── types/        Shared TypeScript contracts (Config, TestCase, HttpResponse, …)
├── config/       Config file loader (.env + per-environment reqprobe.config.{env}.ts)
├── request/      HTTP client (fetch-based, Node 18+, auth helpers, poll())
├── assertions/   Assertion library (toBe, toEqual, toHaveStatus, toRespondWithin, …)
├── dsl/          Global test() DSL + beforeAll/beforeEach/afterEach/afterAll hooks
├── runner/       Test orchestrator — context injection, hook execution, OpenAPI validation
├── openapi/      Spec loading, $ref resolution, Ajv validation, schema fuzzing
├── reporters/    HTML, JSON, JUnit XML report generation
├── cli/          CLI commands: run, init, generate, fuzz
├── watcher/      File-change detection for --watch mode
└── utils/        Colored logger (picocolors)
```

**Dependency rule:** each module only imports from modules below it in this list.
No circular dependencies. No DI framework.

---

## Test Discovery & Execution

### 1. Glob-Based Discovery

```typescript
// Default pattern: **/*.test.ts
const testFiles = await glob(pattern, { absolute: true });
```

### 2. Sequential Import (Registry Pattern)

Imports are **intentionally sequential**. The registry is a module-level singleton — concurrent imports would corrupt each other's test lists.

```typescript
for (const file of testFiles) {
    registry.clear();
    await import(pathToFileURL(file).toString() + `?t=${Date.now()}`);
    // Importing the file triggers top-level test() calls, which self-register
    const tests  = registry.getTests();
    const hooks  = { beforeAlls: registry.getBeforeAlls(), ... };
    bundles.push({ suiteName, tests, hooks });
}
```

The `?t=${Date.now()}` cache-busts each import so watch mode re-executes files correctly.

### 3. Concurrent Execution (--workers)

After all files are imported and their tests + hooks captured, suites run concurrently up to `--workers` limit. Because hooks are captured per-file before clearing the registry, suites are fully isolated from each other even when running in parallel.

```typescript
const completed = await runWithConcurrency(suiteRunners, workers);
// workers = 1 (default, sequential) or N (parallel, I/O-bound speedup)
```

---

## Context Injection

Each test receives a fresh `TestContext`. The context wraps the shared `HttpClient` in a closure that also triggers OpenAPI validation on every response.

```typescript
// From src/runner/index.ts
const makeRequest = async (req: HttpRequest): Promise<HttpResponse> => {
    const res = await client.request(req);        // HTTP call
    await validator?.validate(method, path, status, body);  // OpenAPI check
    return res;
};

const ctx: TestContext = {
    request: requestClient,   // callable + .get/.post/.put/.patch/.delete/.poll
    api: requestClient,       // alias
    expect,                   // assertion library
    fuzz: fuzzHelper,         // schema-driven payload generator
};
```

### Writing Tests

```typescript
import { test, expect } from 'reqprobe/dsl';

test('GET /users @smoke', async (ctx) => {
    const res = await ctx.api.get('/users');
    ctx.expect(res).toHaveStatus(200);
    ctx.expect(res.body).toHaveProperty('data');
});

// Destructuring also works:
test('POST /users @regression', async ({ api, expect }) => {
    const res = await api.post('/users', { name: 'Alice', email: 'alice@example.com' });
    expect(res).toHaveStatus(201);
});
```

---

## Auth Flow

Auth is configured once in `reqprobe.config.ts` and applied to every request automatically. The `HttpClient` fetches and caches OAuth2 tokens transparently.

```typescript
auth: { type: 'bearer', token: process.env.API_TOKEN }
// or: 'basic', 'api-key', 'oauth2' (client_credentials, token cached + refreshed)
```

Priority (lowest → highest): `auth` < `config.headers` < per-request `headers`.

---

## OpenAPI Contract Validation

When `config.openapi.specPath` is set, every `ctx.api.*` call is automatically validated against the spec after the response arrives — no extra assertions needed.

```
Request → HttpClient.request() → response
                                     ↓
                          OpenApiValidator.validate()
                            → extractSchema(method, path, status)
                            → resolveRefs(schema)
                            → Ajv.validate(schema, body)
                            → throw detailed error if invalid
```

`strict: false` silently skips endpoints not in the spec (good for partial specs).
`strict: true` throws if no schema is found.

---

## Schema Fuzzing

`SchemaFuzzer` generates realistic payloads from an OpenAPI request body schema. It handles `allOf`/`anyOf`/`oneOf`, string formats (uuid, email, date-time), enums, min/max, and nested objects. Injected into test context as `ctx.fuzz`.

```typescript
test('fuzz POST /users', async (ctx) => {
    const payload = ctx.fuzz.generate('/users', 'POST');
    const res = await ctx.api.post('/users', payload);
    ctx.expect(res).toHaveStatus(201);
});
```

The CLI `reqprobe fuzz --from openapi.json` runs every endpoint automatically with generated payloads, flagging 5xx responses as failures.

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Registry pattern (self-registering tests) | Enables the clean `test()` DSL without explicit exports |
| Sequential import, concurrent execution | Avoids registry race conditions while still parallelising I/O-bound HTTP calls |
| Hooks captured per-file before registry.clear() | Makes parallel suite execution safe — no shared mutable hook state |
| Auth applied in HttpClient, not in tests | Keeps tests clean; auth is an infrastructure concern |
| OpenAPI validation in makeRequest closure | Every request is validated automatically; no test code changes needed |
| 6 runtime dependencies | Intentional minimal footprint — ajv, commander, dotenv, fast-glob, picocolors, tsx |
