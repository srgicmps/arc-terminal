/// <reference types="node" />
// Todas las fuentes que descarga `pnpm data`, sin lista escrita a mano: se leen los archivos de
// scripts/sources/ y se recoge todo lo que se exporte con forma de Source (o listas de ellas, como
// newsSources). Así, una fuente nueva es un archivo nuevo y no toca ningún archivo compartido.
// Transición: las que siguen en scripts/sources/index.ts van primero y en su orden; las demás, detrás,
// por nombre de archivo. Si una está en los dos sitios, cuenta una vez (por `name`).
import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Source } from './lib.ts';

const DIR = fileURLToPath(new URL('./sources/', import.meta.url));

/** ¿Tiene forma de fuente? (nombre, cada cuánto y cómo descargarla) */
export function isSource(value: unknown): value is Source<unknown> {
	const v = value as Partial<Source<unknown>> | null;
	return !!v && typeof v === 'object' && typeof v.name === 'string' && typeof v.fetch === 'function' && typeof v.maxAgeMinutes === 'number';
}

/** Las fuentes que exporta un módulo, sueltas o en listas. */
export function sourcesIn(mod: Record<string, unknown>): Source<unknown>[] {
	return Object.values(mod).flatMap((v) => (Array.isArray(v) ? v : [v])).filter(isSource);
}

/** Junta varias listas sin repetir nombres: se queda con la primera aparición. */
export function dedupe(lists: Source<unknown>[][]): Source<unknown>[] {
	const seen = new Set<string>();
	return lists.flat().filter((s) => !seen.has(s.name) && !!seen.add(s.name));
}

export async function loadSources(dir = DIR): Promise<Source<any>[]> {
	const files = (await readdir(dir)).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort();
	const listed = files.includes('index.ts')
		? ((await import(pathToFileURL(`${dir}/index.ts`).href)).sources as Source<unknown>[])
		: [];
	const found = await Promise.all(
		files.filter((f) => f !== 'index.ts').map(async (f) => sourcesIn(await import(pathToFileURL(`${dir}/${f}`).href)))
	);
	return dedupe([listed, ...found]);
}
