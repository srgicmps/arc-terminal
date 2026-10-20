/// <reference types="node" />
// Lista de la precaché del service worker (build/_app/precache.json). El service worker solo sabe qué archivos
// hay en _app/immutable, no cuáles usa cada vista. Esta lista le dice qué hace falta para arrancar cualquier
// vista: lo que nombra su HTML (modulepreload, hojas de estilo e import() del arranque, con refsOf de weight.ts)
// y todo lo que eso importa de forma estática, sacado del manifest de Vite. El HTML no basta: SvelteKit no
// nombra un trozo que antes ha visto detrás de un import(), aunque luego lo importe un nodo (p. ej. el layout).
// Y su arranque siempre carga el layout (nodes/0) y la página de error (nodes/1), que ningún HTML nombra.
// Quedan fuera Arc OS (/os) y lo que solo se carga con import() (estéticas, ventanas de Arc OS, globo…): el
// service worker lo guarda la primera vez que se pide, así quien no lo usa no lo descarga.
// La escribe un plugin de Vite al final de `vite build`, cuando el adaptador ya ha dejado build/ (vite.config.ts).
// También se puede lanzar a mano: `node scripts/precache.ts` (con build/ hecho).
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { refsOf } from './weight.ts';

/** Dónde la busca el service worker (src/service-worker/index.ts), relativo a la raíz de la web. */
export const LIST_PATH = '_app/precache.json';

/** Páginas que no entran: Arc OS solo se descarga si se abre (tampoco cuenta en el peso, weight.ts → EXEMPT). */
export const SKIP = new Set(['os.html']);

/** El manifest de Vite de la build del navegador: qué importa cada archivo (lo deja `vite build`). */
export const MANIFEST = '.svelte-kit/output/client/.vite/manifest.json';

/** Una entrada del manifest: el archivo de la build, las claves de lo que importa de forma estática y su CSS. */
interface ManifestChunk {
	file: string;
	imports?: string[];
	css?: string[];
}

/** El layout (nodes/0) y la página de error (nodes/1): start() de SvelteKit los importa siempre al arrancar. */
const START_NODES = /^_app\/immutable\/nodes\/[01]\.[^/]*\.js$/;

/** Las páginas .html de `dir`, también las de subcarpetas («x/zen.html»), sin mirar en _app ni en data. */
async function pages(dir: string, sub = ''): Promise<string[]> {
	const out: string[] = [];
	for (const entry of await readdir(join(dir, sub), { withFileTypes: true })) {
		const path = sub ? `${sub}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			if (path !== '_app' && path !== 'data') out.push(...(await pages(dir, path)));
		} else if (entry.name.endsWith('.html')) out.push(path);
	}
	return out;
}

/**
 * El JS y el CSS que arrancan las páginas de `dir` (salvo SKIP): lo que nombra su HTML, nodes/0 y nodes/1, y lo
 * que todo eso importa de forma estática, con su CSS (según `manifest`). «_app/immutable/…», sin repetir y en orden.
 */
export async function precacheList(dir = 'build', manifest = MANIFEST): Promise<string[]> {
	const found = new Set<string>();
	for (const page of await pages(dir)) {
		if (SKIP.has(page)) continue;
		for (const ref of refsOf(await readFile(join(dir, page), 'utf8'))) found.add(ref);
	}
	const chunks = JSON.parse(await readFile(manifest, 'utf8')) as Record<string, ManifestChunk>;
	const byFile = new Map(Object.values(chunks).map((c) => [c.file, c]));
	// Se recorre de cada archivo a lo que importa (el CSS no sale como archivo en el manifest: no tiene entrada).
	const has = (c: ManifestChunk | undefined): c is ManifestChunk => !!c;
	const todo = [...found, ...[...byFile.keys()].filter((f) => START_NODES.test(f))].map((f) => byFile.get(f)).filter(has);
	const seen = new Set<ManifestChunk>();
	while (todo.length) {
		const chunk = todo.pop() as ManifestChunk;
		if (seen.has(chunk)) continue;
		seen.add(chunk);
		found.add(chunk.file);
		for (const css of chunk.css ?? []) found.add(css);
		todo.push(...(chunk.imports ?? []).map((key) => chunks[key]).filter(has));
	}
	return [...found].sort();
}

/** Import y export estáticos de un JS de la build («import{a}from"../chunks/x.js"», «import"./y.js"»); no los import(). */
const STATIC_IMPORT = /\b(?:import|export)\s*(?:[\w$\s{},*]*?\bfrom\s*)?["'](\.\.?\/[^"']+\.js)["']/g;

/**
 * Comprobación independiente del manifest, sobre los archivos de verdad: lo que importan de forma estática los JS
 * de `files` (y nodes/0 y nodes/1) que existe en `dir` y no está en `files`. Tiene que salir vacío: si no, esa
 * vista no arrancaría sin conexión.
 */
export async function unlisted(dir: string, files: string[]): Promise<string[]> {
	const listed = new Set(files);
	const out = new Set<string>();
	const nodes = existsSync(join(dir, '_app/immutable/nodes')) ? await readdir(join(dir, '_app/immutable/nodes')) : [];
	for (const node of nodes.map((n) => `_app/immutable/nodes/${n}`)) if (START_NODES.test(node) && !listed.has(node)) out.add(node);
	for (const file of files.filter((f) => f.endsWith('.js'))) {
		const code = await readFile(join(dir, file), 'utf8').catch(() => '');
		for (const m of code.matchAll(STATIC_IMPORT)) {
			const dep = posix.join(posix.dirname(file), m[1]);
			if (!listed.has(dep) && existsSync(join(dir, dep))) out.add(dep);
		}
	}
	return [...out].sort();
}

/**
 * Escribe la lista con la versión de la build (la de _app/version.json): el service worker solo usa la de su
 * misma publicación. También la deja en `copies` (las carpetas de las que sirve _app `vite preview`, que usan la
 * prueba de humo y las medidas). Devuelve los archivos. Si a la lista le falta algo que importan sus archivos
 * (unlisted), falla la build: así lo ve el job checks del PR y no se publica un service worker que deja una vista
 * sin arrancar sin conexión.
 */
export async function writePrecache(dir = 'build', copies: string[] = [], manifest = MANIFEST): Promise<string[]> {
	const { version } = JSON.parse(await readFile(join(dir, '_app/version.json'), 'utf8')) as { version: string };
	const files = await precacheList(dir, manifest);
	const missing = await unlisted(dir, files);
	if (missing.length) throw new Error(`Precaché (scripts/precache.ts): a la lista le falta lo que importan sus archivos: ${missing.join(', ')}`);
	const json = JSON.stringify({ version, files });
	for (const out of [dir, ...copies]) if (existsSync(join(out, '_app'))) await writeFile(join(out, LIST_PATH), json);
	return files;
}

/** De aquí sirve `vite preview` lo de _app (el resto de la build sale de .svelte-kit/output/prerendered). */
export const PREVIEW = '.svelte-kit/output/client';

/**
 * Plugin de Vite que escribe la lista al terminar la build. El adaptador de SvelteKit también va en el buildApp
 * 'post', pero su plugin está antes en la lista (sveltekit()), así que cuando llega este, build/ ya está escrito.
 */
export function precachePlugin(dir = 'build'): Plugin {
	return {
		name: 'arc-precache',
		apply: 'build',
		buildApp: {
			order: 'post',
			async handler() {
				await writePrecache(dir, [PREVIEW]);
			}
		}
	};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const files = await writePrecache('build', [PREVIEW]);
	console.log(`${files.length} archivos en build/${LIST_PATH}`);
}
