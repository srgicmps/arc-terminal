// Polymarket (gamma-api /events): probabilidades de los mercados de predicción.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { predictions } from '../sources/predictions.ts';
import { mockFetch } from './mock.ts';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

/** Forma real: «outcomes» y «outcomePrices» llegan como texto JSON. */
const market = (over: Record<string, unknown> = {}) => ({
	id: 'm1',
	question: '¿Pasará algo?',
	groupItemTitle: '',
	outcomes: '["Yes", "No"]',
	outcomePrices: '["0.23", "0.77"]',
	active: true,
	closed: false,
	...over
});

const event = (id: string, markets: unknown, over: Record<string, unknown> = {}) => ({
	id,
	slug: `evento-${id}`,
	title: `Evento ${id}`,
	endDate: '2026-12-31T12:00:00Z',
	volume24hr: 125000.5,
	active: true,
	closed: false,
	markets,
	...over
});

const tagOf = (url: string) => new URL(url).searchParams.get('tag_slug');

describe('predictions', () => {
	it('lee los eventos de un mercado (Sí/No) y de varios (fechas, candidatos)', async () => {
		const fetch = mockFetch((url) =>
			tagOf(url) === 'geopolitics'
				? [
						event('1', [market()]),
						event('2', [
							market({ id: 'a', groupItemTitle: 'Antes de noviembre', outcomePrices: '["0.1","0.9"]' }),
							market({ id: 'b', groupItemTitle: 'Antes de diciembre', outcomePrices: '["0.35","0.65"]' }),
							market({ id: 'c', groupItemTitle: 'Ya cerrado', outcomePrices: '["1","0"]', closed: true })
						])
					]
				: [event('3', [market({ outcomes: ['Yes', 'No'], outcomePrices: ['0.6', '0.4'] })])]
		);
		const data = await predictions.fetch(undefined);
		expect(data.geopolitics).toEqual([
			{
				id: '1',
				title: 'Evento 1',
				url: 'https://polymarket.com/event/evento-1',
				volume24h: 125000.5,
				endDate: '2026-12-31T12:00:00Z',
				outcomes: [
					{ label: 'No', p: 0.77 },
					{ label: 'Sí', p: 0.23 }
				]
			},
			expect.objectContaining({
				id: '2',
				outcomes: [
					{ label: 'Antes de diciembre', p: 0.35 },
					{ label: 'Antes de noviembre', p: 0.1 }
				]
			})
		]);
		// También acepta las listas ya como array.
		expect(data.economy[0].outcomes).toEqual([
			{ label: 'Sí', p: 0.6 },
			{ label: 'No', p: 0.4 }
		]);
		const url = new URL(String(fetch.mock.calls[0][0]));
		expect(url.searchParams.get('order')).toBe('volume24hr');
		expect(url.searchParams.get('closed')).toBe('false');
	});

	it('cambio en 24 h (oneDayPriceChange): el del «Sí» y, con dos opciones, el contrario para el «No»', async () => {
		mockFetch((url) =>
			tagOf(url) === 'geopolitics'
				? [
						event('1', [market({ oneDayPriceChange: 0.05 })]),
						event('2', [
							market({ id: 'a', groupItemTitle: 'Antes de noviembre', outcomePrices: '["0.1","0.9"]', oneDayPriceChange: -0.02 }),
							market({ id: 'b', groupItemTitle: 'Antes de diciembre', outcomePrices: '["0.35","0.65"]' })
						])
					]
				: []
		);
		const data = await predictions.fetch(undefined);
		expect(data.geopolitics[0].outcomes).toEqual([
			{ label: 'No', p: 0.77, d: -0.05 },
			{ label: 'Sí', p: 0.23, d: 0.05 }
		]);
		expect(data.geopolitics[1].outcomes).toEqual([
			{ label: 'Antes de diciembre', p: 0.35 },
			{ label: 'Antes de noviembre', p: 0.1, d: -0.02 }
		]);
	});

	it('aguanta campos nulos y descarta los eventos sin mercados abiertos', async () => {
		mockFetch((url) =>
			tagOf(url) === 'geopolitics'
				? [
						event('sin-mercados', null),
						event('cerrados', [market({ closed: true }), market({ active: false })]),
						event('raro', [market({ outcomes: 'no es JSON', outcomePrices: null })]),
						event('nulos', [market()], { volume24hr: null, endDate: null }),
						event('pregunta', [market({ groupItemTitle: null, question: 'Sin título de grupo' }), market({ groupItemTitle: '', question: null, outcomePrices: '[]' })])
					]
				: []
		);
		const data = await predictions.fetch(undefined);
		expect(data.geopolitics.map((p) => p.id)).toEqual(['nulos', 'pregunta']);
		expect(data.geopolitics[0]).toMatchObject({
			volume24h: 0,
			endDate: '',
			outcomes: [
				{ label: 'No', p: 0.77 },
				{ label: 'Sí', p: 0.23 }
			]
		});
		// Sin groupItemTitle se usa la pregunta; sin pregunta ni título, fuera.
		expect(data.geopolitics[1].outcomes).toEqual([{ label: 'Sin título de grupo', p: 0.23 }]);
	});

	it('descarta los mercados sin precios en vez de darles un 0 %', async () => {
		mockFetch((url) =>
			tagOf(url) === 'geopolitics'
				? [
						event('sin-precios', [market({ outcomePrices: undefined })]),
						event('precios-vacios', [market({ outcomePrices: '[]' })]),
						event('precios-no-json', [market({ outcomePrices: 'no es JSON' })]),
						event('falta-uno', [market({ outcomePrices: '["0.4"]' })]),
						event('varios', [
							market({ id: 'a', groupItemTitle: 'Con precio', outcomePrices: '["0.3","0.7"]' }),
							market({ id: 'b', groupItemTitle: 'Sin precio', outcomePrices: '' }),
							market({ id: 'c', groupItemTitle: 'Precio null', outcomePrices: null })
						])
					]
				: []
		);
		const data = await predictions.fetch(undefined);
		expect(data.geopolitics.map((p) => p.id)).toEqual(['falta-uno', 'varios']);
		expect(data.geopolitics[0].outcomes).toEqual([{ label: 'Sí', p: 0.4 }]);
		expect(data.geopolitics[1].outcomes).toEqual([{ label: 'Con precio', p: 0.3 }]);
	});

	it('sin slug del evento enlaza al mercado, y si tampoco hay, descarta el evento', async () => {
		mockFetch((url) =>
			tagOf(url) === 'geopolitics'
				? [
						event('con-mercado', [market({ slug: 'mercado-x' })], { slug: undefined }),
						event('sin-nada', [market()], { slug: null }),
						event('vacio', [market({ slug: '' })], { slug: '' })
					]
				: []
		);
		const data = await predictions.fetch(undefined);
		expect(data.geopolitics.map((p) => p.url)).toEqual(['https://polymarket.com/market/mercado-x']);
		for (const p of data.geopolitics) expect(p.url).not.toContain('undefined');
	});

	it('si falla la parte de economía, sigue con geopolítica', async () => {
		mockFetch((url) => (tagOf(url) === 'geopolitics' ? [event('1', [market()])] : new Response('', { status: 403 })));
		const data = await predictions.fetch(undefined);
		expect(data.geopolitics).toHaveLength(1);
		expect(data.economy).toEqual([]);
	});

	it('lanza un error si no hay ningún mercado', async () => {
		mockFetch(() => []);
		await expect(predictions.fetch(undefined)).rejects.toThrow('sin mercados');
	});
});
