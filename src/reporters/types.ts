/**
 * Internal report data model.
 * Decoupled from TestResult so reporters don't depend on runner internals.
 */

export interface ReportResult {
    name: string;
    status: 'pass' | 'fail';
    duration: number;
    error?: string;           // error.message only (serialisable)
    responseBody?: unknown;   // optional, captured from HttpResponse.body
}

export interface ReportSuite {
    name: string;
    results: ReportResult[];
    passed: number;
    failed: number;
    duration: number;         // total suite wall-clock time in ms
}

export interface ReportSummary {
    timestamp: string;        // ISO 8601
    totalPassed: number;
    totalFailed: number;
    totalTests: number;
    totalDuration: number;    // ms
    suites: ReportSuite[];
    performance?: {
        avgResponseTime: number;
        minResponseTime: number;
        maxResponseTime: number;
    };
}
