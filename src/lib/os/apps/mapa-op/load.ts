// Mapa operacional: descarga los JSON de static/data que usa (los mismos que GEO y la Sala de control), como los
// widgets del escritorio (shell/widgetdata.svelte.ts). Si falta alguno, su capa sale vacía y se apunta en `missing`.
import { asset } from '$app/paths';
import type { NewsData } from '../../../types.ts';
import { OP_FILES, OP_NEWS_FILES, type OpRaw } from './ops.ts';

interface Envelope<T> {
	fetchedAt?: string;
	data: T;
}

async function getJson<T>(name: string): Promise<Envelope<T> | null> {
	try {
		const r = await fetch(asset(`data/${name}.json` as Parameters<typeof asset>[0]), { cache: 'no-store' });
		return r.ok ? ((await r.json()) as Envelope<T>) : null;
	} catch {
		return null;
	}
}

export interface OpLoad {
	raw: OpRaw;
	/** La descarga más reciente de todas (ISO), o null si no ha llegado ninguna. */
	fetchedAt: string | null;
	/** Archivos que no se han podido leer. */
	missing: string[];
}

export async function loadRaw(): Promise<OpLoad> {
	const keys = Object.keys(OP_FILES) as (keyof typeof OP_FILES)[];
	const [files, news] = await Promise.all([
		Promise.all(keys.map((k) => getJson<unknown>(OP_FILES[k]))),
		Promise.all(OP_NEWS_FILES.map((n) => getJson<NewsData>(n)))
	]);
	const raw: OpRaw = Object.fromEntries(keys.map((k, i) => [k, files[i]?.data ?? null]));
	raw.news = news.flatMap((n) => n?.data.items ?? []);
	const all = [...files, ...news];
	const missing = [...keys.map((k) => OP_FILES[k]), ...OP_NEWS_FILES].filter((_, i) => !all[i]);
	const fetchedAt =
		all
			.map((e) => e?.fetchedAt ?? '')
			.sort()
			.at(-1) || null;
	return { raw, fetchedAt, missing };
}
