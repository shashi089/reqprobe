# Installing req-probe

## From npm (recommended)

```bash
npm install req-probe
```

That's it. The CLI is immediately available:

```bash
npx reqprobe run "tests/**/*.test.ts"
```

---

## From GitHub (pre-release / latest)

Install directly from the GitHub repository to get unreleased changes:

```bash
npm install github:shashi089/reqprobe
```

npm clones the repo, runs `npm run build` via the `prepare` script, and installs it — exactly like a published package.

Pin to a specific commit for reproducibility:

```bash
npm install github:shashi089/reqprobe#a1b2c3d
```

---

## From a local clone (contributors)

```bash
git clone https://github.com/shashi089/reqprobe.git
cd reqprobe
npm install
npm run build
```

Then in your project:

```bash
npm install file:../reqprobe
```

Any time you change req-probe source, run `npm run build` inside the clone and reinstall in your project.

---

## Quick start after installing

### 1. Create a config file

```ts
// reqprobe.config.ts
import type { Config } from 'req-probe';

const config: Config = {
  baseUrl: 'https://your-api.com',
  timeout: 10_000,
  auth: {
    type: 'bearer',
    token: process.env.API_TOKEN ?? '',
  },
};

export default config;
```

### 2. Write a test

```ts
// tests/users.test.ts
import { test } from 'req-probe/dsl';

test('GET /users — returns 200', async (ctx) => {
  const res = await ctx.api.get('/users');
  ctx.expect(res).toHaveStatus(200);
  ctx.expect(res.body).toHaveProperty('data');
});
```

### 3. Run

```bash
npx reqprobe run "tests/**/*.test.ts"
```

---

## Environment variables

Create a `.env` file — req-probe loads it automatically:

```env
API_TOKEN=your-secret-token
API_BASE_URL=https://staging.your-api.com
```

---

## Troubleshooting

**`reqprobe: command not found`** — Run `npm install` to ensure the bin is linked, or use `npx reqprobe`.

**TypeScript errors on import** — Ensure your `tsconfig.json` uses `"moduleResolution": "Bundler"` or `"Node16"` so the `exports` field in req-probe's `package.json` is honoured.

**Tests not found** — Quote the glob pattern to prevent shell expansion:
```bash
npx reqprobe run "tests/**/*.test.ts"
```
