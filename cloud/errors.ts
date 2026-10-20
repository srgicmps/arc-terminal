// Los errores que ven los usuarios en su navegador: /api/errors (F29). Los manda src/hooks.client.ts.
// - POST: una persona con su JWT de Access verificado (person(), access.ts) manda un error. Se vuelve a limpiar
//   aquí (clean() de src/lib/errreport.ts: no nos fiamos de lo que llega) y se agrupa por firma: el mismo error
//   suma 1 a su contador. NO se guarda quién: ni email ni uid. Solo la firma, el mensaje y la pila recortados, la
//   ruta sin consulta, la versión, la estética, el modo y el navegador y el sistema genéricos («Safari · iOS»).
//   Por eso «Quitar» en /admin no tiene que borrar nada de aquí.
// - Topes: 4 KB por informe, 50 firmas nuevas al día (las conocidas siguen sumando) y 300 filas (se van las que
//   llevan más tiempo sin repetirse).
// - GET (la lista) y DELETE (?sig=, «Arreglado»): solo el administrador, como las sugerencias (feedback.ts).
import { clean, signature, skip, type ErrorReport } from '../src/lib/errreport.ts';
import { person } from './access.ts';
import { isAdmin, readJson, type AdminEnv } from './feedback.ts';
import { json, type D1Database } from './prefs.ts';
import { ensure } from './schema.ts';

export interface ErrorRow extends ErrorReport {
	/** Firma: 8 cifras hexadecimales (signature() de errreport.ts). */
	sig: string;
	/** Navegador y sistema, genéricos: «Safari · iOS». */
	ua: string;
	/** Primera y última vez (ms) y cuántas veces. */
	first: number;
	last: number;
	n: number;
}

export interface ErrorStore {
	/** Suma 1 a una firma que ya está y pone al día ruta, versión…; false si no estaba. */
	bump(row: Omit<ErrorRow, 'first' | 'n'>): Promise<boolean>;
	/** Cuántas firmas nuevas desde `since`. */
	countNew(since: number): Promise<number>;
	/** Una firma nueva; luego deja solo las `keep` más recientes. */
	add(row: ErrorRow, keep: number): Promise<void>;
	/** Las que se han repetido más tarde, primero. */
	list(limit: number): Promise<ErrorRow[]>;
	remove(sig: string): Promise<void>;
}

export const ERROR_LIMITS = { body: 4096, newPerDay: 50, rows: 300, list: 100 };

const DAY = 86_400_000;
const SIG = /^[0-9a-f]{8}$/;

/** Navegador y sistema, sin versión ni nada que distinga a una persona: «Chrome · Android». */
export function shortUa(ua: string): string {
	const os = /iPhone|iPad|iPod/.test(ua)
		? 'iOS'
		: /Android/.test(ua)
			? 'Android'
			: /CrOS/.test(ua)
				? 'ChromeOS'
				: /Mac OS X|Macintosh/.test(ua)
					? 'macOS'
					: /Windows/.test(ua)
						? 'Windows'
						: /Linux/.test(ua)
							? 'Linux'
							: 'otro';
	const browser = /Edg(?:e|A|iOS)?\//.test(ua)
		? 'Edge'
		: /SamsungBrowser/.test(ua)
			? 'Samsung'
			: /Firefox\/|FxiOS/.test(ua)
				? 'Firefox'
				: /Chrome\/|CriOS/.test(ua)
					? 'Chrome'
					: /Safari\//.test(ua)
						? 'Safari'
						: 'otro';
	return `${browser} · ${os}`;
}

export async function handleErrors(
	request: Request,
	env: AdminEnv,
	store: ErrorStore | null,
	fetcher?: (url: string) => Promise<Response>,
	now = Date.now()
): Promise<Response> {
	if (!store) return json(503, { error: 'sin configurar' });
	const who = await person(request, env, fetcher);
	if (who instanceof Response) return who;

	if (request.method === 'POST') {
		const body = await readJson(request, ERROR_LIMITS.body);
		if (body instanceof Response) return body;
		const report = clean(body);
		if (skip(report.msg, report.stack)) return json(200, { ok: true });
		const row = {
			...report,
			sig: signature(report.msg, report.stack),
			ua: shortUa(request.headers.get('user-agent') ?? ''),
			last: now
		};
		if (await store.bump(row)) return json(200, { ok: true });
		if ((await store.countNew(now - DAY)) >= ERROR_LIMITS.newPerDay) return json(429, { error: 'demasiados por hoy' });
		await store.add({ ...row, first: now, n: 1 }, ERROR_LIMITS.rows);
		return json(200, { ok: true });
	}

	// Leer o borrar: solo el administrador.
	if (!isAdmin(who.email, env)) return json(403, { error: 'solo el administrador' });
	if (request.method === 'GET') return json(200, { items: await store.list(ERROR_LIMITS.list) });
	if (request.method === 'DELETE') {
		const sig = new URL(request.url).searchParams.get('sig') ?? '';
		if (!SIG.test(sig)) return json(400, { error: 'sig' });
		await store.remove(sig);
		return json(200, { ok: true });
	}
	return json(405, { error: 'método' });
}

const COLUMNS = 'sig, msg, stack, path, ver, ua, style, modo, embed, first, last, n';
type Raw = Omit<ErrorRow, 'embed'> & { embed: number };
const fromRaw = (r: Raw): ErrorRow => ({ ...r, embed: !!r.embed });

/** D1: tabla errors, una fila por firma. Se crea sola la primera vez (cloud/schema.ts). */
export function d1ErrorStore(db: D1Database): ErrorStore {
	const ready = () => ensure(db, 'errors');
	return {
		async bump(r) {
			await ready();
			const { results } = await db
				.prepare(
					'UPDATE errors SET n = n + 1, last = ?, path = ?, ver = ?, ua = ?, style = ?, modo = ?, embed = ? WHERE sig = ? RETURNING n'
				)
				.bind(r.last, r.path, r.ver, r.ua, r.style, r.modo, r.embed ? 1 : 0, r.sig)
				.all<{ n: number }>();
			return results.length > 0;
		},
		async countNew(since) {
			await ready();
			const { results } = await db
				.prepare('SELECT COUNT(*) AS n FROM errors WHERE first >= ?')
				.bind(since)
				.all<{ n: number }>();
			return results[0]?.n ?? 0;
		},
		async add(r, keep) {
			await ready();
			await db.batch([
				// Si dos llegan a la vez con la misma firma nueva, la segunda suma en lugar de fallar.
				db
					.prepare(
						`INSERT INTO errors (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sig) DO UPDATE SET n = n + 1, last = excluded.last`
					)
					.bind(r.sig, r.msg, r.stack, r.path, r.ver, r.ua, r.style, r.modo, r.embed ? 1 : 0, r.first, r.last, r.n),
				db.prepare('DELETE FROM errors WHERE sig NOT IN (SELECT sig FROM errors ORDER BY last DESC LIMIT ?)').bind(keep)
			]);
		},
		async list(limit) {
			await ready();
			const { results } = await db
				.prepare(`SELECT ${COLUMNS} FROM errors ORDER BY last DESC LIMIT ?`)
				.bind(limit)
				.all<Raw>();
			return results.map(fromRaw);
		},
		async remove(sig) {
			await ready();
			await db.prepare('DELETE FROM errors WHERE sig = ?').bind(sig).run();
		}
	};
}

/** En memoria, para los tests. */
export function memoryErrorStore(): ErrorStore & { rows: ErrorRow[] } {
	const rows: ErrorRow[] = [];
	return {
		rows,
		async bump(r) {
			const old = rows.find((x) => x.sig === r.sig);
			if (!old) return false;
			const { last, path, ver, ua, style, modo, embed } = r;
			Object.assign(old, { last, path, ver, ua, style, modo, embed, n: old.n + 1 });
			return true;
		},
		countNew: async (since) => rows.filter((r) => r.first >= since).length,
		async add(r, keep) {
			rows.push({ ...r });
			rows.sort((a, b) => b.last - a.last);
			rows.splice(keep);
		},
		list: async (limit) => [...rows].sort((a, b) => b.last - a.last).slice(0, limit),
		async remove(sig) {
			const i = rows.findIndex((r) => r.sig === sig);
			if (i >= 0) rows.splice(i, 1);
		}
	};
}
