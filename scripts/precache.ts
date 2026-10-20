/// <reference types="node" />
// Lista de la precaché del service worker (build/_app/precache.json). El service worker solo sabe qué archivos
// hay en _app/immutable, no cuáles usa cada vista. Esta lista le dice qué hace falta para arrancar cualquier
// vista: lo que nombra su HTML (modulepreload, hojas de estilo e import() del arranque, con refsOf de weight.ts).
// Quedan fuera Arc OS (/os) y lo que solo se carga con import() (estéticas, ventanas de Arc OS, globo…): el
// service worker lo guarda la primera vez que se pide, así quien no lo usa no lo descarga.
// La escribe un plugin de Vite al final de `vite build`, cuando el adaptador ya ha dejado build/ (vite.config.ts).
// También se puede lanzar a mano: `node scripts/precache.ts` (con build/ hecho).
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { refsOf } from './weight.ts';

/** Dónde la busca el service worker (src/service-worker/index.ts), relativo a la raíz de la web. */
export const LIST_PATH = '_app/precache.json';

/** Páginas que no entran: Arc OS solo se descarga si se abre (tampoco cuenta en el peso, weight.ts → EXEMPT). */
export const SKIP = new Set(['os.html']);

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

/** El JS y el CSS que nombran las páginas de `dir` (salvo SKIP): «_app/immutable/…», sin repetir y en orden. */
export async function precacheList(dir = 'build'): Promise<string[]> {
	const found = new Set<string>();
	for (const page of await pages(dir)) {
		if (SKIP.has(page)) continue;
		for (const ref of refsOf(await readFile(join(dir, page), 'utf8'))) found.add(ref);
	}
	return [...found].sort();
}

/**
 * Escribe la lista con la versión de la build (la de _app/version.json): el service worker solo usa la de su
 * misma publicación. También la deja en `copies` (las carpetas de las que sirve _app `vite preview`, que usan la
 * prueba de humo y las medidas). Devuelve los archivos.
 */
export async function writePrecache(dir = 'build', copies: string[] = []): Promise<string[]> {
	const { version } = JSON.parse(await readFile(join(dir, '_app/version.json'), 'utf8')) as { version: string };
	const files = await precacheList(dir);
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
