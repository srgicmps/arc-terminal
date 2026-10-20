import { describe, expect, it } from 'vitest';
import { dedupe, isSource, loadSources, sourcesIn } from '../registry.ts';

const fake = (name: string) => ({ name, label: name, maxAgeMinutes: 10, fetch: async () => [] });

describe('registro de fuentes', () => {
	// Una fuente nueva solo necesita su archivo en scripts/sources/.
	it('descubre todas las fuentes de scripts/sources/, sin repetir nombres', async () => {
		const names = (await loadSources()).map((s) => s.name);
		expect(names.length).toBeGreaterThan(60);
		expect(new Set(names).size).toBe(names.length);
		for (const name of ['fuel', 'boe', 'news-es', 'imp', 'search', 'translations']) expect(names).toContain(name);
	});

	it('reconoce fuentes sueltas y en listas, y no lo que solo se le parece', () => {
		expect(isSource(fake('a'))).toBe(true);
		expect(isSource({ name: 'x', fetch: () => 1 })).toBe(false);
		expect(sourcesIn({ a: fake('a'), list: [fake('b'), fake('c')], helper: () => 1, PORTS: [{ id: 'x' }] }).map((s) => s.name)).toEqual(['a', 'b', 'c']);
	});

	// Las críticas comprueban que sus datos tienen sentido (validate), no solo que hay elementos: una API que
	// cambia un campo no deja FUEL, ECO, WS, LUZ, WX, GEO ni IMP con datos vacíos o imposibles.
	it('las fuentes críticas tienen validate', async () => {
		const CRITICAL = ['fuel', 'fuel-es', 'ecb', 'uscurve', 'power', 'weather', 'quakes', 'imp'];
		const sources = await loadSources();
		const missing = CRITICAL.filter((name) => typeof sources.find((s) => s.name === name)?.validate !== 'function');
		expect(missing).toEqual([]);
	});

	it('si una fuente aparece dos veces, cuenta la primera', () => {
		const first = fake('a');
		expect(dedupe([[first], [fake('a'), fake('b')]])).toEqual([first, expect.objectContaining({ name: 'b' })]);
	});
});
