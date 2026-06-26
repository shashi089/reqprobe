import { test, expect } from 'reqprobe/dsl';

/**
 * Example: Authentication and Authorization Testing
 */

test('Example: Test authentication with Bearer token', async ({ api }) => {
    const token = process.env.API_TOKEN || 'test_token';

    const res = await api.get('/posts/1', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    expect(res).toHaveStatus(200);
});

test('Example: Test API key authentication', async ({ api }) => {
    const res = await api.get('/posts', {
        headers: {
            'X-API-Key': process.env.API_KEY || 'test_api_key'
        }
    });

    expect(res).toHaveStatus(200);
});

/**
 * Example: Error Handling
 */

test('Example: Handle 404 Not Found', async ({ api }) => {
    const res = await api.get('/posts/99999');

    expect(res).toHaveStatus(404);
});

test('Example: Verify error response structure', async ({ api }) => {
    const res = await api.post('/posts', {
        // Missing required fields
        title: ''
    });

    // Many APIs return 400 or 422 for validation errors
    expect(res.status >= 400 && res.status < 500).toBeTruthy();
});

/**
 * Example: Performance Testing
 */

test('Example: Verify response time', async ({ api }) => {
    const res = await api.get('/posts/1');

    expect(res).toHaveStatus(200);
    expect(res.duration < 1000).toBeTruthy(); // Should respond within 1 second
});

/**
 * Example: Data Validation
 */

test('Example: Validate email format', async ({ api }) => {
    const res = await api.get('/users/1');

    expect(res).toHaveStatus(200);
    expect(res.body).toHaveProperty('email');

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test(res.body.email)).toBeTruthy();
});

test('Example: Validate array response', async ({ api }) => {
    const res = await api.get('/posts');

    expect(res).toHaveStatus(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length > 0).toBeTruthy();

    // Validate first item structure
    const firstPost = res.body[0];
    expect(firstPost).toHaveProperty('id');
    expect(firstPost).toHaveProperty('title');
    expect(firstPost).toHaveProperty('body');
});
