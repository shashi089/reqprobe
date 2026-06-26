import { OpenApiConfig, HttpMethod } from '../types/index.js';
import { loadSpec } from './loader.js';
import { extractSchema } from './extractor.js';
import { validateResponse } from './validator.js';

/**
 * Public facade for OpenAPI response validation.
 *
 * Usage:
 *   const validator = new OpenApiValidator({ specPath: './openapi.json', strict: true });
 *   await validator.validate('GET', '/pokemon/ditto', 200, responseBody);
 */
export class OpenApiValidator {
    private spec: Record<string, any>;
    private strict: boolean;

    constructor(config: OpenApiConfig) {
        this.spec = loadSpec(config.specPath);
        this.strict = config.strict ?? false;
    }

    getSpec(): Record<string, any> {
        return this.spec;
    }

    async validate(
        method: HttpMethod,
        requestPath: string,
        statusCode: number,
        body: unknown
    ): Promise<void> {
        const schema = extractSchema(this.spec, method, requestPath, statusCode);

        if (!schema) {
            if (this.strict) {
                throw new Error(
                    `[reqprobe/openapi] No schema found for ${method.toUpperCase()} ${requestPath} → ${statusCode}. ` +
                    `Set strict: false to skip validation when schema is missing.`
                );
            }
            // strict: false — silently skip
            return;
        }

        const cacheKey = `${method.toUpperCase()}:${requestPath}:${statusCode}`;
        validateResponse(schema, body, cacheKey);
    }
}
