// Precaché del service worker: la lista que escribe la build y qué elige el service worker con ella.
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { bootFiles } from '../../src/service-worker/precache.ts';
import { LIST_PATH, precacheList, writePrecache } from '../precache.ts';

let dir = '';
afterEach(async () => {
	if (dir) await rm(dir, { recursive: true, force: true });
	dir = '';
});

/** Una build de mentira: páginas con sus modulepreload y el import() del arranque. */
async function fakeBuild(): Promise<string> {
	dir = await mkdtemp(join(tmpdir(), 'arc-precache-'));
	const page = (refs: string[], up = '.') =>
		refs.map((r) => `<link rel="modulepreload" href="${up}/_app/immutable/${r}">`).join('') +
		`<script>Promise.all([import("${up}/_app/immutable/entry/start.js"), import("${up}/_app/immutable/entry/app.js")])</script>`;
	await mkdir(join(dir, '_app'), { recursive: true });
	await mkdir(join(dir, 'x'));
	await mkdir(join(dir, 'data'));
	await writeFile(join(dir, '_app/version.json'), JSON.stringify({ version: '123' }));
	await writeFile(join(dir, 'index.html'), page(['nodes/0.a.js', 'nodes/2.top.js', 'chunks/shared.js']));
	await writeFile(join(dir, 'eco.html'), page(['nodes/0.a.js', 'nodes/5.eco.js', 'chunks/shared.js', 'assets/5.eco.css']));
	await writeFile(join(dir, 'x/zen.html'), page(['nodes/9.zen.js'], '..'));
	await writeFile(join(dir, 'os.html'), page(['nodes/39.os.js', 'chunks/desktop.js']));
	await writeFile(join(dir, 'data/raro.html'), page(['chunks/nunca.js']));
	return dir;
}

describe('precache', () => {
	it('junta lo que arranca cada vista (también /x/*), sin Arc OS ni lo de data/', async () => {
		const files = await precacheList(await fakeBuild());
		expect(files).toEqual([
			'_app/immutable/assets/5.eco.css',
			'_app/immutable/chunks/shared.js',
			'_app/immutable/entry/app.js',
			'_app/immutable/entry/start.js',
			'_app/immutable/nodes/0.a.js',
			'_app/immutable/nodes/2.top.js',
			'_app/immutable/nodes/5.eco.js',
			'_app/immutable/nodes/9.zen.js'
		]);
	});

	it('escribe la lista con la versión de la build, también donde la sirve vite preview', async () => {
		const build = await fakeBuild();
		await mkdir(join(build, 'preview/_app'), { recursive: true });
		await writePrecache(build, [join(build, 'preview'), join(build, 'sin-app')]);
		const list = JSON.parse(await readFile(join(build, LIST_PATH), 'utf8'));
		expect(list.version).toBe('123');
		expect(list.files).toContain('_app/immutable/nodes/2.top.js');
		expect(list.files).not.toContain('_app/immutable/nodes/39.os.js');
		expect(JSON.parse(await readFile(join(build, 'preview', LIST_PATH), 'utf8'))).toEqual(list);
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
});
