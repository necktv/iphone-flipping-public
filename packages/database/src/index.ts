import pkg from 'pg';
const { Pool } = pkg;

export function createDbPool(connectionString?: string) {
  return new Pool({
    connectionString: connectionString || process.env.DATABASE_URL || 'postgresql://postgres:postgres_secret@localhost:5432/iphone_flipping',
  });
}
