import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  outDir: 'dist',
  splitting: false,
  noExternal: ['@betterstats/db', 'dotenv'],
  external: [
    'drizzle-orm',
    'postgres',
    '@anthropic-ai/sdk',
    'openai',
    '@google/generative-ai',
    '@hono/node-server',
    'hono',
  ],
})
