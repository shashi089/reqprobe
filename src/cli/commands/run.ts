import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import glob from 'fast-glob';
import { ConfigLoader } from '../../config/loader.js';
import { TestRunner } from '../../runner/index.js';
import { logger } from '../../utils/logger.js';
import { TestCase, TestSuite, SuiteHooks } from '../../types/index.js';
import { ResultCollector } from '../../reporters/collector.js';
import { runReporters } from '../../reporters/index.js';
import { FileWatcher } from '../../watcher/file-watcher.js';
import { registry } from '../../dsl/registry.js';

export interface RunOptions {
    watch?: boolean;
    tag?: string;
    skip?: string;
    workers?: string;
}

/**
 * Run N async tasks with at most `maxWorkers` running concurrently.
 * Results are returned in the same order as `tasks`.
 */
async function runWithConcurrency<T>(
    tasks: Array<() => Promise<T>>,
    maxWorkers: number
): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    const indexed = tasks.map((task, i) => ({ task, i }));
    const queue   = [...indexed];

    async function worker() {
        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) break;
            results[item.i] = await item.task();
        }
    }

    const poolSize = Math.min(maxWorkers, tasks.length);
    await Promise.all(Array.from({ length: poolSize }, worker));
    return results;
}

type SuiteBundle = { suiteName: string; tests: TestCase[]; hooks: SuiteHooks };

async function loadBundle(
    file: string,
    filterTags: string[],
    skipTags: string[]
): Promise<SuiteBundle | null> {
    registry.clear();
    const mod = await import(pathToFileURL(file).toString() + `?t=${Date.now()}`);

    let tests: TestCase[] = registry.getTests();

    if (tests.length === 0 && mod.default && Array.isArray(mod.default.tests)) {
        tests = (mod.default as TestSuite).tests;
    }

    if (tests.length === 0) return null;

    if (filterTags.length > 0) tests = tests.filter(t => t.tags?.some(tag => filterTags.includes(tag)));
    if (skipTags.length > 0)   tests = tests.filter(t => !t.tags?.some(tag => skipTags.includes(tag)));

    if (tests.length === 0) return null;

    return {
        suiteName: (mod.default as TestSuite)?.name ?? path.basename(file),
        tests,
        hooks: {
            beforeAlls:  registry.getBeforeAlls(),
            afterAlls:   registry.getAfterAlls(),
            beforeEachs: registry.getBeforeEachs(),
            afterEachs:  registry.getAfterEachs(),
        },
    };
}

export async function runHandler(pattern: string = '**/*.test.ts', options: RunOptions = {}) {
    const configPath = path.resolve(process.cwd(), 'reqprobe.config.ts');
    const testsDir   = path.resolve(process.cwd(), 'tests');

    // Parse CLI options
    const filterTags = options.tag  ? options.tag.split(',').map(t => t.trim()).filter(Boolean) : [];
    const skipTags   = options.skip ? options.skip.split(',').map(t => t.trim()).filter(Boolean) : [];
    const workers    = Math.max(1, Number.parseInt(options.workers ?? '1', 10) || 1);

    // Self-relaunch with tsx when TypeScript files are detected but tsx isn't active
    const isTsxActive = (() => {
        const idx = process.execArgv.indexOf('--import');
        return idx !== -1 && process.execArgv[idx + 1] === 'tsx';
    })();

    if (!isTsxActive) {
        const testFiles = await glob(pattern, { absolute: true });
        const hasTsFiles =
            fs.existsSync(configPath) ||
            testFiles.some(f => f.endsWith('.ts') || f.endsWith('.tsx'));

        if (hasTsFiles) {
            const nodeArgs = ['--import', 'tsx', process.argv[1], ...process.argv.slice(2)];
            const child = spawn(process.execPath, nodeArgs, { stdio: 'inherit', env: process.env });
            const exitCode = await new Promise<number>(resolve => child.on('exit', code => resolve(code ?? 1)));
            process.exit(exitCode);
        }
    }

    const executeTests = async (): Promise<boolean> => {
        const loader  = new ConfigLoader();
        const config  = await loader.loadConfig();
        const runner  = new TestRunner(config);
        const collector = new ResultCollector();

        const testFiles = await glob(pattern, { absolute: true });

        if (testFiles.length === 0) {
            logger.warn(`No test files found matching: ${pattern}`);
            return false;
        }

        const startTime = performance.now();

        // ── Phase 1: sequential import ────────────────────────────────────────
        // Imports must be sequential: the registry is a module-level singleton
        // so concurrent imports would corrupt each other's test lists.

        const bundles: SuiteBundle[] = [];

        for (const file of testFiles) {
            try {
                const bundle = await loadBundle(file, filterTags, skipTags);
                if (bundle) {
                    bundles.push(bundle);
                } else {
                    logger.warn(`Skipping ${path.basename(file)}: no tests found or none match tag filter`);
                }
            } catch (error: any) {
                logger.error(`Failed to load test file: ${file}`, error);
                collector.addSuite(path.basename(file), [{ name: 'load error', passed: false, duration: 0, error }], 0);
            }
        }

        registry.clear();

        // ── Phase 2: concurrent execution ─────────────────────────────────────
        // Each suite runs independently — they captured their own hooks above
        // and share only a read-only TestRunner instance (safe).

        const tasks = bundles.map(bundle => async () => {
            const suiteStart = performance.now();
            const results    = await runner.runTests(bundle.tests, bundle.suiteName, bundle.hooks);
            const duration   = Math.round(performance.now() - suiteStart);
            return { bundle, results, duration };
        });

        const completed = await runWithConcurrency(tasks, workers);

        let totalPassed = 0;
        let totalFailed = 0;

        for (const { bundle, results, duration } of completed) {
            collector.addSuite(bundle.suiteName, results, duration);
            totalPassed += results.filter(r => r.passed).length;
            totalFailed += results.filter(r => !r.passed).length;
        }

        const totalDuration = Math.round(performance.now() - startTime);
        logger.summary(totalPassed, totalFailed, totalPassed + totalFailed, totalDuration);

        await runReporters(collector.getSummary(), config.reporters);

        return totalFailed === 0;
    };

    if (options.watch) {
        const watcher = new FileWatcher(async () => { await executeTests(); });
        watcher.watch(testsDir, configPath);
    } else {
        const success = await executeTests();
        if (!success) process.exit(1);
    }
}
