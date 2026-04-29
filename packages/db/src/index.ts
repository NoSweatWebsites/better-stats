import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

export * from './schema'

let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!_db) {
    const client = postgres(process.env.DATABASE_URL!)
    _db = drizzle(client, { schema })
  }
  return _db
}

export { schema }
