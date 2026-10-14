/// <reference types="node" />
// Descarga todas las fuentes y las guarda en static/data/<nombre>.json. Lo ejecuta GitHub Actions
// antes de construir la web; la web publicada sirve esos mismos archivos en /arc-terminal/data/.
//
// Uso: `pnpm data` (todas) o `pnpm data fuel boe` (solo esas).
//
// Para no castigar las APIs ni depender de que todas respondan:
// - si la copia publicada de una fuente es reciente (maxAgeMinutes), se reutiliza sin descargar;
// - si una descarga falla, se reutiliza la copia publicada, aunque sea antigua, y se avisa.
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Dataset, SourceHistory, SourceStatus } from '../src/lib/data.ts';
import { withHistory } from './history.ts';
import {
	checkShrink,
	deadlineFor,
	makeContext,
	NO_CONTEXT,
	level,
	waves,
	withDeadline,
	writeExtra,
	type Source,
	type SourceContext
} from './lib.ts';
import { buildNewsIndex } from './news-index.ts';
import { loadSources } from './registry.ts';

const OUT_DIR = 'static/data';
// En los PR, una muestra de cada fuente al final del registro, para revisar la forma real de los datos.
const samples: string[] = [];
const PUBLISHED = 'https://srgicmps.github.io/arc-terminal/data';

async function published(name: string): Promise<Dataset<unknown> | null> {
	try {
		const res = await fetch(`${PUBLISHED}/${name}.json`, { signal: AbortSignal.timeout(20_000) });
		if (!res.ok) return null;
		const body = (await res.json()) as Dataset<unknown>;
		return body && body.fetchedAt && 'data' in body ? body : null;
	} catch {
		return null;
	}
}

// Datos que deja cada fuente en esta pasada (nuevos, reutilizados o la copia anterior si falló), para
// las fuentes derivadas (`after`) de la segunda fase.
const saved = new Map<string, unknown>();

async function save(dataset: Dataset<unknown>) {
	saved.set(dataset.name, dataset.data);
	await writeFile(`${OUT_DIR}/${dataset.name}.json`, JSON.stringify(dataset) + '\n');
}

/** Al reutilizar una copia publicada, copia también sus archivos extra desde la web. */
async function copyExtra(source: Source, dataset: Dataset<unknown>) {
	const paths = source.files?.(dataset.data) ?? [];
	await Promise.all(
		paths.map(async (path) => {
			const res = await fetch(`${PUBLISHED}/${path}`, { signal: AbortSignal.timeout(30_000) }).catch(() => null);
			if (res?.ok) await writeExtra(path, await res.json());
		})
	);
}

function summary(data: unknown): string {
	if (Array.isArray(data)) return `${data.length} elementos`;
	if (data && typeof data === 'object') {
		return Object.entries(data)
			.map(([k, v]) => (Array.isArray(v) ? `${k}: ${v.length}` : null))
			.filter(Boolean)
			.join(', ');
	}
	return '';
}

async function run(source: Source, ctx: SourceContext = NO_CONTEXT): Promise<SourceStatus> {
	const base = { name: source.name, label: source.label, maxAgeMinutes: source.maxAgeMinutes, requires: source.requires };
	if (source.requires && !process.env[source.requires]) {
		console.log(`- ${source.name}: sin clave ${source.requires}, se salta`);
		return { ...base, state: 'off', fetchedAt: null, error: `Falta la clave ${source.requires} en GitHub Secrets` };
	}
	const previous = await published(source.name);
	const age = previous ? (Date.now() - Date.parse(previous.fetchedAt)) / 60_000 : Infinity;
	const force = process.env.FORCE_REFRESH === '1';

	// La fuente puede dar por mala una copia reciente (p. ej., le faltan series nuevas).
	const outdated = previous ? source.isStale?.(previous.data) === true : false;

	if (previous && age < source.maxAgeMinutes && !force && !outdated) {
		await save(previous);
		await copyExtra(source, previous);
		console.log(`= ${source.name}: copia de hace ${Math.round(age)} min`);
		return { ...base, state: 'cached', fetchedAt: previous.fetchedAt };
	}

	try {
		const started = Date.now();
		const deadline = deadlineFor(source);
		const data = await withDeadline(
			source.fetch(previous?.data, ctx),
			deadline,
			`tiempo agotado (${deadline / 1000} s)`
		);
		// Vacío o encogido de golpe: se trata como un fallo (camino «stale», con la copia anterior).
		const suspicious = checkShrink(data, previous?.data, source);
		if (suspicious) throw new Error(suspicious);
		const dataset = { name: source.name, fetchedAt: new Date().toISOString(), data };
		await save(dataset);
		console.log(`✓ ${source.name}: ${summary(data)} (${Date.now() - started} ms)`);
		if (process.env.SAMPLE) samples.push(`${source.name}: ${JSON.stringify(data).slice(0, 700)}`);
		return { ...base, state: 'ok', fetchedAt: dataset.fetchedAt };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		// ::warning:: hace que GitHub muestre el aviso en el resumen de la Action.
		console.log(`::warning title=${source.name}::${message}`);
		if (previous) {
			await save(previous);
			await copyExtra(source, previous);
			return { ...base, state: 'stale', fetchedAt: previous.fetchedAt, error: message };
		}
		return { ...base, state: 'error', fetchedAt: null, error: message };
	}
}

const wanted = process.argv.slice(2);
const sources = await loadSources();
const selected = wanted.length ? sources.filter((s) => wanted.includes(s.name)) : sources;

await mkdir(OUT_DIR, { recursive: true });
// Por oleadas: primero todas las fuentes normales a la vez; luego las derivadas, nivel a nivel
// (`after: true`, después `after: 2`…), cada una con los datos de las anteriores.
const ctx = makeContext(saved, (name) => {
	try {
		return (JSON.parse(readFileSync(`${OUT_DIR}/${name}.json`, 'utf8')) as Dataset<unknown>).data;
	} catch {
		return undefined;
	}
});
const statuses: SourceStatus[] = [];
for (const wave of waves(selected)) {
	const derived = wave.some((s) => level(s) > 0);
	statuses.push(...(await Promise.all(wave.map((s) => (derived ? run(s, ctx) : run(s))))));
}

if (!wanted.length) {
	const now = Date.now();
	await save({ name: 'status', fetchedAt: new Date(now).toISOString(), data: statuses });
	// El historial va en un archivo aparte (solo lo carga STATUS): al publicado se le suma esta pasada.
	const before = await published('status-history');
	const history = withHistory(statuses, before?.data as SourceHistory[] | undefined, now);
	await save({ name: 'status-history', fetchedAt: new Date(now).toISOString(), data: history });
}

// «En las noticias» de cada valor y de cada país, con los titulares que acaban de guardarse.
if (selected.some((s) => s.name.startsWith('news-'))) {
	const [index, countries] = await buildNewsIndex(OUT_DIR);
	await save(index);
	await save(countries);
	console.log(`✓ news-index: ${Object.keys(index.data).length} valores y ${Object.keys(countries.data).length} países con titulares`);
}

const failed = statuses.filter((s) => s.state === 'error' || s.state === 'stale');
const off = statuses.filter((s) => s.state === 'off').length;
const active = statuses.length - off;
console.log(`\n${active - failed.length}/${active} fuentes al día${off ? ` (${off} sin clave)` : ''}.`);
if (samples.length) console.log(`\nMuestras:\n${samples.join('\n\n')}`);
