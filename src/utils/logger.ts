import pc from 'picocolors';
import type { HttpRequest, HttpResponse } from '../types/index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function indent(text: string, spaces = 4): string {
    const pad = ' '.repeat(spaces);
    return text.split('\n').map(line => pad + line).join('\n');
}

function truncateBody(body: unknown, maxLen = 400): string {
    const str = typeof body === 'string'
        ? body
        : JSON.stringify(body, null, 2);
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + pc.dim(`\n  … (${str.length - maxLen} more chars)`);
}

function inlineBody(body: unknown, maxLen = 200): string {
    const str = typeof body === 'string' ? body : JSON.stringify(body);
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + pc.dim(` … (+${str.length - maxLen} chars)`);
}

const HTTP_STATUS_TEXT: Record<number, string> = {
    200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
    404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
    422: 'Unprocessable Entity', 429: 'Too Many Requests',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
};

// ─── Logger ───────────────────────────────────────────────────────────────────

export const logger = {

    info: (msg: string) =>
        console.log(pc.blue('ℹ ') + msg),

    success: (msg: string) =>
        console.log(pc.green('✔ ') + msg),

    warn: (msg: string) =>
        console.log(pc.yellow('⚠ ') + msg),

    dim: (msg: string) =>
        console.log(pc.dim(msg)),

    step: (msg: string) => {
        console.log('');
        console.log(pc.bold(pc.cyan('❯ ')) + pc.bold(msg));
    },

    error: (msg: string, detail?: any) => {
        console.log(pc.red('✘ ') + msg);
        if (detail) {
            if (detail instanceof Error) {
                console.log(pc.dim(indent(detail.stack || detail.message)));
            } else {
                console.log(pc.dim(indent(JSON.stringify(detail, null, 2))));
            }
        }
    },

    // ── Per-test output ────────────────────────────────────────────────────────

    testPass: (name: string, duration: number) => {
        console.log(
            `  ${pc.green('✓')} ${pc.white(name)} ${pc.dim(formatDuration(duration))}`
        );
    },

    testFail: (
        name: string,
        duration: number,
        error: any,
        lastRequest?: HttpRequest,
        sentHeaders?: Record<string, string>,
        lastResponse?: HttpResponse,
        baseUrl?: string,
    ) => {
        console.log(
            `\n  ${pc.red('✖')} ${pc.bold(pc.white(name))} ${pc.dim(formatDuration(duration))}`
        );
        console.log('');

        // ── Request block ──────────────────────────────────────────────────────
        if (lastRequest) {
            const method = lastRequest.method ?? 'GET';
            let fullUrl = lastRequest.url;
            if (baseUrl && !lastRequest.url.startsWith('http')) {
                try { fullUrl = new URL(lastRequest.url, baseUrl).toString(); } catch { /* use raw url */ }
            }

            const hasHeaders = sentHeaders && Object.keys(sentHeaders).length > 0;
            const hasBody    = lastRequest.body !== undefined;

            console.log(`    ${pc.bold('Request')}`);
            console.log(`    ${pc.dim(hasHeaders || hasBody ? '├' : '└')} ${pc.cyan(method)} ${fullUrl}`);

            if (hasHeaders) {
                const headerStr = JSON.stringify(sentHeaders);
                console.log(`    ${pc.dim(hasBody ? '├' : '└')} ${pc.dim('Headers:')} ${pc.dim(headerStr)}`);
            }

            if (hasBody) {
                console.log(`    ${pc.dim('└')} ${pc.dim('Body:')} ${pc.dim(inlineBody(lastRequest.body))}`);
            }

            console.log('');
        }

        // ── Response block ─────────────────────────────────────────────────────
        if (lastResponse) {
            const statusText  = lastResponse.statusText || HTTP_STATUS_TEXT[lastResponse.status] || '';
            const statusLine  = `${lastResponse.status}${statusText ? ' ' + statusText : ''}`;
            const statusColor = lastResponse.status >= 500 ? pc.red
                              : lastResponse.status >= 400 ? pc.yellow
                              : pc.green;

            const contentType = lastResponse.headers['content-type'] ?? lastResponse.headers['Content-Type'];
            const hasBody     = lastResponse.body !== undefined;
            const hasType     = !!contentType;

            console.log(`    ${pc.bold('Response')}`);
            console.log(`    ${pc.dim(hasType || hasBody ? '├' : '└')} ${statusColor(statusLine)}`);

            if (hasType) {
                console.log(`    ${pc.dim(hasBody ? '├' : '└')} ${pc.dim('Content-Type:')} ${pc.dim(contentType)}`);
            }

            if (hasBody) {
                const bodyStr = truncateBody(lastResponse.body);
                console.log(`    ${pc.dim('└')} ${pc.dim('Body:')}`);
                bodyStr.split('\n').forEach(line => {
                    console.log(`        ${pc.dim(line)}`);
                });
            }

            console.log('');
        }

        // ── Assertion block ────────────────────────────────────────────────────
        console.log(`    ${pc.bold('Assertion')}`);
        if (error?.expected !== undefined || error?.actual !== undefined) {
            console.log(`    ${pc.dim('├')} ${pc.dim('Expected:')} ${pc.green(JSON.stringify(error.expected))}`);
            console.log(`    ${pc.dim('└')} ${pc.dim('Received:')} ${pc.red(JSON.stringify(error.actual))}`);
        } else if (error?.message) {
            const lines = String(error.message).split('\n');
            lines.forEach((line, i) => {
                const connector = i === lines.length - 1 ? '└' : '├';
                console.log(`    ${pc.dim(connector)} ${pc.red(line)}`);
            });
        }

        console.log('');
    },

    // ── Suite separator ────────────────────────────────────────────────────────

    suiteHeader: (name: string) => {
        console.log('');
        console.log(pc.bold(pc.cyan('❯ ')) + pc.bold(name));
    },

    // ── Final summary ──────────────────────────────────────────────────────────

    summary: (passed: number, failed: number, total: number, duration: number) => {
        const line = '─'.repeat(40);
        const status = failed > 0
            ? pc.bgRed(pc.bold(' FAILED '))
            : pc.bgGreen(pc.bold(' PASSED '));

        console.log('\n' + pc.dim(line));
        console.log(`  ${status}  ${pc.dim(formatDuration(duration))}`);
        console.log(pc.dim(line));
        console.log(`  ${pc.green('✓ Passed ')} ${pc.bold(String(passed))}`);
        console.log(`  ${pc.red('✖ Failed ')} ${pc.bold(String(failed))}`);
        console.log(`  ${pc.dim('  Total  ')} ${pc.bold(String(total))}`);
        console.log(pc.dim(line) + '\n');
    },
};
