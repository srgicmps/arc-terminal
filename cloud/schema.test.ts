// El esquema de D1 (cloud/schema.ts), con el SQLite de Node: cada CREATE es SQL válido, cada tabla se crea una
// sola vez por isolate y ningún otro archivo de cloud/ ni de functions/ escribe su propio CREATE TABLE.
import { beforeEach, describe, expect, it } from 'vitest';
import { sqliteD1 } from './d1sqlite.ts';
import type { D1Database } from './prefs.ts';
import { ensure, resetSchema, TABLES, type Table } from './schema.ts';

beforeEach(resetSchema);

const NAMES = Object.keys(TABLES) as Table[];

/** Una D1 sobre SQLite que apunta cada `exec`. */
function spied() {
	const db = sqliteD1();
	const sql: string[] = [];
	const spy: D1Database = { ...db, exec: async (s) => (sql.push(s), db.exec(s)) };
	return { db, sql, spy };
}

describe('ensure', () => {
	it('crea las 10 tablas, cada una una sola vez', async () => {
		const { db, sql, spy } = spied();
		await ensure(spy, ...NAMES);
		await ensure(spy, ...NAMES);
		await ensure(spy, 'alerts');
		expect(sql).toEqual(Object.values(TABLES));
		const made = db.raw
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
			.all()
			.map((r) => (r as { name: string }).name);
		expect(made).toEqual([...NAMES].sort());
	});

	it('si un CREATE falla, no lo da por hecho: lo intenta otra vez en la siguiente', async () => {
		const { sql, spy } = spied();
		let fail = true;
		const flaky: D1Database = {
			...spy,
			exec: async (s) => {
				if (fail) throw new Error('D1 no responde');
				return spy.exec(s);
			}
		};
		await expect(ensure(flaky, 'rss')).rejects.toThrow('D1 no responde');
		fail = false;
		await ensure(flaky, 'rss');
		expect(sql).toEqual([TABLES.rss]);
	});
});

describe('un solo esquema', () => {
	// Los archivos de cloud/ y functions/ que llegan a Cloudflare (sin los tests ni este esquema).
	const sources = {
		...import.meta.glob<string>('./*.ts', { query: '?raw', import: 'default', eager: true }),
		...import.meta.glob<string>('../functions/**/*.ts', { query: '?raw', import: 'default', eager: true })
	};
	const code = Object.entries(sources).filter(([path]) => !path.endsWith('.test.ts') && path !== './schema.ts');

	it('ningún otro archivo escribe su CREATE TABLE: todas las tablas salen de schema.ts', () => {
		expect(code.length).toBeGreaterThan(10);
		expect(code.filter(([, text]) => /CREATE\s+TABLE/i.test(text)).map(([path]) => path)).toEqual([]);
	});
});
