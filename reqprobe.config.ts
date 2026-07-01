import type { Config } from './src/types/index.js';

const config: Config = {
  baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
  timeout: Number.parseInt(process.env.API_TIMEOUT || '5000', 10),
  headers: {
    Accept: 'application/json',
  },
  // Auth is applied automatically to every request — no manual header wiring needed
  auth: process.env.API_TOKEN
    ? { type: 'bearer', token: process.env.API_TOKEN }
    : undefined,
  reporters: {
    outDir: './reqprobe-reports',
    json: true,
    html: true,
  },
  openapi: {
    specPath: './examples/openapi/user-api.json',
    strict: false,
  },
};

export default config;
