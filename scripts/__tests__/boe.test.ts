import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boe, buildWeek, compact, weekIndex } from '../sources/boe.ts';
import { writeExtra } from '../lib.ts';
import type { BoeData, BoeWeekDay } from '../../src/lib/types.ts';
import { mockFetch } from './mock.ts';

// Sin escribir en static/data (los archivos de la semana): los tests no deben tocar los datos de la pasada.
vi.mock('../lib.ts', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib.ts')>()), writeExtra: vi.fn() }));

// Respuesta reducida con la forma del sumario de la API del BOE. Ojo: cuando hay un solo
// elemento, la API devuelve un objeto en vez de una lista.
const sumario = {
	data: {
		sumario: {
			diario: [
				{
					numero: '247',
					sumario_diario: { url_pdf: { texto: 'https://www.boe.es/boe/dias/2026/10/14/pdfs/BOE-S-2026-247.pdf' } },
					seccion: [
						{
							codigo: '1',
							nombre: 'I. Disposiciones generales',
							departamento: {
								nombre: 'MINISTERIO DE HACIENDA',
								epigrafe: {
									nombre: 'Impuestos',
									item: {
										identificador: 'BOE-A-2026-1',
										titulo: 'Orden HAC/1/2026, por la que se aprueba el modelo &quot;100&quot;.',
										url_html: '/diario_boe/txt.php?id=BOE-A-2026-1',
										url_pdf: { texto: 'https://www.boe.es/boe/dias/2026/10/14/pdfs/BOE-A-2026-1.pdf' }
									}
								}
							}
						},
						{
							codigo: '5A',
							nombre: 'V. Anuncios',
							departamento: [
								{
									nombre: 'AYUNTAMIENTOS',
									item: Array.from({ length: 20 }, (_, i) => ({ identificador: `BOE-B-${i}`, titulo: `Anuncio ${i}` }))
								}
							]
						}
					]
				}
			]
		}
	}
};

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
});
afterEach(() => {
	vi.useRealTimers();
	vi.mocked(writeExtra).mockClear();
});

describe('boe', () => {
	it('lee el sumario de hoy: secciones, departamentos, epígrafes y enlaces', async () => {
		mockFetch((url) => (url.endsWith('/20261014') ? sumario : undefined));
		const data = await boe.fetch(undefined);
		expect(data.date).toBe('2026-10-14');
		expect(data.number).toBe('247');
		expect(data.pdf).toBe('https://www.boe.es/boe/dias/2026/10/14/pdfs/BOE-S-2026-247.pdf');
		expect(data.sections).toHaveLength(2);
		expect(data.sections[0].items).toEqual([
			{
				id: 'BOE-A-2026-1',
				title: 'Orden HAC/1/2026, por la que se aprueba el modelo "100".',
				dept: 'MINISTERIO DE HACIENDA',
				epigraph: 'Impuestos',
				html: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-1',
				pdf: 'https://www.boe.es/boe/dias/2026/10/14/pdfs/BOE-A-2026-1.pdf'
			}
		]);
	});

	it('limita los anuncios de la sección V pero guarda el total', async () => {
		mockFetch((url) => (url.endsWith('/20261014') ? sumario : undefined));
		const { sections } = await boe.fetch(undefined);
		expect(sections[1].total).toBe(20);
		expect(sections[1].items).toHaveLength(15);
	});

	it('si hoy aún no hay BOE, busca el día anterior', async () => {
		const fetch = mockFetch((url) => (url.endsWith('/20261013') ? sumario : undefined));
		const data = await boe.fetch(undefined);
		expect(data.date).toBe('2026-10-13');
		// Primero hoy y luego ayer; después vienen las peticiones de la semana.
		expect(fetch.mock.calls.slice(0, 2).map(([url]) => String(url).slice(-8))).toEqual(['20261014', '20261013']);
	});

	it('falla si no hay sumario en una semana', async () => {
		const fetch = mockFetch(() => undefined);
		await expect(boe.fetch(undefined)).rejects.toThrow('últimos 7 días');
		expect(fetch).toHaveBeenCalledTimes(8);
		expect(writeExtra).not.toHaveBeenCalled();
	});

	it('escribe la semana y el índice: reutiliza lo publicado y pide al BOE solo lo que falta', async () => {
		const saved: BoeWeekDay = { date: '2026-10-12', number: '245', sections: [] };
		const fetch = mockFetch((url) =>
			url.endsWith('/20261014') || url.endsWith('/20261010') ? sumario : url.endsWith('boe-week.json') ? { days: [saved] } : undefined
		);
		await boe.fetch(undefined);
		const [[weekPath, week], [indexPath, index]] = vi.mocked(writeExtra).mock.calls as [string, any][];
		expect([weekPath, indexPath]).toEqual(['boe-week.json', 'boe-index.json']);
		expect(week.days.map((d: BoeWeekDay) => d.date)).toEqual(['2026-10-14', '2026-10-12', '2026-10-10']);
		expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/20261012'))).toBe(false);
		expect(index.days[0].items[0]).toEqual({ id: 'BOE-A-2026-1', text: 'orden hac/1/2026, por la que se aprueba el modelo "100". ministerio de hacienda impuestos' });
	});
});

describe('semana del BOE', () => {
	const day = (date: string): BoeData => ({ date, number: '1', pdf: 'x.pdf', sections: [{ code: '1', name: 'I', total: 1, items: [{ id: 'A', title: 'Título', dept: 'Ministerio', epigraph: '', html: 'h', pdf: 'p' }] }] });

	it('compacta un sumario sin enlaces', () => {
		expect(compact(day('2026-10-14')).sections[0].items).toEqual([{ id: 'A', title: 'Título', dept: 'Ministerio', epigraph: '' }]);
	});

	it('7 días de calendario que acaban hoy, sin los días sin BOE', async () => {
		const load = vi.fn(async (d: string) => (d === '20261008' || d === '20261007' ? day(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`) : null));
		const week = await buildWeek(day('2026-10-14'), [], load, '20261014');
		expect(week.days.map((d) => d.date)).toEqual(['2026-10-14', '2026-10-08']);
		expect(load).toHaveBeenCalledTimes(6);
	});

	it('el índice pliega título, ministerio y epígrafe', () => {
		expect(weekIndex({ days: [compact(day('2026-10-14'))] }).days[0].items).toEqual([{ id: 'A', text: 'titulo ministerio ' }]);
	});
});
