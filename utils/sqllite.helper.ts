//sqlite
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// orm
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// shema
import * as schema from '../database/shema.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbUrl = process.env.DATABASE_URL || 'portfolio.db';
export const sqlite = new Database(dbUrl);
export const db = drizzle(sqlite, { schema });

const appTables = ['post_tags', 'post_author', 'posts', 'projects', 'tags'];

function hasAppTables(): boolean {
	const placeholders = appTables.map(() => '?').join(', ');
	const row = sqlite
		.prepare(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders}) LIMIT 1`
		)
		.get(...appTables);
	return Boolean(row);
}

export function pingSqlite(): void {
	sqlite.prepare('select 1 as ok').get();
}

export async function initializeSQLiteSchema(): Promise<void> {
	if (process.env.DISABLE_MIGRATIONS === 'true' || process.env.NODE_ENV === 'development') {
		console.log('SQLite migrations skipped');
		return;
	}

	if (hasAppTables()) {
		console.log('SQLite migrations skipped (existing tables)');
		return;
	}

	try {
		migrate(db, { migrationsFolder: path.join(__dirname, '../drizzle') });
		console.log('SQLite migrations applied successfully');
	} catch (error) {
		console.error('Error applying SQLite migrations:', error);
		throw error;
	}
}

export async function closeSqlite() {
    if (sqlite) {
        sqlite.close();
    }
}