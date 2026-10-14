import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boe } from '../sources/boe.ts';
import { mockFetch } from './mock.ts';

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
afterEach(() => vi.useRealTimers());

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
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('falla si no hay sumario en una semana', async () => {
		const fetch = mockFetch(() => undefined);
		await expect(boe.fetch(undefined)).rejects.toThrow('últimos 7 días');
		expect(fetch).toHaveBeenCalledTimes(8);
	});
});
