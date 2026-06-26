import { TestCase } from '../types/index.js';

export class TestRegistry {
    private static instance: TestRegistry;
    private tests: TestCase[] = [];
    private beforeAlls: (() => Promise<void> | void)[] = [];
    private afterAlls: (() => Promise<void> | void)[] = [];
    private beforeEachs: (() => Promise<void> | void)[] = [];
    private afterEachs: (() => Promise<void> | void)[] = [];

    private constructor() { }

    static getInstance(): TestRegistry {
        if (!TestRegistry.instance) {
            TestRegistry.instance = new TestRegistry();
        }
        return TestRegistry.instance;
    }

    register(test: TestCase) {
        this.tests.push(test);
    }

    getTests(): TestCase[] {
        return [...this.tests];
    }

    registerBeforeAll(fn: () => Promise<void> | void) {
        this.beforeAlls.push(fn);
    }

    getBeforeAlls(): (() => Promise<void> | void)[] {
        return [...this.beforeAlls];
    }

    registerAfterAll(fn: () => Promise<void> | void) {
        this.afterAlls.push(fn);
    }

    getAfterAlls(): (() => Promise<void> | void)[] {
        return [...this.afterAlls];
    }

    registerBeforeEach(fn: () => Promise<void> | void) {
        this.beforeEachs.push(fn);
    }

    getBeforeEachs(): (() => Promise<void> | void)[] {
        return [...this.beforeEachs];
    }

    registerAfterEach(fn: () => Promise<void> | void) {
        this.afterEachs.push(fn);
    }

    getAfterEachs(): (() => Promise<void> | void)[] {
        return [...this.afterEachs];
    }

    clear() {
        this.tests = [];
        this.beforeAlls = [];
        this.afterAlls = [];
        this.beforeEachs = [];
        this.afterEachs = [];
    }
}

export const registry = TestRegistry.getInstance();
