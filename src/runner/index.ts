import { TestResult, TestContext, Config, TestCase, HttpRequest, HttpResponse, HttpClientLike, SuiteHooks, PollOptions, RequestOptions } from '../types/index.js';
import { HttpClient } from '../request/client.js';
import { expect } from '../assertions/index.js';
import { logger } from '../utils/logger.js';
import { OpenApiValidator } from '../openapi/index.js';
import { registry } from '../dsl/registry.js';
import { FuzzHelper } from '../openapi/fuzzer.js';

export class TestRunner {
    private readonly client: HttpClient;
    private readonly openApiValidator: OpenApiValidator | null = null;
    private readonly fuzzHelper: FuzzHelper | null = null;

    constructor(private readonly config: Config) {
        this.client = new HttpClient(config);
        if (config.openapi) {
            this.openApiValidator = new OpenApiValidator(config.openapi);
            this.fuzzHelper = new FuzzHelper(this.openApiValidator.getSpec());
        }
    }

    /**
     * Run a suite of tests.
     *
     * When `hooks` is provided (parallel mode), it uses the captured per-file hooks
     * instead of reading from the global registry — this prevents cross-suite hook
     * contamination when suites run concurrently.
     */
    async runTests(tests: TestCase[], suiteName: string, hooks?: SuiteHooks): Promise<TestResult[]> {
        const results: TestResult[] = [];

        logger.suiteHeader(suiteName);

        const beforeAlls  = hooks?.beforeAlls  ?? registry.getBeforeAlls();
        const afterAlls   = hooks?.afterAlls   ?? registry.getAfterAlls();
        const beforeEachs = hooks?.beforeEachs ?? registry.getBeforeEachs();
        const afterEachs  = hooks?.afterEachs  ?? registry.getAfterEachs();

        // beforeAll hooks
        try {
            for (const hook of beforeAlls) await hook();
        } catch (error: any) {
            logger.error(`Error in beforeAll hook for suite ${suiteName}`, error);
            results.push({ name: 'beforeAll hook', passed: false, duration: 0, error });
            return results;
        }

        for (const test of tests) {
            // beforeEach hooks
            try {
                for (const hook of beforeEachs) await hook();
            } catch (error: any) {
                logger.error(`Error in beforeEach hook for test ${test.name}`, error);
                results.push({ name: `beforeEach hook for ${test.name}`, passed: false, duration: 0, error });
                continue;
            }

            const testStartTime = performance.now();
            let lastRequest:  HttpRequest  | undefined;
            let lastResponse: HttpResponse | undefined;

            try {
                const validator = this.openApiValidator;
                const client    = this.client;
                const baseUrl   = this.config.baseUrl;

                const makeRequest = async (req: HttpRequest): Promise<HttpResponse> => {
                    lastRequest  = req;
                    const res = await client.request(req);
                    lastResponse = res;

                    if (validator) {
                        let requestPath = req.url;
                        try {
                            requestPath = new URL(req.url, baseUrl || 'http://localhost').pathname;
                        } catch {
                            // If URL parsing fails, use raw url as-is
                        }
                        await validator.validate(req.method ?? 'GET', requestPath, res.status, res.body);
                    }

                    return res;
                };

                const pollFn = async (url: string, options: PollOptions): Promise<HttpResponse> => {
                    const { until, interval = 1000, timeout = 30_000 } = options;
                    const deadline = Date.now() + timeout;

                    while (true) {
                        const res = await makeRequest({ url, method: 'GET' });
                        if (until(res)) return res;

                        if (Date.now() >= deadline) {
                            throw new Error(`poll() timed out after ${timeout}ms — condition never met for ${url}`);
                        }

                        const wait = Math.min(interval, deadline - Date.now());
                        if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
                    }
                };

                const requestFn = async (req: HttpRequest): Promise<HttpResponse> => makeRequest(req);

                const requestClient = Object.assign(requestFn, {
                    request: makeRequest,
                    poll: pollFn,
                    get: (url: string, opts?: RequestOptions) =>
                        makeRequest({ url, method: 'GET', headers: opts?.headers, params: opts?.params, retry: opts?.retry }),
                    post: (url: string, body?: any, opts?: RequestOptions) =>
                        makeRequest({ url, method: 'POST', body, headers: opts?.headers, params: opts?.params, retry: opts?.retry }),
                    put: (url: string, body?: any, opts?: RequestOptions) =>
                        makeRequest({ url, method: 'PUT', body, headers: opts?.headers, params: opts?.params, retry: opts?.retry }),
                    patch: (url: string, body?: any, opts?: RequestOptions) =>
                        makeRequest({ url, method: 'PATCH', body, headers: opts?.headers, params: opts?.params, retry: opts?.retry }),
                    delete: (url: string, opts?: RequestOptions) =>
                        makeRequest({ url, method: 'DELETE', headers: opts?.headers, params: opts?.params, retry: opts?.retry }),
                }) as HttpClientLike;

                const ctx: TestContext = {
                    request: requestClient,
                    api: requestClient,
                    expect,
                    fuzz: this.fuzzHelper || new FuzzHelper({}),
                };

                await test.run(ctx);

                const duration = Math.round(performance.now() - testStartTime);
                logger.testPass(test.name, duration);
                results.push({ name: test.name, passed: true, duration });

            } catch (error: any) {
                const duration = Math.round(performance.now() - testStartTime);

                // Build display headers with auth values masked so no secrets leak to console
                let sentHeaders: Record<string, string> | undefined;
                if (lastRequest) {
                    sentHeaders = { 'Content-Type': 'application/json' };
                    const auth = this.config.auth;
                    if (auth) {
                        switch (auth.type) {
                            case 'bearer':  sentHeaders['Authorization'] = 'Bearer ***'; break;
                            case 'basic':   sentHeaders['Authorization'] = 'Basic ***';  break;
                            case 'api-key': sentHeaders[auth.header]     = '***';         break;
                            case 'oauth2':  sentHeaders['Authorization'] = 'Bearer ***'; break;
                        }
                    }
                    if (this.config.headers) {
                        for (const [k, v] of Object.entries(this.config.headers)) {
                            if (v !== undefined) sentHeaders[k] = v;
                        }
                    }
                    if (lastRequest.headers) {
                        for (const [k, v] of Object.entries(lastRequest.headers)) {
                            sentHeaders[k] = v;
                        }
                    }
                }

                logger.testFail(test.name, duration, error, lastRequest, sentHeaders, lastResponse, this.config.baseUrl);
                results.push({ name: test.name, passed: false, duration, error, request: lastRequest, response: lastResponse });
            } finally {
                // afterEach hooks — always run even if test threw
                try {
                    for (const hook of afterEachs) await hook();
                } catch (error: any) {
                    logger.error(`Error in afterEach hook for test ${test.name}`, error);
                }
            }
        }

        // afterAll hooks
        try {
            for (const hook of afterAlls) await hook();
        } catch (error: any) {
            logger.error(`Error in afterAll hook for suite ${suiteName}`, error);
        }

        return results;
    }
}
