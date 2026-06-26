import { test, expect } from 'reqprobe/dsl';

test('HTTP Client: GET request using semantic method', async (ctx) => {
    const res = await ctx.request({
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET'
    });

    expect(res).toHaveStatus(200);
    expect(res.body.id).toBe(1);
});

test('HTTP Client: POST request simulation', async (ctx) => {
    const res = await ctx.request({
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        body: {
            title: 'Test Post',
            body: 'This is a test',
            userId: 1
        }
    });

    expect(res).toHaveStatus(201);
});
