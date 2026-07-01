export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface RetryConfig {
    /** Number of retry attempts after the first failure */
    times: number;
    /** Milliseconds to wait between retries (default: 500) */
    delay?: number;
    /** HTTP status codes that trigger a retry. If omitted, only network/timeout errors are retried. */
    on?: number[];
}

export interface HttpRequest {
    url: string;
    method?: HttpMethod;
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, string>;
    /** Per-request retry config — overrides the global config.retry */
    retry?: RetryConfig;
}

export interface HttpResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
    duration: number; // in ms
}

export interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    error?: Error;
    request?: HttpRequest;
    response?: HttpResponse;
}

export interface OpenApiConfig {
    specPath: string;
    strict?: boolean;
}

export interface ReporterConfig {
    outDir?: string;   // default: './reqprobe-reports'
    json?: boolean;    // write report.json
    html?: boolean;    // write report.html
    junit?: boolean;   // write report.xml (JUnit format for Jenkins/GitLab/Azure DevOps)
}

// Auth configuration — applied automatically to every request, no boilerplate in tests
export type AuthConfig =
    | { type: 'bearer'; token: string }
    | { type: 'basic'; username: string; password: string }
    | { type: 'api-key'; header: string; value: string }
    | { type: 'oauth2'; tokenEndpoint: string; clientId: string; clientSecret: string; scopes?: string[] };

export interface Config {
    baseUrl?: string;
    timeout?: number;
    headers?: Record<string, string | undefined>;
    auth?: AuthConfig;
    openapi?: OpenApiConfig;
    reporters?: ReporterConfig;
    /** Global retry config — applied to every request unless overridden per-request */
    retry?: RetryConfig;
}

export interface TestSuite {
    name: string;
    tests: TestCase[];
}

export interface TestCase {
    name: string;
    tags?: string[];
    run: (ctx: TestContext) => Promise<void>;
}

// Hooks captured per-file so parallel suite execution doesn't share state
export interface SuiteHooks {
    beforeAlls: Array<() => Promise<void> | void>;
    afterAlls: Array<() => Promise<void> | void>;
    beforeEachs: Array<() => Promise<void> | void>;
    afterEachs: Array<() => Promise<void> | void>;
}

export interface PollOptions {
    /** Predicate — polling stops when this returns true */
    until: (res: HttpResponse) => boolean;
    /** Milliseconds between polls (default: 1000) */
    interval?: number;
    /** Maximum wait time in milliseconds before throwing (default: 30000) */
    timeout?: number;
}

export type RequestOptions = {
    headers?: Record<string, string>;
    params?: Record<string, string>;
    retry?: RetryConfig;
};

export interface HttpClientLike {
    (req: HttpRequest): Promise<HttpResponse>;
    request(req: HttpRequest): Promise<HttpResponse>;
    get(url: string, options?: RequestOptions): Promise<HttpResponse>;
    post(url: string, body?: any, options?: RequestOptions): Promise<HttpResponse>;
    put(url: string, body?: any, options?: RequestOptions): Promise<HttpResponse>;
    patch(url: string, body?: any, options?: RequestOptions): Promise<HttpResponse>;
    delete(url: string, options?: RequestOptions): Promise<HttpResponse>;
    /** Poll a GET endpoint until a condition is met or timeout is reached */
    poll(url: string, options: PollOptions): Promise<HttpResponse>;
}

export interface TestContext {
    /** Fluent HTTP client — use request.get(), request.post(), request.delete() etc. */
    request: HttpClientLike;
    /** Alias for request (fluent HTTP client) */
    api: HttpClientLike;
    expect: any;
    /** OpenAPI fuzzer helper to generate mock request bodies */
    fuzz: any;
}
