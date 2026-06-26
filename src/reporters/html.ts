import fs from 'node:fs';
import path from 'node:path';
import { ReportSummary, ReportSuite, ReportResult } from './types.js';
import { logger } from '../utils/logger.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function badge(status: 'pass' | 'fail'): string {
    const cls = status === 'pass' ? 'badge-pass' : 'badge-fail';
    return `<span class="badge ${cls}">${status.toUpperCase()}</span>`;
}

function formatDuration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

// ─── Suite Table ──────────────────────────────────────────────────────────────

function renderSuite(suite: ReportSuite, suiteIndex: number): string {
    const rows = suite.results.map((r: ReportResult, i: number) => {
        const rowId = `row-${suiteIndex}-${i}`;
        const errorHtml = r.error
            ? `<tr class="error-row" id="${rowId}">
                 <td colspan="3">
                   <pre class="error-pre">${esc(r.error)}</pre>
                   ${r.responseBody !== undefined
                ? `<pre class="response-pre">${esc(JSON.stringify(r.responseBody, null, 2))}</pre>`
                : ''}
                 </td>
               </tr>`
            : '';

        const clickAttr = r.error ? `onclick="toggle('${rowId}')" style="cursor:pointer"` : '';

        return `
        <tr class="test-row ${r.status}" ${clickAttr}>
          <td>${badge(r.status)}</td>
          <td class="test-name">${esc(r.name)}${r.error ? ' <span class="hint">▾ click for details</span>' : ''}</td>
          <td class="duration">${formatDuration(r.duration)}</td>
        </tr>
        ${errorHtml}`;
    }).join('');

    const suiteStatus = suite.failed > 0 ? 'fail' : 'pass';

    return `
    <section class="suite suite-${suiteStatus}">
      <div class="suite-header">
        <span class="suite-name">${esc(suite.name)}</span>
        <span class="suite-meta">
          ${suite.passed} passed &nbsp;·&nbsp; ${suite.failed} failed &nbsp;·&nbsp; ${formatDuration(suite.duration)}
        </span>
      </div>
      <table class="results-table">
        <thead>
          <tr><th>Status</th><th>Test</th><th>Duration</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

// ─── Full HTML Document ───────────────────────────────────────────────────────

function buildHtml(summary: ReportSummary): string {
    const overallStatus = summary.totalFailed > 0 ? 'FAILED' : 'PASSED';
    const statusClass = summary.totalFailed > 0 ? 'status-fail' : 'status-pass';
    const suitesHtml = summary.suites.map((s, i) => renderSuite(s, i)).join('\n');

    const date = new Date(summary.timestamp).toLocaleString();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>reqprobe Test Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #0f1117;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 2rem;
    }

    a { color: #63b3ed; }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #2d3748;
    }
    .brand { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.5px; color: #fff; }
    .brand span { color: #63b3ed; }
    .run-meta { font-size: 0.8rem; color: #718096; text-align: right; }

    /* ── Summary bar ── */
    .summary {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    .stat-card {
      background: #1a202c;
      border: 1px solid #2d3748;
      border-radius: 8px;
      padding: 1rem 1.5rem;
      min-width: 130px;
    }
    .stat-card .label { font-size: 0.72rem; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-card .value { font-size: 1.8rem; font-weight: 700; margin-top: 0.2rem; }
    .stat-card.overall .value { color: #fff; }
    .stat-card.passed  .value { color: #68d391; }
    .stat-card.failed  .value { color: #fc8181; }
    .stat-card.total   .value { color: #90cdf4; }
    .stat-card.time    .value { color: #fbd38d; font-size: 1.4rem; }
    .stat-card.performance .value { color: #f6ad55; font-size: 1.4rem; }

    .overall-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .status-pass { background: #276749; color: #c6f6d5; }
    .status-fail { background: #742a2a; color: #fed7d7; }

    /* ── Suite ── */
    .suite {
      background: #1a202c;
      border: 1px solid #2d3748;
      border-radius: 10px;
      margin-bottom: 1.5rem;
      overflow: hidden;
    }
    .suite-pass { border-left: 4px solid #48bb78; }
    .suite-fail { border-left: 4px solid #fc8181; }

    .suite-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.85rem 1.25rem;
      background: #171e2e;
      border-bottom: 1px solid #2d3748;
    }
    .suite-name { font-weight: 600; font-size: 0.95rem; }
    .suite-meta { font-size: 0.78rem; color: #718096; }

    /* ── Table ── */
    .results-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .results-table thead tr {
      background: #171e2e;
    }
    .results-table th {
      padding: 0.5rem 1rem;
      text-align: left;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #718096;
      border-bottom: 1px solid #2d3748;
    }
    .results-table td {
      padding: 0.6rem 1rem;
      border-bottom: 1px solid #1e2535;
      vertical-align: top;
    }
    .test-row:last-child td { border-bottom: none; }
    .test-row:hover { background: #1e2535; }
    .test-row.fail { background: rgba(252,129,129,0.04); }

    .test-name { width: 100%; }
    .duration  { white-space: nowrap; color: #718096; text-align: right; }

    /* ── Badge ── */
    .badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    .badge-pass { background: #276749; color: #c6f6d5; }
    .badge-fail { background: #742a2a; color: #fed7d7; }

    .hint { font-size: 0.72rem; color: #718096; margin-left: 0.4rem; }

    /* ── Error / Response rows ── */
    .error-row { display: none; }
    .error-row.open { display: table-row; }
    .error-row td { background: #1a0a0a; padding: 0.75rem 1.25rem; }

    .error-pre {
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      font-size: 0.8rem;
      color: #fc8181;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .response-pre {
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      font-size: 0.78rem;
      color: #90cdf4;
      white-space: pre-wrap;
      word-break: break-word;
      margin-top: 0.5rem;
      border-top: 1px solid #2d3748;
      padding-top: 0.5rem;
    }

    footer {
      margin-top: 2.5rem;
      text-align: center;
      font-size: 0.75rem;
      color: #4a5568;
    }
  </style>
</head>
<body>

  <header class="header">
    <div class="brand">api<span>x</span> report</div>
    <div class="run-meta">
      <div>${date}</div>
      <div style="margin-top:0.3rem">
        <span class="overall-badge ${statusClass}">${overallStatus}</span>
      </div>
    </div>
  </header>

  <div class="summary">
    <div class="stat-card passed">
      <div class="label">Passed</div>
      <div class="value">${summary.totalPassed}</div>
    </div>
    <div class="stat-card failed">
      <div class="label">Failed</div>
      <div class="value">${summary.totalFailed}</div>
    </div>
    <div class="stat-card total">
      <div class="label">Total</div>
      <div class="value">${summary.totalTests}</div>
    </div>
    <div class="stat-card time">
      <div class="label">Duration</div>
      <div class="value">${formatDuration(summary.totalDuration)}</div>
    </div>
    <div class="stat-card performance">
      <div class="label">Avg Latency</div>
      <div class="value">${summary.performance ? formatDuration(summary.performance.avgResponseTime) : '0ms'}</div>
    </div>
    <div class="stat-card performance">
      <div class="label">Min / Max</div>
      <div class="value" style="font-size: 1.1rem; margin-top: 0.5rem; color: #a0aec0;">
        ${summary.performance ? formatDuration(summary.performance.minResponseTime) : '0ms'} / ${summary.performance ? formatDuration(summary.performance.maxResponseTime) : '0ms'}
      </div>
    </div>
  </div>

  ${suitesHtml}

  <footer>Generated by <strong>reqprobe</strong> · ${date}</footer>

  <script>
    function toggle(id) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('open');
    }
  </script>
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a standalone HTML report and writes it to <outDir>/report.html.
 * No external dependencies — fully self-contained single file.
 */
export function writeHtmlReport(summary: ReportSummary, outDir: string): void {
    fs.mkdirSync(outDir, { recursive: true });

    const outPath = path.join(outDir, 'report.html');
    fs.writeFileSync(outPath, buildHtml(summary), 'utf-8');

    logger.dim(`HTML report written → ${outPath}`);
}
