// Red Eléctrica: mix de generación por tecnologías y emisiones de CO₂ (España y Baleares).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { powerMix } from '../sources/ree-mix.ts';
import { mockFetch } from './mock.ts';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
	vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

const D13 = '2026-10-13T00:00:00.000+02:00';
const D14 = '2026-10-14T00:00:00.000+02:00';

/** Una tecnología con la forma de «included» de apidatos.ree.es. */
const tech = (title: string, type: string, values: [string, number | null][], composite = false) => ({
	type: title,
	id: `id-${title}`,
	groupId: null,
	attributes: {
		title,
		description: null,
		color: '#000',
		type,
		magnitude: null,
		composite,
		'last-update': '2026-10-14T09:00:00.000+02:00',
		values: values.map(([datetime, value]) => ({ value, percentage: 0, datetime }))
	}
});

const structure = {
	data: { type: 'Estructura generación', id: 'gen', attributes: { title: 'Estructura de la generación' } },
	included: [
		tech('Eólica', 'Renovable', [[D13, 90], [D14, 100]]),
		tech('Solar fotovoltaica', 'Renovable', [[D13, 60], [D14, 50]]),
		tech('Hidráulica', 'Renovable', [[D14, 30]]),
		tech('Nuclear', 'No-Renovable', [[D14, 120]]),
		tech('Ciclo combinado', 'No-Renovable', [[D14, 80]]),
		tech('Cogeneración', 'No-Renovable', [[D14, 20]]),
		// Consume en vez de generar: no cuenta.
		tech('Turbinación bombeo', 'Renovable', [[D14, -5]]),
		// El total que REE manda como una tecnología más: fuera.
		tech('Generación total', 'Generación total', [[D14, 395]], true)
	]
};

const co2 = {
	included: [
		tech('Ciclo combinado', 'No-Renovable', [[D14, 30000]]),
		tech('tCO2 eq. Total', 'No-Renovable', [[D13, 41000.4], [D14, 39000.6]])
	]
};

const parts = (url: string) => {
	const u = new URL(url);
	return { path: u.pathname.split('/').pop(), system: u.searchParams.get('geo_limit') };
};

describe('power-mix (REE)', () => {
	it('agrupa las tecnologías del último día con datos y calcula renovable y CO₂', async () => {
		const fetch = mockFetch((url) => {
			const { path, system } = parts(url);
			if (system === 'baleares') {
				// Baleares todavía no tiene el dato de hoy ni emisiones: se queda con ayer y CO₂ sin dato.
				return path === 'estructura-generacion' ? { included: [tech('Ciclo combinado', 'No-Renovable', [[D13, 8]]), tech('Solar fotovoltaica', 'Renovable', [[D13, 2]])] } : undefined;
			}
			return path === 'estructura-generacion' ? structure : co2;
		});
		const { systems } = await powerMix.fetch(undefined);

		const es = systems.find((s) => s.id === 'nacional')!;
		expect(es).toMatchObject({ label: 'España', date: '2026-10-14', mwh: 400, co2: 39001 });
		expect(es.renewable).toBeCloseTo(180 / 400);
		expect(es.groups.map((g) => [g.key, g.mwh, g.techs])).toEqual([
			['wind', 100, ['Eólica']],
			['solar', 50, ['Solar fotovoltaica']],
			['hydro', 30, ['Hidráulica']],
			['nuclear', 120, ['Nuclear']],
			['gas', 80, ['Ciclo combinado']],
			['other', 20, ['Cogeneración']]
		]);
		expect(es.groups[0].share).toBeCloseTo(0.25);

		const ib = systems.find((s) => s.id === 'baleares')!;
		expect(ib).toMatchObject({ label: 'Baleares', date: '2026-10-13', mwh: 10, co2: null, renewable: 0.2 });

		// Pide ayer y hoy (día de Madrid) del sistema eléctrico que toca.
		const first = new URL(String(fetch.mock.calls[0][0]));
		expect(first.searchParams.get('start_date')).toBe('2026-10-13T00:00');
		expect(first.searchParams.get('end_date')).toBe('2026-10-14T23:59');
		expect(first.searchParams.get('geo_ids')).toBe('8741');
	});

	it('aguanta valores nulos, títulos ausentes y sistemas sin datos', async () => {
		mockFetch((url) => {
			const { path, system } = parts(url);
			if (path !== 'estructura-generacion') return { included: null };
			if (system === 'baleares') return { included: [tech('Eólica', 'Renovable', [])] };
			const noTitle = tech('Nuclear', 'No-Renovable', [[D14, 50]]);
			delete (noTitle.attributes as Record<string, unknown>).title;
			return {
				included: [
					tech('Eólica', 'Renovable', [[D14, null]]),
					{ type: 'Solar', attributes: { values: null } },
					{ type: 'Raro' },
					noTitle
				]
			};
		});
		const { systems } = await powerMix.fetch(undefined);
		expect(systems.map((s) => s.id)).toEqual(['nacional']);
		expect(systems[0]).toMatchObject({ date: '2026-10-14', mwh: 50, renewable: 0, co2: null });
		// Sin título, se usa el «type» de REE.
		expect(systems[0].groups.find((g) => g.key === 'nuclear')!.techs).toEqual(['Nuclear']);
		expect(console.log).toHaveBeenCalledWith('  power-mix · Baleares: sin datos');
	});

	it('lanza un error si REE no da el mix de ningún sistema', async () => {
		mockFetch(() => ({ included: [] }));
		await expect(powerMix.fetch(undefined)).rejects.toThrow('REE no da el mix de generación');
	});
});
