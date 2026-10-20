// Precaché del service worker: la lista que escribe la build y qué elige el service worker con ella.
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { bootFiles, precacheable } from '../../src/service-worker/precache.ts';
import { LIST_PATH, precacheList, unlisted, writePrecache } from '../precache.ts';

let dir = '';
afterEach(async () => {
	if (dir) await rm(dir, { recursive: true, force: true });
	dir = '';
});

/** Lo que importa cada archivo, como lo deja Vite en su manifest (claves propias; el CSS va en `css`). */
const MANIFEST: Record<string, { file: string; imports?: string[]; dynamicImports?: string[]; css?: string[] }> = {
	start: { file: '_app/immutable/entry/start.js', imports: ['_shared.js'] },
	app: { file: '_app/immutable/entry/app.js', imports: ['_shared.js'], dynamicImports: ['n0', 'n1', 'n2', 'n5', 'n9', 'n39'] },
	n0: { file: '_app/immutable/nodes/0.a.js', imports: ['_thresholds.js'], css: ['_app/immutable/assets/0.a.css'] },
	n1: { file: '_app/immutable/nodes/1.err.js', imports: ['_shared.js'] },
	n2: { file: '_app/immutable/nodes/2.top.js', imports: ['_change.js'], dynamicImports: ['_lazy.js'] },
	n5: { file: '_app/immutable/nodes/5.eco.js', css: ['_app/immutable/assets/5.eco.css'] },
	n9: { file: '_app/immutable/nodes/9.zen.js' },
	n39: { file: '_app/immutable/nodes/39.os.js', imports: ['_desktop.js'] },
	'_shared.js': { file: '_app/immutable/chunks/shared.js' },
	'_thresholds.js': { file: '_app/immutable/chunks/thresholds.js', css: ['_app/immutable/assets/thresholds.css'] },
	'_change.js': { file: '_app/immutable/chunks/change.js', imports: ['_reexp.js'] },
	'_reexp.js': { file: '_app/immutable/chunks/reexp.js' },
	'_lazy.js': { file: '_app/immutable/chunks/lazy.js' },
	'_desktop.js': { file: '_app/immutable/chunks/desktop.js' },
	'_nunca.js': { file: '_app/immutable/chunks/nunca.js' }
};

/** El código de cada archivo (minificado, como sale de la build): sus import y export estáticos y algún import(). */
const CODE: Record<string, string> = {
	'entry/start.js': 'import{a as s}from"../chunks/shared.js";export{s as start};',
	'entry/app.js': 'import"../chunks/shared.js";const n=[()=>import("../nodes/0.a.js"),()=>import("../nodes/1.err.js")];',
	'nodes/0.a.js': 'import{t}from"../chunks/thresholds.js";',
	'nodes/1.err.js': 'import{a}from"../chunks/shared.js";',
	'nodes/2.top.js': 'import{c as e}from"../chunks/change.js";const l=()=>import("../chunks/lazy.js");',
	'nodes/5.eco.js': 'const e=1;',
	'nodes/9.zen.js': 'const z=1;',
	'nodes/39.os.js': 'import"../chunks/desktop.js";',
	'chunks/shared.js': 'const a=1;export{a};',
	'chunks/thresholds.js': 'const t=1;export{t};',
	'chunks/change.js': 'export{x as c}from"./reexp.js";',
	'chunks/reexp.js': 'const x=1;export{x};',
	'chunks/lazy.js': 'export const l=1;',
	'chunks/desktop.js': 'export const d=1;',
	'chunks/nunca.js': 'export const n=1;'
};

/**
 * Una build de mentira: páginas con sus modulepreload y el import() del arranque, el código de cada archivo y el
 * manifest de Vite. Como en la de verdad, el HTML no lo nombra todo: ni nodes/1 (la página de error), ni lo que
 * importan nodes/0 (thresholds.js) y TOP (change.js, y este, reexp.js). Devuelve la carpeta y su manifest.
 */
async function fakeBuild(manifest = MANIFEST): Promise<{ build: string; manifest: string }> {
	dir = await mkdtemp(join(tmpdir(), 'arc-precache-'));
	const page = (refs: string[], up = '.') =>
		refs.map((r) => `<link rel="modulepreload" href="${up}/_app/immutable/${r}">`).join('') +
		`<script>Promise.all([import("${up}/_app/immutable/entry/start.js"), import("${up}/_app/immutable/entry/app.js")])</script>`;
	for (const sub of ['entry', 'nodes', 'chunks']) await mkdir(join(dir, '_app/immutable', sub), { recursive: true });
	await mkdir(join(dir, 'x'));
	await mkdir(join(dir, 'data'));
	for (const [file, code] of Object.entries(CODE)) await writeFile(join(dir, '_app/immutable', file), code);
	await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
	await writeFile(join(dir, '_app/version.json'), JSON.stringify({ version: '123' }));
	await writeFile(join(dir, 'index.html'), page(['nodes/0.a.js', 'nodes/2.top.js', 'chunks/shared.js']));
	await writeFile(join(dir, 'eco.html'), page(['nodes/0.a.js', 'nodes/5.eco.js', 'chunks/shared.js', 'assets/5.eco.css']));
	await writeFile(join(dir, 'x/zen.html'), page(['nodes/9.zen.js'], '..'));
	await writeFile(join(dir, 'os.html'), page(['nodes/39.os.js', 'chunks/desktop.js']));
	await writeFile(join(dir, 'data/raro.html'), page(['chunks/nunca.js']));
	return { build: dir, manifest: join(dir, 'manifest.json') };
}

describe('precache', () => {
	it('junta lo que arranca cada vista (también /x/*) y lo que importa, sin Arc OS, ni import(), ni lo de data/', async () => {
		const { build, manifest } = await fakeBuild();
		expect(await precacheList(build, manifest)).toEqual([
			'_app/immutable/assets/0.a.css',
			'_app/immutable/assets/5.eco.css',
			'_app/immutable/assets/thresholds.css',
			'_app/immutable/chunks/change.js',
			'_app/immutable/chunks/reexp.js',
			'_app/immutable/chunks/shared.js',
			'_app/immutable/chunks/thresholds.js',
			'_app/immutable/entry/app.js',
			'_app/immutable/entry/start.js',
			'_app/immutable/nodes/0.a.js',
			'_app/immutable/nodes/1.err.js',
			'_app/immutable/nodes/2.top.js',
			'_app/immutable/nodes/5.eco.js',
			'_app/immutable/nodes/9.zen.js'
		]);
	});

	it('unlisted: lo que importan (import y export…from) los archivos de la lista y no está, y nodes/0 y nodes/1', async () => {
		const { build, manifest } = await fakeBuild();
		const files = await precacheList(build, manifest);
		expect(await unlisted(build, files)).toEqual([]);
		const without = files.filter((f) => !/(change|reexp|nodes\/1\.)/.test(f));
		expect(await unlisted(build, without)).toEqual(['_app/immutable/chunks/change.js', '_app/immutable/nodes/1.err.js']);
		expect(await unlisted(build, files.filter((f) => !f.includes('reexp')))).toEqual(['_app/immutable/chunks/reexp.js']);
	});

	it('escribe la lista con la versión de la build, también donde la sirve vite preview', async () => {
		const { build, manifest } = await fakeBuild();
		await mkdir(join(build, 'preview/_app'), { recursive: true });
		await writePrecache(build, [join(build, 'preview'), join(build, 'sin-app')], manifest);
		const list = JSON.parse(await readFile(join(build, LIST_PATH), 'utf8'));
		expect(list.version).toBe('123');
		expect(list.files).toContain('_app/immutable/nodes/2.top.js');
		expect(list.files).toContain('_app/immutable/chunks/thresholds.js');
		expect(list.files).not.toContain('_app/immutable/nodes/39.os.js');
		expect(JSON.parse(await readFile(join(build, 'preview', LIST_PATH), 'utf8'))).toEqual(list);
	});

	it('si al manifest le falta algo que el código importa, la build falla y no escribe la lista', async () => {
		const { build, manifest } = await fakeBuild({ ...MANIFEST, n2: { file: '_app/immutable/nodes/2.top.js' } });
		await expect(writePrecache(build, [], manifest)).rejects.toThrow(/chunks\/change\.js/);
		expect(existsSync(join(build, LIST_PATH))).toBe(false);
	});
});

describe('bootFiles (service worker)', () => {
	const url = (p: string) => `https://arc.test/${p}`;
	const immutable = ['entry/start.js', 'nodes/2.top.js', 'nodes/39.os.js', 'chunks/lazy.js'].map((p) => url(`_app/immutable/${p}`));
	const list = { version: 'v1', files: ['_app/immutable/entry/start.js', '_app/immutable/nodes/2.top.js', '_app/immutable/viejo.js'] };

	it('con la lista de su publicación, solo lo que arranca las vistas (y que existe en la build)', () => {
		expect(bootFiles(list, 'v1', immutable, url)).toEqual([url('_app/immutable/entry/start.js'), url('_app/immutable/nodes/2.top.js')]);
	});

	it('sin lista, de otra publicación o sin nada que case: todo, como antes', () => {
		expect(bootFiles(null, 'v1', immutable, url)).toEqual(immutable);
		expect(bootFiles(list, 'v2', immutable, url)).toEqual(immutable);
		expect(bootFiles({ version: 'v1', files: 'no' }, 'v1', immutable, url)).toEqual(immutable);
		expect(bootFiles({ version: 'v1', files: ['_app/immutable/otro.js'] }, 'v1', immutable, url)).toEqual(immutable);
	});

	it('las letras (.woff2) nunca: el service worker guarda al pedirlas solo las de la estética que se usa', () => {
		const fonts = ['plex-mono-400-latin.a1.woff2', 'inter-latin.b2.woff2'].map((f) => url(`_app/immutable/assets/${f}`));
		const withFonts = [...immutable, ...fonts];
		expect(bootFiles(null, 'v1', withFonts, url)).toEqual(immutable);
		expect(bootFiles(list, 'v2', withFonts, url)).toEqual(immutable);
		const listed = { version: 'v1', files: ['_app/immutable/entry/start.js', '_app/immutable/assets/inter-latin.b2.woff2'] };
		expect(bootFiles(listed, 'v1', withFonts, url)).toEqual([url('_app/immutable/entry/start.js')]);
	});

	it('si no se puede leer la lista (sin red al instalar), tampoco las letras: precacheable, como bootFiles sin lista', () => {
		const fonts = ['plex-mono-400-latin.a1.woff2', 'inter-latin-ext.c3.woff2'].map((f) => url(`_app/immutable/assets/${f}`));
		const withFonts = [fonts[0], ...immutable, fonts[1]];
		expect(precacheable(withFonts)).toEqual(immutable);
		expect(precacheable(withFonts)).toEqual(bootFiles(null, 'v1', withFonts, url));
		expect(precacheable(immutable)).toEqual(immutable);
	});
});
