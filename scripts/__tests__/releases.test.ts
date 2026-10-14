import { describe, expect, it } from 'vitest';
import { compareVersions, releases } from '../sources/releases.ts';
import { mockFetch } from './mock.ts';

// Feed Atom con la forma del de GitHub: el enlace lleva la etiqueta (a veces codificada).
const atom = (repo: string, tags: [string, string][]) => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Release notes from ${repo}</title>
${tags
	.map(
		([tag, date]) => `<entry><id>tag:github.com,2008:Repository/1/${tag}</id><updated>${date}</updated>
<link rel="alternate" type="text/html" href="https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}"/>
<title>${tag}</title><content type="html">&lt;p&gt;Notas&lt;/p&gt;</content></entry>`
	)
	.join('\n')}</feed>`;

describe('releases', () => {
	it('compara versiones parte a parte', () => {
		expect(compareVersions('5.10.0', '5.9.3')).toBeGreaterThan(0);
		expect(compareVersions('22.20.0', '24.1.0')).toBeLessThan(0);
		expect(compareVersions('1.2', '1.2.0')).toBe(0);
	});

	it('se queda con la estable más alta de cada herramienta y descarta prereleases y otros paquetes', async () => {
		mockFetch((url) => {
			if (url.includes('sveltejs/kit'))
				return atom('sveltejs/kit', [
					['@sveltejs/adapter-static@4.0.1', '2026-10-13T10:00:00Z'],
					['@sveltejs/kit@3.1.0', '2026-10-12T10:00:00Z'],
					['@sveltejs/kit@3.0.9', '2026-10-01T10:00:00Z']
				]);
			if (url.includes('nodejs/node'))
				return atom('nodejs/node', [
					['v22.21.0', '2026-10-13T10:00:00Z'],
					['v24.10.0', '2026-10-08T10:00:00Z'],
					['v25.0.0-rc.1', '2026-10-10T10:00:00Z']
				]);
			if (url.includes('vuejs/core')) return atom('vuejs/core', [['v3.6.0-beta.2', '2026-10-13T10:00:00Z']]);
			return undefined;
		});
		const old = { repo: 'vuejs/core', name: 'Vue', version: '3.5.22', time: null, url: 'https://x' };
		const data = await releases.fetch([old]);
		expect(data).toEqual([
			// Vue no trae ninguna estable en el feed: se queda la de la vez anterior.
			old,
			{
				repo: 'sveltejs/kit',
				name: 'SvelteKit',
				version: '3.1.0',
				time: '2026-10-12T10:00:00.000Z',
				url: 'https://github.com/sveltejs/kit/releases/tag/%40sveltejs%2Fkit%403.1.0'
			},
			{
				repo: 'nodejs/node',
				name: 'Node.js',
				version: '24.10.0',
				time: '2026-10-08T10:00:00.000Z',
				url: 'https://github.com/nodejs/node/releases/tag/v24.10.0'
			}
		]);
	});

	it('falla si no responde ningún feed', async () => {
		mockFetch(() => undefined);
		await expect(releases.fetch(undefined)).rejects.toThrow('ningún feed');
	});
});
