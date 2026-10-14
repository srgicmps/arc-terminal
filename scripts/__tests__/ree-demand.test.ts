import { afterEach, describe, expect, it, vi } from 'vitest';
import { demandUrl, parseDemand, reeDemand } from '../sources/ree-demand.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllGlobals());

const at = (hhmm: string) => `2026-10-14T${hhmm}:00.000+02:00`;
const values = (pairs: [string, number][]) => pairs.map(([t, value]) => ({ value, percentage: 0.3, datetime: at(t) }));

const body = {
	data: { type: 'Demanda nacional en tiempo real', id: 'dem15' },
	included: [
		{ type: 'Prevista', attributes: { title: 'Prevista', values: values([['15:40', 30000], ['15:45', 30100], ['15:50', 30200]]) } },
		{ type: 'Programada', attributes: { title: 'Programada', values: values([['15:45', 29900]]) } },
		{ type: 'Real', attributes: { title: 'Real', values: values([['15:40', 29800], ['15:45', 15050]]) } }
	]
};

describe('ree-demand', () => {
	it('pide desde ayer hasta hoy en hora de Madrid', () => {
		expect(demandUrl()).toMatch(/demanda-tiempo-real\?start_date=\d{4}-\d\d-\d\dT00%3A00&end_date=\d{4}-\d\d-\d\dT23%3A59/);
	});

	it('toma el último dato real y lo compara con la prevista de ese instante', () => {
		expect(parseDemand(body)).toEqual({
			time: '2026-10-14T13:45:00.000Z',
			real: 15050,
			forecast: 30100,
			scheduled: 29900,
			gap: 50,
			recent: [
				{ time: '2026-10-14T13:40:00.000Z', real: 29800, forecast: 30000 },
				{ time: '2026-10-14T13:45:00.000Z', real: 15050, forecast: 30100 }
			]
		});
	});

	it('sin demanda real, falla (y se reutiliza la copia anterior)', async () => {
		mockFetch(() => ({ included: [body.included[0]] }));
		await expect(reeDemand.fetch(undefined)).rejects.toThrow('demanda real');
	});
});
