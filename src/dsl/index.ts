import { registry } from './registry.js';
import { TestContext } from '../types/index.js';

/**
 * Defines a test case using the global DSL.
 * Calling test() registers the case into the singleton registry,
 * which the runner reads when executing a file.
 */
export function test(name: string, fn: (ctx: TestContext) => Promise<void>) {
    const tags = (name.match(/@(\w+)/g) ?? []).map(t => t.slice(1));
    registry.register({ name, tags, run: fn });
}

/**
 * Hook to execute code once before any tests in the file run.
 */
export function beforeAll(fn: () => Promise<void> | void) {
    registry.registerBeforeAll(fn);
}

/**
 * Hook to execute code once after all tests in the file have finished.
 */
export function afterAll(fn: () => Promise<void> | void) {
    registry.registerAfterAll(fn);
}

/**
 * Hook to execute code before each individual test run.
 */
export function beforeEach(fn: () => Promise<void> | void) {
    registry.registerBeforeEach(fn);
}

/**
 * Hook to execute code after each individual test run has finished.
 */
export function afterEach(fn: () => Promise<void> | void) {
    registry.registerAfterEach(fn);
}

export { expect } from '../assertions/index.js';
