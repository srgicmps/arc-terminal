/// <reference types="node" />
// Descarga todas las fuentes y las guarda en static/data/<nombre>.json. Lo ejecuta GitHub Actions
// antes de construir la web; la web publicada sirve esos mismos archivos en /arc-terminal/data/.
//
// Uso: `pnpm data` (todas) o `pnpm data fuel boe` (solo esas).
//
// Para no castigar las APIs ni depender de que todas respondan:
// - si la copia publicada de una fuente es reciente (maxAgeMinutes), se reutiliza sin descargar;
// - si una descarga falla, se reutiliza la copia publicada, aunque sea antigua, y se avisa.
import { mkdir, writeFile } from 'node:fs/promises';
import type { Dataset, SourceStatus } from '../src/lib/data.ts';
import type { Source } from './lib.ts';
import { sources } from './sources/index.ts';

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

async function save(dataset: Dataset<unknown>) {
	await writeFile(`${OUT_DIR}/${dataset.name}.json`, JSON.stringify(dataset) + '\n');
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

async function run(source: Source): Promise<SourceStatus> {
	const base = { name: source.name, label: source.label };
	if (source.requires && !process.env[source.requires]) {
		console.log(`- ${source.name}: sin clave ${source.requires}, se salta`);
		return { ...base, state: 'off', fetchedAt: null, error: `Falta la clave ${source.requires} en GitHub Secrets` };
	}
	const previous = await published(source.name);
	const age = previous ? (Date.now() - Date.parse(previous.fetchedAt)) / 60_000 : Infinity;
	const force = process.env.FORCE_REFRESH === '1';

	if (previous && age < source.maxAgeMinutes && !force) {
		await save(previous);
		console.log(`= ${source.name}: copia de hace ${Math.round(age)} min`);
		return { ...base, state: 'cached', fetchedAt: previous.fetchedAt };
	}

	try {
		const started = Date.now();
		const data = await source.fetch(previous?.data);
		const dataset = { name: source.name, fetchedAt: new Date().toISOString(), data };
		await save(dataset);
		console.log(`✓ ${source.name}: ${summary(data)} (${Date.now() - started} ms)`);
		if (process.env.SAMPLE) samples.push(`${source.name}: ${JSON.stringify(data).slice(0, 1500)}`);
		return { ...base, state: 'ok', fetchedAt: dataset.fetchedAt };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		// ::warning:: hace que GitHub muestre el aviso en el resumen de la Action.
		console.log(`::warning title=${source.name}::${message}`);
		if (previous) {
			await save(previous);
			return { ...base, state: 'stale', fetchedAt: previous.fetchedAt, error: message };
		}
		return { ...base, state: 'error', fetchedAt: null, error: message };
	}
}

const wanted = process.argv.slice(2);
const selected = wanted.length ? sources.filter((s) => wanted.includes(s.name)) : sources;

await mkdir(OUT_DIR, { recursive: true });
const statuses = await Promise.all(selected.map(run));

if (!wanted.length) {
	await save({ name: 'status', fetchedAt: new Date().toISOString(), data: statuses });
}

const failed = statuses.filter((s) => s.state === 'error' || s.state === 'stale');
const off = statuses.filter((s) => s.state === 'off').length;
const active = statuses.length - off;
console.log(`\n${active - failed.length}/${active} fuentes al día${off ? ` (${off} sin clave)` : ''}.`);
if (samples.length) console.log(`\nMuestras:\n${samples.join('\n\n')}`);
