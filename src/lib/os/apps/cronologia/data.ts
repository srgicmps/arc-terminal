// Línea de tiempo (Arc OS): pide los archivos de static/data que usan los carriles, como los widgets del
// escritorio (widgetdata.svelte.ts). Los de mercados solo cuando se enseña su carril.
import { asset } from '$app/paths';
import type { Sources } from './events.ts';

/** El `data` de static/data/<name>.json, o null si falta o no se puede leer. */
export async function getData<T = unknown>(name: string): Promise<T | null> {
	try {
		const r = await fetch(asset(`data/${name}.json` as Parameters<typeof asset>[0]), { cache: 'no-store' });
		return r.ok ? (((await r.json()) as { data: T }).data ?? null) : null;
	} catch {
		return null;
	}
}

/** Archivo de cada fuente de sucesos. */
const EVENT_FILES: Record<keyof Sources, string> = {
	imp: 'imp',
	quakes: 'quakes',
	gdacs: 'gdacs',
	advisories: 'advisories',
	czib: 'czib',
	navwarn: 'navwarn',
	releases: 'releases-cal',
	finnhub: 'finnhub',
	speeches: 'speeches'
};

export async function loadSources(): Promise<Sources> {
	const keys = Object.keys(EVENT_FILES) as (keyof Sources)[];
	const values = await Promise.all(keys.map((k) => getData(EVENT_FILES[k])));
	return Object.fromEntries(keys.map((k, i) => [k, values[i]])) as Sources;
}
