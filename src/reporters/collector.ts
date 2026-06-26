import { TestResult } from '../types/index.js';
import { ReportResult, ReportSuite, ReportSummary } from './types.js';

export class ResultCollector {
    private suites: ReportSuite[] = [];

    /**
     * Converts a TestResult[] from the runner into a ReportSuite and stores it.
     * @param name       Suite name (from TestSuite.name or file basename)
     * @param results    Raw TestResult[] from TestRunner.runTests()
     * @param duration   Total wall-clock time for the suite in ms
     */
    addSuite(name: string, results: TestResult[], duration: number): void {
        const reportResults: ReportResult[] = results.map((r) => ({
            name: r.name,
            status: r.passed ? 'pass' : 'fail',
            duration: r.duration,
            error: r.error?.message,
            responseBody: r.response?.body,
        }));

        this.suites.push({
            name,
            results: reportResults,
            passed: reportResults.filter((r) => r.status === 'pass').length,
            failed: reportResults.filter((r) => r.status === 'fail').length,
            duration,
        });
    }

    /**
     * Returns the final aggregated report summary.
     */
    getSummary(): ReportSummary {
        const totalPassed = this.suites.reduce((n, s) => n + s.passed, 0);
        const totalFailed = this.suites.reduce((n, s) => n + s.failed, 0);
        const totalDuration = this.suites.reduce((n, s) => n + s.duration, 0);

        // Calculate timing metrics
        const allDurations = this.suites.flatMap((s) => s.results.map((r) => r.duration));
        const hasDurations = allDurations.length > 0;
        const minResponseTime = hasDurations ? Math.min(...allDurations) : 0;
        const maxResponseTime = hasDurations ? Math.max(...allDurations) : 0;
        const avgResponseTime = hasDurations
            ? Math.round(allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length)
            : 0;

        return {
            timestamp: new Date().toISOString(),
            totalPassed,
            totalFailed,
            totalTests: totalPassed + totalFailed,
            totalDuration,
            suites: this.suites,
            performance: {
                avgResponseTime,
                minResponseTime,
                maxResponseTime,
            },
        };
    }
}
