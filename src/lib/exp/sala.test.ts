import { describe, expect, it } from 'vitest';
import { conflictPoints, electionPoints, newByRegion, regionAt, travelPoints, type SalaPoint } from './sala.ts';

describe('Sala de control', () => {
	it('sitúa regiones por coordenadas', () => {
		expect(regionAt(40, -100)).toBe('america');
		expect(regionAt(48, 2)).toBe('europa');
		expect(regionAt(32, 35)).toBe('oriente');
		expect(regionAt(0, 20)).toBe('africa');
		expect(regionAt(35, 139)).toBe('asia');
	});

	it('pone los titulares en los países que nombran', () => {
		const pts = conflictPoints([{ title: 'Ukraine and Russia resume talks', url: 'u', source: 'BBC', time: '2026-10-15T10:00:00Z' }]);
		expect(pts.map((p) => p.country).sort()).toEqual(['RU', 'UA']);
		expect(pts[0].region).toBe('europa');
	});

	it('solo pinta avisos de viaje de nivel 3 y 4', () => {
		const pts = travelPoints({ items: [{ name: 'Ukraine', level: 4, title: '', url: 'u', updated: '' }, { name: 'France', level: 2, title: '', url: 'u', updated: '' }] });
		expect(pts.map((p) => p.country)).toEqual(['UA']);
		expect(pts[0].strong).toBe(true);
	});

	it('solo las elecciones del próximo mes', () => {
		const now = Date.parse('2026-10-15T12:00:00Z');
		const e = (date: string) => ({ date, country: 'España', iso: 'ES', kind: 'general' as never, name: 'Generales', url: 'u' });
		expect(electionPoints([e('2026-10-20'), e('2027-03-01'), e('2026-09-01')], now)).toHaveLength(1);
	});

	it('cuenta lo nuevo por región desde la última visita', () => {
		const p = (region: SalaPoint['region'], t: string | null): SalaPoint => ({ id: Math.random() + '', layer: 'quakes', lat: 0, lon: 0, r: 1, title: '', sub: '', url: '', t, region });
		const out = newByRegion([p('asia', '2026-10-15T10:00:00Z'), p('asia', '2026-10-14T10:00:00Z'), p('europa', null)], '2026-10-15T00:00:00Z');
		expect(out.find((r) => r.id === 'asia')!.count).toBe(1);
		expect(out.find((r) => r.id === 'europa')!.count).toBe(0);
		expect(newByRegion([p('asia', '2026-10-15T10:00:00Z')], null)[0].count).toBe(0);
	});
});
