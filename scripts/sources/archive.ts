// Archivo de titulares (NEWS): todo lo que pasa por las secciones news-* se guarda 3 meses largos
// (de 90 a 120 días), partido por meses para que la web solo descargue lo que busca.
// Fuente derivada (`after`): no descarga titulares, usa los de esta pasada.
//   - news-archive.json: índice pequeño (meses, cuántos titulares y cuánto pesa cada uno).
//   - news-archive/AAAA-MM.json: los titulares del mes (título, medio, fecha y enlace), del más nuevo
//     al más antiguo. Van en una subcarpeta para no entrar en la build (ver src/lib/data.ts).
// Para añadir al mes en curso se lee su copia publicada. Si no se puede leer y el mes ya existía, la
// pasada falla y update.ts se queda con la copia anterior: así nunca se pierde lo acumulado.
import { gzipSync } from 'node:zlib';
import { NEWS_SECTIONS } from '../../src/lib/news.ts';
import type { ArchiveEntry, NewsArchive, NewsData, NewsItem } from '../../src/lib/types.ts';
import { list, NO_CONTEXT, writeExtra, type Source } from '../lib.ts';
import { normUrl } from './imp.ts';

const PUBLISHED = 'https://srgicmps.github.io/arc-terminal/data';
/** Meses que se guardan: el actual y los 3 anteriores (de 90 a 120 días). */
export const MONTHS = 4;

export const monthFile = (month: string) => `news-archive/${month}.json`;

/** Día y hora de Madrid, al minuto: «2026-10-14T16:05». */
export function madridMinute(iso: string): string {
	return new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 16).replace(' ', 'T');
}

/** Titulares de esta pasada (con fecha), sin repetir enlace. */
export function entries(sections: NewsItem[][]): ArchiveEntry[] {
	const seen = new Set<string>();
	const out: ArchiveEntry[] = [];
	for (const item of sections.flat()) {
		if (!item.title || !item.url || !item.time || !Number.isFinite(Date.parse(item.time))) continue;
		const key = normUrl(item.url);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ t: item.title, s: item.source, d: madridMinute(item.time), u: item.url });
	}
	return out;
}

/** Junta lo nuevo con lo guardado de un mes: sin repetir enlace y del más nuevo al más antiguo. */
export function mergeMonth(saved: ArchiveEntry[], fresh: ArchiveEntry[]): ArchiveEntry[] {
	const seen = new Set<string>();
	return [...saved, ...fresh]
		.filter((e) => {
			const key = normUrl(e.u);
			return !seen.has(key) && !!seen.add(key);
		})
		.sort((a, b) => b.d.localeCompare(a.d));
}

/** «2026-10» menos `n` meses. */
export function monthsBefore(month: string, n: number): string {
	const [y, m] = month.split('-').map(Number);
	const d = new Date(Date.UTC(y, m - 1 - n, 1));
	return d.toISOString().slice(0, 7);
}

/** Lo guardado de un mes en la web publicada. [] si aún no existe; error si no se puede leer. */
async function published(month: string, known: boolean): Promise<ArchiveEntry[]> {
	const res = await fetch(`${PUBLISHED}/${monthFile(month)}`, { signal: AbortSignal.timeout(30_000) }).catch(() => null);
	if (res?.ok) return list<ArchiveEntry>(await res.json());
	if (!known && res?.status === 404) return [];
	throw new Error(`no se puede leer el archivo de ${month} (${res ? `HTTP ${res.status}` : 'sin respuesta'})`);
}

export const archive: Source<NewsArchive> = {
	name: 'news-archive',
	label: 'Archivo de titulares de los últimos 3 meses · todas las secciones de NEWS',
	maxAgeMinutes: 55,
	after: true,
	files: (data) => data.months.map((m) => monthFile(m.month)),
	async fetch(previous, ctx = NO_CONTEXT) {
		const fresh = entries(NEWS_SECTIONS.map((s) => ctx.get<NewsData>(`news-${s.key}`)?.items ?? []));
		if (!fresh.length) throw new Error('sin titulares en esta pasada');
		const current = madridMinute(new Date().toISOString()).slice(0, 7);
		const oldest = monthsBefore(current, MONTHS - 1);
		const known = new Map((previous?.months ?? []).map((m) => [m.month, m]));
		const byMonth = Map.groupBy(
			fresh.filter((e) => e.d.slice(0, 7) >= oldest),
			(e) => e.d.slice(0, 7)
		);
		for (const [month, items] of byMonth) {
			const merged = mergeMonth(await published(month, known.has(month)), items);
			await writeExtra(monthFile(month), merged);
			const bytes = Buffer.byteLength(JSON.stringify(merged));
			known.set(month, { month, count: merged.length, bytes });
			console.log(`  news-archive · ${month}: ${merged.length} titulares, ${Math.round(bytes / 1024)} KB`);
		}
		// Medida del peso: los titulares de las últimas 24 h, como si todo el mes fuera igual.
		const day = fresh.filter((e) => e.d >= madridMinute(new Date(Date.now() - 86_400_000).toISOString()));
		const sample = Buffer.from(JSON.stringify(day));
		console.log(
			`  news-archive · ${day.length} titulares en 24 h → un mes ≈ ${Math.round((sample.length * 30) / 1024)} KB` +
				` (${Math.round((gzipSync(sample).length * 30) / 1024)} KB con gzip)`
		);
		const months = [...known.values()].filter((m) => m.month >= oldest).sort((a, b) => b.month.localeCompare(a.month));
		return { months };
	}
};
