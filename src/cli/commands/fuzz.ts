import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { SchemaFuzzer } from '../../openapi/fuzzer.js';
import { HttpClient } from '../../request/client.js';
import { ConfigLoader } from '../../config/loader.js';
import { logger } from '../../utils/logger.js';

export async function fuzzHandler(options: { from: string; url?: string }) {
    console.log(pc.cyan(`⚡ Starting OpenAPI Contract Fuzzing...`));
    console.log(pc.dim(`Spec file: ${options.from}`));

    const fullPath = path.resolve(process.cwd(), options.from);
    if (!fs.existsSync(fullPath)) {
        console.error(pc.red(`Error: OpenAPI spec file not found at ${fullPath}`));
        process.exit(1);
    }

    let spec: any;
    try {
        spec = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    } catch (error: any) {
        console.error(pc.red(`Error: Failed to parse OpenAPI spec as JSON: ${error.message}`));
        process.exit(1);
    }

    // Load config to get default baseUrl / headers
    const loader = new ConfigLoader();
    const config = await loader.loadConfig();
    if (options.url) {
        config.baseUrl = options.url;
    }

    if (!config.baseUrl) {
        console.error(pc.red(`Error: Base URL not specified. Set baseUrl in reqprobe.config.ts or pass --url <url>`));
        process.exit(1);
    }

    console.log(pc.cyan(`Target URL: ${config.baseUrl}\n`));

    const client = new HttpClient(config);
    const fuzzer = new SchemaFuzzer(spec);
    const paths = spec.paths || {};

    let totalTests = 0;
    let failedTests = 0;
    const startTime = performance.now();

    for (const [apiPath, pathItem] of Object.entries(paths)) {
        for (const [method, operationAny] of Object.entries(pathItem as any)) {
            const httpMethods = ['get', 'post', 'put', 'delete', 'patch'];
            if (!httpMethods.includes(method.toLowerCase())) continue;

            const uppercaseMethod = method.toUpperCase();
            totalTests++;

            // Replace path parameters with dummy values e.g. {id} -> '123'
            let requestUrl = apiPath;
            const paramMatches = apiPath.match(/\{([^}]+)\}/g);
            if (paramMatches) {
                for (const match of paramMatches) {
                    const paramName = match.slice(1, -1);
                    const operation = operationAny as any;
                    const parameters = operation.parameters || [];
                    const paramSpec = parameters.find((p: any) => p.name === paramName && p.in === 'path');
                    let dummyValue = '1';
                    if (paramSpec && paramSpec.schema) {
                        dummyValue = String(fuzzer.fuzzSchema(paramSpec.schema));
                    }
                    requestUrl = requestUrl.replace(match, dummyValue);
                }
            }

            console.log(pc.bold(pc.white(`❯ Testing ${uppercaseMethod} ${requestUrl}`)));

            // Generate fuzzed body
            const body = fuzzer.generateRequestBody(apiPath, method);
            if (body) {
                console.log(pc.dim(`  Generated Payload: ${JSON.stringify(body)}`));
            }

            try {
                const startReq = performance.now();
                const res = await client.request({
                    url: requestUrl,
                    method: uppercaseMethod as any,
                    body,
                });
                const duration = Math.round(performance.now() - startReq);

                if (res.status >= 500) {
                    console.log(`  ${pc.red('✖')} Failed: Server returned status ${res.status} ${pc.dim(`(${duration}ms)`)}`);
                    console.log(pc.red(`    Error details: ${JSON.stringify(res.body)}`));
                    failedTests++;
                } else {
                    console.log(`  ${pc.green('✓')} Passed: Status ${res.status} ${pc.dim(`(${duration}ms)`)}`);
                }
            } catch (error: any) {
                console.log(`  ${pc.red('✖')} Failed: Request error: ${error.message}`);
                failedTests++;
            }
            console.log('');
        }
    }

    const duration = Math.round(performance.now() - startTime);
    logger.summary(totalTests - failedTests, failedTests, totalTests, duration);

    if (failedTests > 0) {
        process.exit(1);
    }
}
