import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { initHandler } from './commands/init.js';
import { runHandler } from './commands/run.js';
import { generateHandler } from './commands/generate.js';
import { fuzzHandler } from './commands/fuzz.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(__dirname, '../../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

export const program = new Command();

program
    .name('reqprobe')
    .description(pc.cyan('reqprobe: TypeScript-first CLI API testing framework'))
    .version(pkg.version, '-v, --version', pc.yellow('Show the current version'));

program
    .command('init')
    .description('Initialize a new reqprobe project')
    .action(async () => {
        await initHandler();
    });

program
    .command('run')
    .description('Run API tests')
    .argument('[pattern]', 'Glob pattern for test files', '**/*.test.ts')
    .option('-w, --watch', 'Watch files for changes and re-run tests')
    .option('--tag <tags>', 'Only run tests whose name contains these @tags (comma-separated, e.g. smoke,regression)')
    .option('--skip <tags>', 'Skip tests whose name contains these @tags (comma-separated, e.g. destructive)')
    .option('--workers <n>', 'Number of test files to run concurrently (default: 1)', '1')
    .action(async (pattern, options) => {
        await runHandler(pattern, options);
    });

program
    .command('generate')
    .description('Generate test stubs from OpenAPI spec')
    .requiredOption('--from <file>', 'Path to OpenAPI JSON file')
    .option('-f, --force', 'Overwrite existing files')
    .action(async (options) => {
        await generateHandler(options);
    });

program
    .command('fuzz')
    .description('Fuzz API endpoints with generated payloads based on OpenAPI spec')
    .requiredOption('--from <file>', 'Path to OpenAPI JSON file')
    .option('--url <url>', 'Override baseUrl')
    .action(async (options) => {
        await fuzzHandler(options);
    });

// Handle unknown commands
program.on('command:*', () => {
    console.error(pc.red('Invalid command: %s\nSee --help for a list of available commands.'), program.args.join(' '));
    process.exit(1);
});

export function runCLI() {
    if (process.argv.length <= 2) {
        program.help();
    }
    program.parse(process.argv);
}
