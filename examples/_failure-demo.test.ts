/**
 * Deliberate failure demo — shows what reqprobe failure output looks like.
 * Prefixed with _ so it is excluded from the default **\/*.test.ts glob.
 * Run explicitly: npx reqprobe run "examples/_failure-demo.test.ts"
 */
import { test } from 'reqprobe/dsl';

test('✓ GET /pokemon/ditto — should pass', async (ctx) => {
    const res = await ctx.request({
        url: 'https://pokeapi.co/api/v2/pokemon/ditto',
        method: 'GET',
    });
    ctx.expect(res).toHaveStatus(200);
    ctx.expect(res.body.name).toBe('ditto');
});

test('✖ GET /pokemon/ditto — wrong status assertion (deliberate fail)', async (ctx) => {
    const res = await ctx.request({
        url: 'https://pokeapi.co/api/v2/pokemon/ditto',
        method: 'GET',
    });
    // Deliberately wrong: expect 201 but will get 200
    ctx.expect(res).toHaveStatus(201);
});

test('✖ GET /pokemon/ditto — wrong name assertion (deliberate fail)', async (ctx) => {
    const res = await ctx.request({
        url: 'https://pokeapi.co/api/v2/pokemon/ditto',
        method: 'GET',
    });
    // Deliberately wrong: expect 'pikachu' but will get 'ditto'
    ctx.expect(res.body.name).toBe('pikachu');
});
