// El esquema de la base D1, en un solo sitio. Cada tabla «se crea sola» la primera vez que un módulo la usa:
// ensure(db, 'alerts', …) lanza su CREATE TABLE IF NOT EXISTS y lo apunta, así que en cada isolate de
// Cloudflare corre una vez por tabla, no en cada petición. Si una tabla nueva guarda algo de un usuario
// (columna user), va también en USER_TABLES de admin.ts, para que «Quitar» la borre: lo vigila schema.test.ts.
import type { D1Database } from './prefs.ts';

export const TABLES = {
	/** Último acceso de cada uno (para /admin). La escribe /api/prefs al cargar la web. */
	seen: 'CREATE TABLE IF NOT EXISTS seen (user TEXT PRIMARY KEY, at INTEGER NOT NULL)',
	/** Ajustes: (email, clave) única. */
	prefs:
		'CREATE TABLE IF NOT EXISTS prefs (user TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (user, key))',
	/** Avisos al móvil: una fila por persona, con su id aleatorio (uid) y su tema de ntfy. */
	alerts:
		'CREATE TABLE IF NOT EXISTS alerts (user TEXT PRIMARY KEY, uid TEXT NOT NULL, topic TEXT, config TEXT NOT NULL, updated INTEGER NOT NULL)',
	/** «Tu mañana» por email: uno al día por uid (sin email). */
	brief_mail: 'CREATE TABLE IF NOT EXISTS brief_mail (uid TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (uid, day))',
	/** «Mandar a la familia»: una fila por persona y los envíos, para el tope diario. */
	family:
		'CREATE TABLE IF NOT EXISTS family (user TEXT PRIMARY KEY, id TEXT NOT NULL, name TEXT NOT NULL, accept INTEGER NOT NULL, updated INTEGER NOT NULL)',
	family_sent: 'CREATE TABLE IF NOT EXISTS family_sent (user TEXT NOT NULL, at INTEGER NOT NULL)',
	/** Sugerencias del pie de cada vista. */
	feedback:
		'CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT NOT NULL, view TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL)',
	/** Errores de los navegadores (cloud/errors.ts): una fila por firma, con su contador. Sin quién: ni email ni uid. */
	errors:
		'CREATE TABLE IF NOT EXISTS errors (sig TEXT PRIMARY KEY, msg TEXT NOT NULL, stack TEXT NOT NULL, path TEXT NOT NULL, ver TEXT NOT NULL, ua TEXT NOT NULL, style TEXT NOT NULL, modo TEXT NOT NULL, embed INTEGER NOT NULL, first INTEGER NOT NULL, last INTEGER NOT NULL, n INTEGER NOT NULL)',
	/** Mis RSS: una fila por persona con su lista en JSON. */
	rss: 'CREATE TABLE IF NOT EXISTS rss (user TEXT PRIMARY KEY, feeds TEXT NOT NULL, updated INTEGER NOT NULL)',
	/** Juego de predicciones: jugadores y apuestas. */
	forecast_players:
		'CREATE TABLE IF NOT EXISTS forecast_players (user TEXT PRIMARY KEY, uid TEXT NOT NULL UNIQUE, alias TEXT)',
	forecast_bets:
		'CREATE TABLE IF NOT EXISTS forecast_bets (user TEXT NOT NULL, round TEXT NOT NULL, closes TEXT NOT NULL, value REAL NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (user, round))'
} as const;

export type Table = keyof typeof TABLES;

/**
 * Las tablas ya creadas en este isolate. Por nombre y no por base: no está garantizado que env.DB sea el
 * mismo objeto en cada petición, y solo hay una base.
 */
const created = new Set<Table>();

/** Crea las tablas que falten, en este orden, una sola vez por isolate. */
export async function ensure(db: D1Database, ...tables: Table[]): Promise<void> {
	for (const t of tables) {
		if (created.has(t)) continue;
		await db.exec(TABLES[t]);
		created.add(t);
	}
}

/** Para los tests: olvida qué tablas se han creado (cada test usa una base nueva). */
export const resetSchema = () => created.clear();
