import { test, expect } from 'reqprobe/dsl';

// Example 1: Using the new api instance with semantic methods
test('API Context: GET request using api.get()', async ({ api }) => {
    const res = await api.get('https://jsonplaceholder.typicode.com/users/1');

    expect(res).toHaveStatus(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.id).toBe(1);
});

// Example 2: POST request using api.post()
test('API Context: POST request using api.post()', async ({ api }) => {
    const res = await api.post('https://jsonplaceholder.typicode.com/posts', {
        title: 'Test Post',
        body: 'This is a test',
        userId: 1
    });

    expect(res).toHaveStatus(201);
    expect(res.body).toHaveProperty('id');
});

// Example 3: Backward compatibility - using ctx.request still works
test('API Context: Backward compatible ctx.request()', async (ctx) => {
    const res = await ctx.request({
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET'
    });

    expect(res).toHaveStatus(200);
    expect(res.body).toHaveProperty('userId');
});
