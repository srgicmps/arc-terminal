import { describe, expect, it } from 'vitest';
import { cluster, jaccard, normalize } from '../cluster.ts';
import type { NewsItem } from '../../src/lib/types.ts';

const news = (title: string, source: string, time: string | null = '2026-10-14T10:00:00Z'): NewsItem => ({
	title,
	url: `https://${source.toLowerCase().replace(/\W/g, '')}.example/${encodeURIComponent(title)}`,
	source,
	time,
	summary: ''
});

describe('normalize', () => {
	it('quita mayúsculas, tildes, signos y palabras vacías', () => {
		expect([...normalize('El BCE mantiene los tipos de interés, según Lagarde')]).toEqual([
			'bce',
			'mantiene',
			'tipos',
			'interes',
			'lagarde'
		]);
		expect([...normalize('The Fed cuts rates for the first time')]).toEqual(['fed', 'cuts', 'rates', 'first', 'time']);
	});
});

describe('jaccard', () => {
	it('mide palabras en común / palabras distintas', () => {
		expect(jaccard(new Set(['a', 'b', 'c']), new Set(['a', 'b', 'd']))).toBe(0.5);
		expect(jaccard(new Set(['a']), new Set())).toBe(0);
	});
});

describe('cluster', () => {
	it('junta la misma noticia de varios medios y deja el primero (el más reciente)', () => {
		const out = cluster([
			news('El BCE mantiene los tipos de interés en el 2 %', 'El País', '2026-10-14T12:00:00Z'),
			news('Lagarde presenta el informe anual', 'BCE', '2026-10-14T11:30:00Z'),
			news('El BCE mantiene sin cambios los tipos de interés', 'Expansión', '2026-10-14T11:00:00Z'),
			news('BCE mantiene tipos de interés', 'El Confidencial', '2026-10-14T09:00:00Z')
		]);
		expect(out.map((n) => n.title)).toEqual([
			'El BCE mantiene los tipos de interés en el 2 %',
			'Lagarde presenta el informe anual'
		]);
		expect(out[0].also?.map((a) => a.source)).toEqual(['Expansión', 'El Confidencial']);
		expect(out[0].also?.[0].url).toMatch(/^https:\/\/expans/);
		expect(out[1].also).toBeUndefined();
	});

	it('no junta titulares separados por más de 12 horas', () => {
		const out = cluster([
			news('El BCE mantiene los tipos de interés', 'El País', '2026-10-14T22:00:00Z'),
			news('El BCE mantiene los tipos de interés', 'Expansión', '2026-10-14T09:00:00Z')
		]);
		expect(out).toHaveLength(2);
	});

	it('no junta titulares poco parecidos ni los que solo comparten una palabra', () => {
		expect(
			cluster([news('Nvidia bate récords en bolsa', 'CNBC'), news('Apple presenta su nuevo iPhone en bolsa', 'WSJ')])
		).toHaveLength(2);
		// «trump» y «aranceles» frente a «trump» y «china»: 1 palabra en común de 3.
		expect(cluster([news('Trump aranceles', 'A'), news('Trump China', 'B')])).toHaveLength(2);
	});

	it('descarta el repetido del mismo medio y no repite medios en «also»', () => {
		const out = cluster([
			news('Guerra comercial: Trump sube los aranceles a China', 'BBC'),
			news('Trump sube los aranceles a China', 'BBC'),
			news('Trump sube aranceles a China', 'DW'),
			news('Trump sube los aranceles a China otra vez', 'DW')
		]);
		expect(out).toHaveLength(1);
		expect(out[0].also).toEqual([{ source: 'DW', url: expect.any(String) }]);
	});

	it('solo junta sin fecha con sin fecha', () => {
		const out = cluster([
			news('El Ibex cierra en máximos del año', 'A'),
			news('El Ibex cierra en máximos del año', 'B', null),
			news('El Ibex cierra en máximos del año', 'C', null)
		]);
		expect(out).toHaveLength(2);
		expect(out[1].also?.map((a) => a.source)).toEqual(['C']);
	});

	it('no cambia los objetos que recibe', () => {
		const input = [news('Tesla entrega más coches', 'A'), news('Tesla entrega más coches', 'B')];
		cluster(input);
		expect(input[0].also).toBeUndefined();
	});
});
