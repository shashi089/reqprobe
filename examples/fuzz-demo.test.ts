import { test, expect } from '../src/dsl/index.js';

test('Fuzz Demo: POST /users with generated schema mock', async (ctx) => {
    // Generate payload for /users endpoint and POST method
    const payload = ctx.fuzz.generate('/users', 'POST');

    console.log('\n--- Generated Payload: ---');
    console.log(JSON.stringify(payload, null, 2));

    expect(payload).toBeTruthy();
    expect(payload).toHaveProperty('username');
    expect(payload).toHaveProperty('email');
    expect(payload).toHaveProperty('age');
    expect(typeof payload.username).toBe('string');
    expect(typeof payload.email).toBe('string');
    expect(typeof payload.age).toBe('number');
    expect(payload.email).toContain('@');
    
    // Check role is one of the enum values if generated
    if (payload.role) {
        expect(['admin', 'user', 'guest'].includes(payload.role)).toBe(true);
    }
});
