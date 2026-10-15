import { afterEach, describe, expect, it, vi } from 'vitest';
import { bde, bdeDate, parseBde } from '../sources/bde.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllGlobals());

// Como el CSV del BdE: cabeceras entre comillas, una columna por serie y «_» en los huecos.
const CSV = [
	'"CÓDIGO DE LA SERIE",DPUDTES00U7,DPUG0B1F0ZP,DPUG0B1F0ZPD,DPUDNBBN304D,DPUDNBBN308',
	'"NÚMERO SECUENCIAL",905793,905796,905801,905802,905804',
	'"DESCRIPCIÓN DE LA SERIE","Letras. A 12 meses","Bonos. A 10 años","Diferencial a 10 años con el bono alemán. España","Reino Unido","Bono alemán. A 10 años"',
	'"02 OCT 2026","_",4.125,0.740,1.9,3.385',
	'"01 OCT 2026",2.1,4.175,0.557,1.868,3.532',
	'"30 SEP 2026",2.0,4.150,"_",1.85,3.500'
].join('\n');

describe('bde', () => {
	it('lee las fechas con el mes abreviado en español', () => {
		expect(bdeDate('01 OCT 2026')).toBe('2026-10-01');
		expect(bdeDate('5 ago 2026')).toBe('2026-08-05');
		expect(bdeDate('01 XYZ 2026')).toBeNull();
		expect(bdeDate('CÓDIGO DE LA SERIE')).toBeNull();
	});

	it('toma las columnas por su código, pasa la prima a pb, ordena y se salta los «_»', () => {
		const series = parseBde(CSV);
		expect(series.map((s) => s.id)).toEqual(['premium-es-d', 'bond10-es-d', 'bond10-de-d']);
		const premium = series[0];
		expect(premium.unit).toBe('pb');
		expect(premium.points).toEqual([
			{ t: '2026-10-01', v: 55.7 },
			{ t: '2026-10-02', v: 74 }
		]);
		expect(series[2].points.map((p) => p.v)).toEqual([3.5, 3.532, 3.385]);
	});

	it('sin la fila de códigos no inventa nada', () => {
		expect(parseBde('"02 OCT 2026",4.1,0.7')).toEqual([]);
	});

	it('decodifica Latin-1 y falla si no viene la prima de España', async () => {
		const latin1 = (text: string) => new Uint8Array([...text].map((c) => c.charCodeAt(0)));
		mockFetch(() => new Response(latin1(CSV)));
		const data = await bde.fetch(undefined);
		expect(data.series[0].points.at(-1)).toEqual({ t: '2026-10-02', v: 74 });

		mockFetch(() => new Response(latin1(CSV.replace('DPUG0B1F0ZPD', 'OTRA'))));
		await expect(bde.fetch(undefined)).rejects.toThrow('prima de España');
	});
});
