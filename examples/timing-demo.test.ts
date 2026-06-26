import { test, expect } from '../src/dsl/index.js';

test('Timing Demo: GET PokeAPI ditto with response time check', async ({ api }) => {
    const res = await api.get('https://pokeapi.co/api/v2/pokemon/ditto');
    
    expect(res).toHaveStatus(200);
    
    console.log(`\n--- Actual response time: ${res.duration}ms ---`);
    
    // Assert response timing is within 1500ms
    expect(res).toRespondWithin(1500);
});
