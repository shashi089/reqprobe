import { ReporterConfig } from '../types/index.js';
import { ReportSummary } from './types.js';
import { writeJsonReport } from './json.js';
import { writeHtmlReport } from './html.js';
import { writeJunitReport } from './junit.js';

const DEFAULT_OUT_DIR = './reqprobe-reports';

export async function runReporters(
    summary: ReportSummary,
    reporterConfig: ReporterConfig | undefined
): Promise<void> {
    if (!reporterConfig) return;

    const outDir = reporterConfig.outDir ?? DEFAULT_OUT_DIR;

    if (reporterConfig.json)  writeJsonReport(summary, outDir);
    if (reporterConfig.html)  writeHtmlReport(summary, outDir);
    if (reporterConfig.junit) writeJunitReport(summary, outDir);
}
