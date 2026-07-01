import { HttpRequest, HttpResponse, Config, PollOptions, RetryConfig } from '../types/index.js';

export class HttpClient {
    private tokenCache: { token: string; expiresAt: number } | null = null;

    constructor(private readonly config: Config = {}) { }

    private async getAuthHeaders(): Promise<Record<string, string>> {
        const auth = this.config.auth;
        if (!auth) return {};

        switch (auth.type) {
            case 'bearer':
                return { Authorization: `Bearer ${auth.token}` };

            case 'basic': {
                const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
                return { Authorization: `Basic ${encoded}` };
            }

            case 'api-key':
                return { [auth.header]: auth.value };

            case 'oauth2': {
                const now = Date.now();
                if (!this.tokenCache || now >= this.tokenCache.expiresAt) {
                    const body = new URLSearchParams({
                        grant_type: 'client_credentials',
                        client_id: auth.clientId,
                        client_secret: auth.clientSecret,
                        ...(auth.scopes?.length ? { scope: auth.scopes.join(' ') } : {}),
                    });
                    const res = await fetch(auth.tokenEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: body.toString(),
                    });
                    if (!res.ok) {
                        throw new Error(`OAuth2 token fetch failed: ${res.status} ${res.statusText}`);
                    }
                    const data = await res.json() as { access_token: string; expires_in?: number };
                    // Subtract 30s from expiry as a safety buffer
                    const ttl = data.expires_in ? (data.expires_in - 30) * 1000 : 3_570_000;
                    this.tokenCache = { token: data.access_token, expiresAt: now + ttl };
                }
                return { Authorization: `Bearer ${this.tokenCache.token}` };
            }
        }
    }

    async request(req: HttpRequest): Promise<HttpResponse> {
        let fullUrl = req.url;
        if (this.config.baseUrl && !req.url.startsWith('http')) {
            fullUrl = new URL(req.url, this.config.baseUrl).toString();
        }

        if (req.params) {
            const urlObj = new URL(fullUrl);
            Object.entries(req.params).forEach(([key, value]) => {
                urlObj.searchParams.append(key, value);
            });
            fullUrl = urlObj.toString();
        }

        const authHeaders = await this.getAuthHeaders();

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            // Auth is the baseline — config headers and per-request headers can override it
            ...authHeaders,
        };

        if (this.config.headers) {
            Object.entries(this.config.headers).forEach(([key, value]) => {
                if (value !== undefined) headers[key] = value;
            });
        }

        if (req.headers) {
            Object.entries(req.headers).forEach(([key, value]) => {
                if (value !== undefined) headers[key] = value;
            });
        }

        const retryConfig: RetryConfig | undefined = req.retry ?? this.config.retry;
        return this._fetchWithRetry(req, fullUrl, headers, retryConfig);
    }

    private async _fetchWithRetry(
        req: HttpRequest,
        fullUrl: string,
        headers: Record<string, string>,
        retry: RetryConfig | undefined,
    ): Promise<HttpResponse> {
        const maxAttempts = retry ? retry.times + 1 : 1;
        const delay       = retry?.delay ?? 500;
        const retryOn     = retry?.on;

        let lastResponse: HttpResponse | undefined;
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (attempt > 0 && delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            try {
                const res = await this._doFetch(req, fullUrl, headers);

                // If status matches retry list and we have attempts left — retry
                if (retryOn?.includes(res.status) && attempt < maxAttempts - 1) {
                    lastResponse = res;
                    continue;
                }

                return res;
            } catch (err: any) {
                lastError = err;
                if (attempt < maxAttempts - 1) continue;
            }
        }

        // All attempts exhausted — return last response if available, else throw
        if (lastResponse) return lastResponse;
        throw lastError;
    }

    private async _doFetch(req: HttpRequest, fullUrl: string, headers: Record<string, string>): Promise<HttpResponse> {
        const start = performance.now();

        try {
            const response = await fetch(fullUrl, {
                method: req.method || 'GET',
                headers,
                body: req.body ? JSON.stringify(req.body) : undefined,
                signal: this.config.timeout ? AbortSignal.timeout(this.config.timeout) : undefined,
            });

            const contentType = response.headers.get('content-type');
            let body: any;

            if (contentType?.includes('application/json')) {
                body = await response.json();
            } else {
                body = await response.text();
            }

            const duration = Math.round(performance.now() - start);

            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            return {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                body,
                duration,
            };
        } catch (error: any) {
            const duration = Math.round(performance.now() - start);
            const err = new Error(error.message ?? String(error));
            (err as any).duration = duration;
            (err as any).cause = error;
            throw err;
        }
    }

    async poll(url: string, options: PollOptions): Promise<HttpResponse> {
        const { until, interval = 1000, timeout = 30_000 } = options;
        const deadline = Date.now() + timeout;

        while (true) {
            const res = await this.request({ url, method: 'GET' });
            if (until(res)) return res;

            if (Date.now() >= deadline) {
                throw new Error(`poll() timed out after ${timeout}ms — condition never met for ${url}`);
            }

            // Don't sleep past the deadline
            const wait = Math.min(interval, deadline - Date.now());
            if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
        }
    }

    async get(url: string, options?: { headers?: Record<string, string>; params?: Record<string, string> }): Promise<HttpResponse> {
        return this.request({ url, method: 'GET', headers: options?.headers, params: options?.params });
    }

    async post(url: string, body?: any, options?: { headers?: Record<string, string>; params?: Record<string, string> }): Promise<HttpResponse> {
        return this.request({ url, method: 'POST', body, headers: options?.headers, params: options?.params });
    }

    async put(url: string, body?: any, options?: { headers?: Record<string, string>; params?: Record<string, string> }): Promise<HttpResponse> {
        return this.request({ url, method: 'PUT', body, headers: options?.headers, params: options?.params });
    }

    async patch(url: string, body?: any, options?: { headers?: Record<string, string>; params?: Record<string, string> }): Promise<HttpResponse> {
        return this.request({ url, method: 'PATCH', body, headers: options?.headers, params: options?.params });
    }

    async delete(url: string, options?: { headers?: Record<string, string>; params?: Record<string, string> }): Promise<HttpResponse> {
        return this.request({ url, method: 'DELETE', headers: options?.headers, params: options?.params });
    }
}
