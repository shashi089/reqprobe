// Public type exports — use in reqprobe.config.ts and test files
export type {
    Config,
    AuthConfig,
    HttpMethod,
    HttpRequest,
    HttpResponse,
    TestResult,
    TestCase,
    TestSuite,
    TestContext,
    HttpClientLike,
    SuiteHooks,
    PollOptions,
    OpenApiConfig,
    ReporterConfig,
} from './types/index.js';

// DSL re-exported at root — supports both:
//   import { test } from 'req-probe'
//   import { test } from 'req-probe/dsl'
export { test, expect, beforeAll, beforeEach, afterEach, afterAll } from './dsl/index.js';
