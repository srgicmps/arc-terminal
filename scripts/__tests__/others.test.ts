// Resto de fuentes: BLS, Federal Register, riesgos naturales (IGN, NOAA, NASA) y Wikipedia.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bls } from '../sources/bls.ts';
import { fedreg } from '../sources/fedreg.ts';
import { hazards, quakesEs } from '../sources/hazards.ts';
import { wiki } from '../sources/wiki.ts';
import { mockFetch } from './mock.ts';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('bls', () => {
	const points = (values: [string, string, string][]) => values.map(([year, period, value]) => ({ year, period, value }));

	it('calcula la inflación interanual, el paro y los empleos creados en el mes', async () => {
		const fetch = mockFetch(() => ({
			status: 'REQUEST_SUCCEEDED',
			Results: {
				series: [
					{ seriesID: 'CUUR0000SA0', data: points([['2026', 'M09', '330.0'], ['2025', 'M09', '300.0'], ['2026', 'M13', '1']]) },
					{ seriesID: 'LNS14000000', data: points([['2026', 'M09', '4.3'], ['2026', 'M08', '4.2']]) },
					{ seriesID: 'CES0000000001', data: points([['2026', 'M09', '160150'], ['2026', 'M08', '160000']]) }
				]
			}
		}));
		const { series } = await bls.fetch(undefined);
		expect((fetch.mock.calls[0][1] as RequestInit).method).toBe('POST');
		const byId = Object.fromEntries(series.map((s) => [s.id, s.points]));
		expect(Object.keys(byId)).toEqual(['cpi-us', 'unemployment-us', 'payrolls-us']);
		expect(byId['cpi-us']).toEqual([{ t: '2026-09', v: 10 }]);
		expect(byId['unemployment-us']).toEqual([
			{ t: '2026-08', v: 4.2 },
			{ t: '2026-09', v: 4.3 }
		]);
		expect(byId['payrolls-us']).toEqual([{ t: '2026-09', v: 150 }]);
	});

	it('falla con el mensaje del BLS si la petición no sale bien', async () => {
		mockFetch(() => ({ status: 'REQUEST_NOT_PROCESSED', message: ['Daily threshold reached.'] }));
		await expect(bls.fetch(undefined)).rejects.toThrow('Daily threshold reached.');
	});
});

describe('fedreg', () => {
	it('lee decretos y normas', async () => {
		const fetch = mockFetch((url) => {
			const type = new URL(url).searchParams.get('conditions[type][]');
			return {
				results: [
					{
						document_number: `2026-${type}`,
						title: 'Executive Order 14999 &amp; more',
						type: 'Presidential Document',
						subtype: 'Executive Order',
						abstract: null,
						agencies: [{ name: 'Executive Office of the President' }, { raw_name: 'TREASURY' }, {}],
						publication_date: '2026-10-14',
						html_url: 'https://www.federalregister.gov/d/x',
						pdf_url: 'https://www.govinfo.gov/x.pdf'
					}
				]
			};
		});
		const data = await fedreg.fetch(undefined);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(data.presidential[0]).toEqual({
			id: '2026-PRESDOCU',
			title: 'Executive Order 14999 & more',
			type: 'Presidential Document',
			subtype: 'Executive Order',
			abstract: '',
			agencies: ['Executive Office of the President', 'TREASURY'],
			date: '2026-10-14',
			url: 'https://www.federalregister.gov/d/x',
			pdf: 'https://www.govinfo.gov/x.pdf'
		});
		expect(data.rules[0].id).toBe('2026-RULE');
	});
});

describe('quakesEs (IGN)', () => {
	const feed = (description: string, pubDate = '') => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<item>
	<title>-Info.terremoto: 13/10/2026 19:26:33</title>
	<link>http://www.ign.es/web/ign/portal/sis-catalogo-terremotos/-/catalogo-terremotos/detailTerremoto?evid=es2026abcd</link>
	${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
	<description>${description}</description>
</item>
</channel></rss>`;

	it('saca magnitud, lugar, hora y coordenadas del texto del IGN', async () => {
		mockFetch(() =>
			feed(
				'Se ha producido un terremoto de magnitud 2.7 en SW CABO DE SAN VICENTE en la fecha 13/10/2026 19:26:33 en la siguiente localización: 36.8518,-10.6319'
			)
		);
		const [q] = await quakesEs.fetch(undefined);
		expect(q).toMatchObject({
			mag: 2.7,
			place: 'SW Cabo de San Vicente',
			time: '2026-10-13T19:26:33.000Z',
			lat: 36.8518,
			lon: -10.6319,
			tsunami: false
		});
		expect(q.url).toContain('evid=es2026abcd');
	});

	it('falla si el IGN cambia el formato del texto', async () => {
		mockFetch(() => feed('Otro formato'));
		await expect(quakesEs.fetch(undefined)).rejects.toThrow('formato del IGN');
	});
});

describe('hazards (NOAA y NASA)', () => {
	it('lee huracanes y eventos, con geometría de punto o de polígono', async () => {
		mockFetch((url) => {
			if (url.includes('nhc.noaa.gov'))
				return {
					activeStorms: {
						id: 'al142026',
						name: 'Milton',
						classification: 'HU',
						intensity: '120',
						pressure: '940',
						latitudeNumeric: 25.1,
						longitudeNumeric: -85.2,
						lastUpdate: '2026-10-14T09:00:00.000Z',
						publicAdvisory: { url: 'https://www.nhc.noaa.gov/text/x.shtml' }
					}
				};
			if (url.includes('eonet'))
				return {
					events: [
						{
							id: 'EONET_1',
							title: 'Wildfire in Spain',
							categories: [{ title: 'Wildfires' }],
							sources: [{ url: 'https://inciweb/x' }],
							geometry: [
								{ date: '2026-10-12T00:00:00Z', coordinates: [1, 2] },
								{ date: '2026-10-13T00:00:00Z', coordinates: [-3.7, 40.4], magnitudeValue: 1200, magnitudeUnit: 'acres' }
							]
						},
						{
							id: 'EONET_2',
							title: 'Iceberg A23a',
							categories: [{ title: 'Sea and Lake Ice' }],
							link: 'https://eonet/2',
							geometry: { date: '2026-10-14T00:00:00Z', coordinates: [[[-40, -60], [-41, -61]]] }
						}
					]
				};
			return undefined;
		});
		const data = await hazards.fetch(undefined);
		expect(data.storms).toEqual([
			{
				id: 'al142026',
				name: 'Milton',
				classification: 'HU',
				knots: 120,
				pressure: 940,
				lat: 25.1,
				lon: -85.2,
				updated: '2026-10-14T09:00:00.000Z',
				url: 'https://www.nhc.noaa.gov/text/x.shtml'
			}
		]);
		expect(data.events).toEqual([
			{ id: 'EONET_2', title: 'Iceberg A23a', category: 'Sea and Lake Ice', date: '2026-10-14T00:00:00Z', url: 'https://eonet/2', lon: -40, lat: -60, magnitude: '' },
			{ id: 'EONET_1', title: 'Wildfire in Spain', category: 'Wildfires', date: '2026-10-13T00:00:00Z', url: 'https://inciweb/x', lon: -3.7, lat: 40.4, magnitude: '1200 acres' }
		]);
	});

	it('sigue con una sola de las dos fuentes y falla si no responde ninguna', async () => {
		mockFetch((url) => (url.includes('eonet') ? { events: [] } : undefined));
		expect(await hazards.fetch(undefined)).toEqual({ storms: [], events: [] });
		mockFetch(() => undefined);
		await expect(hazards.fetch(undefined)).rejects.toThrow('ni NOAA ni EONET');
	});
});

describe('wiki', () => {
	it('lee lo más leído (sin páginas especiales) y las efemérides, de la más reciente a la más antigua', async () => {
		const fetch = mockFetch((url) => url.includes('/wikipedia/en/') ? undefined : ({
			tfa: { normalizedtitle: 'Menorca', extract: '<b>Menorca</b> es una isla.', content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/Menorca' } } },
			mostread: {
				articles: [
					{ title: 'Especial:Buscar', views: 9e6, content_urls: { desktop: { page: 'https://x' } } },
					{ title: 'Nvidia', normalizedtitle: 'Nvidia', views: 5000, extract: 'Empresa.', content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/Nvidia' } } },
					{ title: 'Sin_enlace', views: 10 }
				]
			},
			onthisday: [
				{ year: 1066, text: 'Batalla de Hastings.', pages: [{ content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/Hastings' } } }] },
				{ year: 1947, text: 'Chuck Yeager rompe la barrera del sonido.', pages: [] },
				{ year: 2000, text: '' }
			]
		}));
		const data = await wiki.fetch(undefined);
		expect(String(fetch.mock.calls[0][0])).toMatch(/\/es\/featured\/2026\/10\/14$/);
		expect(data).not.toHaveProperty('en');
		expect(data.date).toBe('2026-10-14');
		expect(data.featured).toEqual({ title: 'Menorca', url: 'https://es.wikipedia.org/wiki/Menorca', extract: 'Menorca es una isla.', views: undefined });
		expect(data.mostRead).toEqual([{ title: 'Nvidia', url: 'https://es.wikipedia.org/wiki/Nvidia', extract: 'Empresa.', views: 5000 }]);
		expect(data.onThisDay).toEqual([
			{ year: 1947, text: 'Chuck Yeager rompe la barrera del sonido.', url: '' },
			{ year: 1066, text: 'Batalla de Hastings.', url: 'https://es.wikipedia.org/wiki/Hastings' }
		]);
	});

	it('añade la Wikipedia en inglés con «In the news»', async () => {
		const enPage = (t: string) => ({ title: t, content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${t}` } } });
		mockFetch((url) =>
			url.includes('/wikipedia/en/')
				? {
						mostread: { articles: [{ ...enPage('Main_Page'), views: 9e6 }, { ...enPage('Nvidia'), views: 8000 }] },
						news: [{ story: '<b>A ceasefire</b> is agreed.', links: [enPage('Ceasefire')] }, { story: '' }]
					}
				: { mostread: { articles: [{ ...enPage('Nvidia'), views: 10 }] } }
		);
		const data = await wiki.fetch(undefined);
		expect(data.en?.mostRead.map((p) => p.title)).toEqual(['Nvidia']);
		expect(data.en?.news).toEqual([{ text: 'A ceasefire is agreed.', url: 'https://en.wikipedia.org/wiki/Ceasefire' }]);
		expect(data).not.toHaveProperty('news');
	});
});
