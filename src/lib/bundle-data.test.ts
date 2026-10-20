// Guardia: ningún JSON de static/data entra en el código del navegador. Si un componente lo importa (con
// import.meta.glob, con un import o a través de dataset() de data.ts), Vite lo mete en un archivo de
// _app/immutable con su hash. status.json o search.json cambian en cada pasada de datos, así que cada
// publicación cambiaba el nombre de ~40 archivos de la build (161 KB gzip) y el service worker los volvía a
// bajar. En el navegador, los datos se piden a /data/<nombre>.json (fetch + asset(), como bardata.svelte.ts);
// los +page.server.ts y los +server.ts sí pueden leerlos: solo se ejecutan al construir.
//
// Cómo lo mira: parte de cada archivo de src/routes que llega al navegador (+page.svelte, +layout.ts…), sigue
// sus import (también los import() y los import.meta.glob de módulos) y falla si alguno de los archivos
// alcanzados nombra static/data. Es una lectura del código, sin construir: rápido y sin datos.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const rel = (abs: string) => relative(ROOT, abs).split('\\').join('/');

/** Archivos de código de src (sin tests ni tipos). */
function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path, out);
		else if (/\.(ts|js|svelte)$/.test(name) && !/\.(test|d)\.ts$/.test(name)) out.push(rel(path));
	}
	return out;
}

/** Solo se ejecutan al construir (o en el servidor): SvelteKit nunca los manda al navegador. */
const serverOnly = (file: string) => /\+(page|layout)\.server\.ts$|\+server\.ts$|\.server\.ts$/.test(file) || file.includes('/lib/server/');

/** El código de un archivo: de un .svelte, solo sus <script>; sin comentarios. */
function code(file: string, text = readFileSync(file, 'utf8')): string {
	const src = file.endsWith('.svelte') ? [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n') : text;
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;{}(),])\/\/.*$/gm, '$1');
}

/** ¿Nombra este código algún archivo de static/data (import, import() o import.meta.glob)? */
function namesData(src: string): boolean {
	for (const m of src.matchAll(/import\.meta\.glob\s*(?:<[^>]*>)?\s*\(([\s\S]*?)\)/g)) if (/static\/data/.test(m[1])) return true;
	for (const spec of specifiers(src)) if (/(^|\/)static\/data\//.test(spec.path)) return true;
	return false;
}

/** Un import: a qué archivo, si es un import.meta.glob y qué nombres trae (null: el módulo entero). */
type Spec = { path: string; glob: boolean; names: string | null };

/** Los import de un código que llegan al navegador (los `import type` no: desaparecen al compilar). */
function specifiers(src: string): Spec[] {
	const out: Spec[] = [];
	for (const m of src.matchAll(/\b(?:import|export)\s+(type\s+)?([\w*{}\s,$]*?)\s*\bfrom\s*['"]([^'"]+)['"]/g))
		if (!m[1]) out.push({ path: m[3], glob: false, names: m[2] });
	for (const m of src.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) out.push({ path: m[1], glob: false, names: null });
	for (const m of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ path: m[1], glob: false, names: null });
	for (const m of src.matchAll(/import\.meta\.glob\s*(?:<[^>]*>)?\s*\(\s*['"]([^'"]+)['"]/g)) out.push({ path: m[1], glob: true, names: null });
	return out;
}

/**
 * data.ts lleva el import.meta.glob de todos los JSON para dataset(), que solo usan los +page.server.ts. Del
 * navegador se pueden importar sus tipos y lastRuns() (STATUS): si nadie llama a dataset(), Vite quita el glob
 * al construir (el manifest de la build no tiene ningún static/data). Traer dataset() o el módulo entero, no.
 */
const DATA_TS = 'src/lib/data.ts';
const safeFromData = (spec: Spec) => spec.names !== null && !/\bdataset\b|\*/.test(spec.names);

/** Archivo de src al que apunta un import (relativo, #lib/ o $lib/); null si es de un paquete o de $app. */
function resolveSpec(from: string, spec: string): string | null {
	const path = spec.replace(/\?.*$/, '');
	let base: string;
	if (path.startsWith('.')) base = posix.join(posix.dirname(from), path);
	else if (path.startsWith('#lib/') || path.startsWith('$lib/')) base = `src/lib/${path.slice(5)}`;
	else if (path.startsWith('/src/')) base = path.slice(1);
	else return null;
	for (const c of [base, `${base}.ts`, `${base}.js`, `${base}.svelte`, `${base}/index.ts`]) if (existsSync(c) && statSync(c).isFile()) return c;
	return null;
}

/** Archivos que trae un import.meta.glob de módulos («./commands/*.ts»): solo el comodín del nombre. */
function expandGlob(from: string, spec: string): string[] {
	const path = spec.startsWith('.') ? posix.join(posix.dirname(from), spec) : spec.replace(/^\//, '');
	const dir = posix.dirname(path);
	if (dir.includes('*') || !existsSync(dir)) return [];
	const re = new RegExp(`^${posix.basename(path).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
	return readdirSync(dir)
		.filter((f) => re.test(f) && !/\.(test|d)\.ts$/.test(f))
		.map((f) => `${dir}/${f}`);
}

/** Recorre el código que llega al navegador desde las rutas. Devuelve, por archivo, quién lo trae. */
function browserGraph(): Map<string, string | null> {
	const seen = new Map<string, string | null>();
	const queue = walk('src/routes').filter((f) => !serverOnly(f));
	for (const f of queue) seen.set(f, null);
	while (queue.length) {
		const file = queue.shift()!;
		for (const spec of specifiers(code(file))) {
			const targets = spec.glob ? expandGlob(file, spec.path) : [resolveSpec(file, spec.path)];
			for (const t of targets) {
				if (!t || seen.has(t) || serverOnly(t) || !/\.(ts|js|svelte)$/.test(t)) continue;
				if (t === DATA_TS && safeFromData(spec)) continue;
				seen.set(t, file);
				queue.push(t);
			}
		}
	}
	return seen;
}

/** «ruta → componente → módulo»: cómo llega un archivo al navegador. */
function trail(graph: Map<string, string | null>, file: string): string {
	const chain = [file];
	for (let p = graph.get(file); p; p = graph.get(p)) chain.unshift(p);
	return chain.join(' → ');
}

describe('datos fuera del código del navegador', () => {
	it('detecta un JSON de static/data en el código', () => {
		expect(namesData(`const l = import.meta.glob('/static/data/status.json', { import: 'default' });`)).toBe(true);
		expect(namesData(`import status from '../../static/data/status.json';`)).toBe(true);
		expect(namesData(`const s = await import('/static/data/search.json');`)).toBe(true);
		expect(namesData(`fetch(asset('data/status.json'));`)).toBe(false);
		expect(namesData(`import type { Dataset } from '#lib/data.ts';`)).toBe(false);
		// data.ts (dataset()) tiene el glob de todos: un componente puede traer lastRuns(), pero no dataset().
		expect(namesData(code(DATA_TS))).toBe(true);
		const fromData = (src: string) => specifiers(src).every(safeFromData);
		expect(fromData(`import { lastRuns } from '#lib/data.ts';`)).toBe(true);
		expect(fromData(`import { dataset, type Dataset } from '#lib/data.ts';`)).toBe(false);
		expect(fromData(`import * as data from '#lib/data.ts';`)).toBe(false);
		expect(fromData(`const m = await import('#lib/data.ts');`)).toBe(false);
	});

	it('recorre el código del navegador: la barra, <Updated> y los paneles de TECH', () => {
		const graph = browserGraph();
		for (const f of ['src/lib/components/CommandBar.svelte', 'src/lib/components/Updated.svelte', 'src/lib/components/LaunchesPanel.svelte', 'src/lib/components/InternetStatusPanel.svelte'])
			expect(graph.has(f), f).toBe(true);
		expect(graph.has('src/lib/data.ts')).toBe(false);
	});

	it('ningún archivo que llega al navegador mete un JSON de static/data', () => {
		const graph = browserGraph();
		const offenders = [...graph.keys()].filter((f) => namesData(code(f))).map((f) => trail(graph, f));
		expect(offenders, 'En el navegador, pide los datos con fetch(asset(`data/<nombre>.json`))').toEqual([]);
	});
});
