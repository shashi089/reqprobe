import { test, beforeAll, beforeEach, afterEach, afterAll } from '../src/dsl/index.js';

let count = 0;

beforeAll(() => {
    console.log('--- beforeAll hook executed ---');
    count = 10;
});

beforeEach(() => {
    console.log('--- beforeEach hook executed ---');
    count += 1;
});

afterEach(() => {
    console.log('--- afterEach hook executed ---');
});

afterAll(() => {
    console.log('--- afterAll hook executed ---');
});

test('Hooks Demo: Test 1', async () => {
    console.log(`Test 1 running, count = ${count}`);
    if (count !== 11) {
        throw new Error(`Expected count to be 11, got ${count}`);
    }
});

test('Hooks Demo: Test 2', async () => {
    console.log(`Test 2 running, count = ${count}`);
    if (count !== 12) {
        throw new Error(`Expected count to be 12, got ${count}`);
    }
});
