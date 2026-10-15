// Solo para los tests de cloud/: una D1 de mentira sobre el SQLite de Node (node:sqlite, en memoria), con la
// misma forma que la D1 de Cloudflare que usan los d1…Store (prepare/bind/all/run, batch y exec). Así se prueba
// el SQL de verdad (tablas, borrados) sin Cloudflare.
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1Statement } from './prefs.ts';

export function sqliteD1(): D1Database & { raw: DatabaseSync } {
	const raw = new DatabaseSync(':memory:');
	const statement = (sql: string, values: unknown[] = []): D1Statement & { exec(): unknown } => ({
		bind: (...v: unknown[]) => statement(sql, v),
		all: async <T>() => ({ results: raw.prepare(sql).all(...(values as never[])) as T[] }),
		run: async () => raw.prepare(sql).run(...(values as never[])),
		exec: () => raw.prepare(sql).run(...(values as never[]))
	});
	return {
		raw,
		prepare: (sql) => statement(sql),
		async exec(sql) {
			raw.exec(sql);
		},
		// Como D1: todo o nada.
		async batch(statements) {
			raw.exec('BEGIN');
			try {
				for (const s of statements) (s as ReturnType<typeof statement>).exec();
				raw.exec('COMMIT');
			} catch (e) {
				raw.exec('ROLLBACK');
				throw e;
			}
		}
	};
}
