# Installing reqprobe

## From npm (recommended)

```bash
npm i reqprobe
```

The CLI is immediately available via `npx`:

```bash
npx reqprobe run "tests/**/*.test.ts"
```

> **Note:** The npm package name is `reqprobe` (with a hyphen). The GitHub repository is named `reqprobe` — these are two different things. Always install from npm using `reqprobe`.

---

## From GitHub (latest unreleased code)

Install directly from the GitHub repository to get changes not yet on npm:

```bash
npm install github:shashi089/reqprobe
```

npm clones the repo, runs `npm run build` automatically via the `prepare` script, and installs it — exactly like a published package.

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

Then link it into your project:

```bash
npm install file:../reqprobe
```

Any time you change reqprobe source, run `npm run build` inside the clone and reinstall in your project.

---

## Complete setup from zero

### 1. Install

```bash
npm i reqprobe
```

### 2. Create a config file

```ts
// reqprobe.config.ts
import type { Config } from 'reqprobe';

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

### 3. Write a test

```ts
// tests/users.test.ts
import { test } from 'reqprobe/dsl';

test('GET /users — returns 200', async (ctx) => {
  const res = await ctx.api.get('/users');
  ctx.expect(res).toHaveStatus(200);
  ctx.expect(res.body).toHaveProperty('data');
});

test('POST /users — creates a user @smoke', async (ctx) => {
  const res = await ctx.api.post('/users', { name: 'Alice', email: 'alice@example.com' });
  ctx.expect(res).toHaveStatus(201);
  ctx.expect(res.body.name).toBe('Alice');
});
```

### 4. Run

```bash
npx reqprobe run "tests/**/*.test.ts"

# Only smoke tests
npx reqprobe run --tag smoke

# Skip destructive tests
npx reqprobe run --skip destructive

# Run 4 files in parallel
npx reqprobe run --workers 4
```

---

## Environment variables

Create a `.env` file in your project root — reqprobe loads it automatically:

```env
API_TOKEN=your-secret-token
API_BASE_URL=https://staging.your-api.com
```

Use in your config:

```ts
// reqprobe.config.ts
const config: Config = {
  baseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
  auth: {
    type: 'bearer',
    token: process.env.API_TOKEN ?? '',
  },
};
```

---

## Troubleshooting

**`reqprobe: command not found`**
Use `npx reqprobe` instead of `reqprobe` directly, or ensure `node_modules/.bin` is in your PATH.

**TypeScript errors on import from `reqprobe`**
Ensure your `tsconfig.json` uses `"moduleResolution": "Bundler"` or `"Node16"`:

```json
{
  "compilerOptions": {
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022"
  }
}
```

**Tests not found**
Always quote the glob pattern to prevent shell expansion:

```bash
# correct
npx reqprobe run "tests/**/*.test.ts"

# wrong — shell expands the glob before reqprobe sees it
npx reqprobe run tests/**/*.test.ts
```

**Installed from npm but getting old version**
Check the installed version: `npx reqprobe --version`
Update to latest: `npm install reqprobe@latest`
