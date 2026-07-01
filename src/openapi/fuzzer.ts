import { inlineRefs } from './resolver.js';

export class SchemaFuzzer {
    constructor(private spec: any) {}

    /**
     * Generates a mock request body or parameter value for a given path and method.
     */
    generateRequestBody(path: string, method: string): any {
        const paths = this.spec.paths;
        if (!paths) return undefined;

        // Try to find the matching path template (exact or param match)
        let pathItem = paths[path];
        if (!pathItem) {
            // Find key that matches path templates e.g. /users/{id}
            for (const template of Object.keys(paths)) {
                const pattern = template
                    .replace(/\//g, '\\/')
                    .replace(/\{[^}]+\}/g, '[^/]+');
                const regex = new RegExp(`^${pattern}$`);
                if (regex.test(path)) {
                    pathItem = paths[template];
                    break;
                }
            }
        }

        if (!pathItem) return undefined;

        const operation = pathItem[method.toLowerCase()];
        if (!operation) return undefined;

        const requestBody = operation.requestBody;
        if (!requestBody) return undefined;

        // Resolve requestBody ref if needed
        const resolvedBody = requestBody.$ref 
            ? inlineRefs(this.spec, requestBody) 
            : inlineRefs(this.spec, requestBody);

        const content = resolvedBody.content;
        if (!content) return undefined;

        const jsonMediaType = content['application/json'];
        if (!jsonMediaType) return undefined;

        const schema = jsonMediaType.schema;
        if (!schema) return undefined;

        return this.fuzzSchema(schema);
    }

    /**
     * Recursively fuzzes a JSON schema to produce a mock payload.
     */
    fuzzSchema(schema: any): any {
        if (!schema) return undefined;

        if (schema.$ref) {
            schema = inlineRefs(this.spec, schema);
        }

        // Handle oneOf/anyOf/allOf
        if (schema.allOf) {
            let result = {};
            for (const subSchema of schema.allOf) {
                result = { ...result, ...this.fuzzSchema(subSchema) };
            }
            return result;
        }

        if (schema.anyOf && schema.anyOf.length > 0) {
            // Pick the first one
            return this.fuzzSchema(schema.anyOf[0]);
        }

        if (schema.oneOf && schema.oneOf.length > 0) {
            // Pick the first one
            return this.fuzzSchema(schema.oneOf[0]);
        }

        const type = schema.type;

        // Properties check handles schemas that omit type: 'object'
        if (type === 'object' || schema.properties) {
            const result: any = {};
            const props = schema.properties || {};
            const required = schema.required || [];

            for (const [key, propSchema] of Object.entries(props)) {
                // Generate all required props, and 80% of optional props for good coverage
                if (required.includes(key) || Math.random() > 0.2) {
                    result[key] = this.fuzzSchema(propSchema);
                }
            }
            return result;
        }

        if (type === 'array' || schema.items) {
            const count = schema.minItems ?? 2;
            const items = [];
            for (let i = 0; i < count; i++) {
                items.push(this.fuzzSchema(schema.items));
            }
            return items;
        }

        if (type === 'string') {
            if (schema.enum && schema.enum.length > 0) {
                return schema.enum[Math.floor(Math.random() * schema.enum.length)];
            }
            if (schema.format === 'date-time') {
                return new Date().toISOString();
            }
            if (schema.format === 'date') {
                return new Date().toISOString().split('T')[0];
            }
            if (schema.format === 'email') {
                return `user-${Math.floor(Math.random() * 1000)}@example.com`;
            }
            if (schema.format === 'uuid') {
                return '123e4567-e89b-12d3-a456-426614174000';
            }
            
            const title = schema.title || 'value';
            return `${title}-${Math.floor(Math.random() * 1000)}`;
        }

        if (type === 'number' || type === 'integer') {
            const min = schema.minimum ?? 1;
            const max = schema.maximum ?? 100;
            const val = Math.floor(Math.random() * (max - min + 1)) + min;
            return type === 'integer' ? Math.floor(val) : val;
        }

        if (type === 'boolean') {
            return Math.random() > 0.5;
        }

        if (schema.default !== undefined) {
            return schema.default;
        }

        return null;
    }
}

export class FuzzHelper {
    private fuzzer: SchemaFuzzer;

    constructor(spec: any) {
        this.fuzzer = new SchemaFuzzer(spec);
    }

    generate(path: string, method: string): any {
        return this.fuzzer.generateRequestBody(path, method);
    }
}
