import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ReportSummary } from './types.js';

function xmlEscape(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/'/g, '&apos;');
}

export function writeJunitReport(summary: ReportSummary, outDir: string): void {
    mkdirSync(outDir, { recursive: true });

    const suitesXml = summary.suites.map(suite => {
        const suiteTime = (suite.duration / 1000).toFixed(3);

        const casesXml = suite.results.map(r => {
            const caseTime = (r.duration / 1000).toFixed(3);
            const name = xmlEscape(r.name);
            const cls  = xmlEscape(suite.name);

            if (r.status === 'pass') {
                return `    <testcase name="${name}" classname="${cls}" time="${caseTime}" />`;
            }

            const msg = xmlEscape(r.error ?? 'Test failed');
            return `    <testcase name="${name}" classname="${cls}" time="${caseTime}">
      <failure message="${msg}">${msg}</failure>
    </testcase>`;
        }).join('\n');

        return `  <testsuite name="${xmlEscape(suite.name)}" tests="${suite.results.length}" failures="${suite.failed}" errors="0" skipped="0" time="${suiteTime}">
${casesXml}
  </testsuite>`;
    }).join('\n');

    const totalTime = (summary.totalDuration / 1000).toFixed(3);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="reqprobe" tests="${summary.totalTests}" failures="${summary.totalFailed}" errors="0" time="${totalTime}" timestamp="${summary.timestamp}">
${suitesXml}
</testsuites>`;

    writeFileSync(join(outDir, 'report.xml'), xml, 'utf-8');
}
