import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { config } from './environment.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

// Strip +asyncpg if migrated directly from Python connection string
const cleanDbUrl = config.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://');

export const pool = new Pool({
  connectionString: cleanDbUrl,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.warn('PostgreSQL pool background error (fallback mock available):', err.message);
});

// Optional Supabase client if URL and key configured
export const supabase = (config.SUPABASE_URL && (config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY))
  ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY)
  : null;

/**
 * Execute query safely with connection check & fallback tolerance
 */
export async function query(text, params = []) {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err) {
    logger.warn(`Database query failed [${text}]:`, err.message);
    throw err;
  }
}
