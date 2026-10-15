import { describe, expect, it } from 'vitest';
import { HEATMAPS, heatmapConfig, isHeatMap, SECTORS, WORLD } from './heatmaps.ts';

describe('mapas de calor (IMAP)', () => {
	it('claves y fuentes únicas', () => {
		expect(new Set(HEATMAPS.map((m) => m.key)).size).toBe(HEATMAPS.length);
		expect(new Set(HEATMAPS.map((m) => m.dataSource)).size).toBe(HEATMAPS.length);
		expect(isHeatMap('ibex')).toBe(true);
		expect(isHeatMap('nada')).toBe(false);
	});

	it('agrupa por sector y colorea por la variación del día', () => {
		expect(heatmapConfig(HEATMAPS[0])).toMatchObject({ dataSource: 'SPX500', grouping: 'sector', blockColor: 'change' });
	});

	it('los 11 sectores y un índice por país, sin repetir símbolos', () => {
		expect(SECTORS).toHaveLength(11);
		for (const list of [SECTORS, WORLD]) expect(new Set(list.map((s) => s.name)).size).toBe(list.length);
	});
});
