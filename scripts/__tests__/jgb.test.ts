import { afterEach, describe, expect, it, vi } from 'vitest';
import { jgb, jgbDate, parseJgb } from '../sources/jgb.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllGlobals());

/** Pasa a Shift-JIS el texto de ejemplo: solo hacen falta «基準日» y «年»; lo demás es ASCII. */
function sjis(text: string): Uint8Array {
	const map: Record<string, number[]> = { 基: [0x8a, 0xee], 準: [0x8f, 0x80], 日: [0x93, 0xfa], 年: [0x94, 0x4e] };
	return new Uint8Array([...text].flatMap((c) => map[c] ?? [c.charCodeAt(0)]));
}

const HEAD = '基準日,1年,2年,3年,4年,5年,6年,7年,8年,9年,10年,15年,20年,25年,30年,40年';
const row = (date: string, base: number) =>
	[date, ...Array.from({ length: 15 }, (_, i) => (base + i / 10).toFixed(3))].join(',');

describe('jgb', () => {
	it('lee las fechas en calendario japonés y en el occidental', () => {
		expect(jgbDate('R7.10.14')).toBe('2025-10-14');
		expect(jgbDate('H31.4.26')).toBe('2019-04-26');
		expect(jgbDate('2026/10/9')).toBe('2026-10-09');
		expect(jgbDate('基準日')).toBeNull();
	});

	it('se salta el título, toma los plazos por la cabecera y da null en los «-»', () => {
		const text = ['国債金利情報,,(単位 : %)', HEAD, row('R8.10.13', 0.5), 'R8.10.14,0.6,0.7,-,-,-,-,-,-,-,1.5,-,-,-,-,-'].join('\r\n');
		const days = parseJgb(text);
		expect(days).toHaveLength(2);
		// 1A, 2A, 5A, 10A, 20A, 30A, 40A
		expect(days[0]).toEqual({ date: '2026-10-13', values: [0.5, 0.6, 0.9, 1.4, 1.6, 1.8, 1.9] });
		expect(days[1].values).toEqual([0.6, 0.7, null, 1.5, null, null, null]);
	});

	it('junta el histórico y el mes en curso, decodifica Shift-JIS y guarda algo más de un año', async () => {
		const history = sjis([HEAD, row('R6.1.5', 0.1), row('R7.10.14', 0.4), row('R8.10.1', 0.5)].join('\n'));
		const current = sjis([HEAD, row('R8.10.1', 0.55), row('R8.10.14', 0.6)].join('\n'));
		mockFetch((url) => new Response(url.endsWith('jgbcm_all.csv') ? history : current));
		const data = await jgb.fetch(undefined);
		expect(data.tenors).toEqual(['1A', '2A', '5A', '10A', '20A', '30A', '40A']);
		expect(data.days.map((d) => d.date)).toEqual(['2025-10-14', '2026-10-01', '2026-10-14']);
		// El mes en curso manda sobre el histórico si los dos traen el mismo día.
		expect(data.days[1].values[0]).toBe(0.55);
	});

	it('falla si no llega ningún día', async () => {
		mockFetch(() => new Response(sjis(HEAD)));
		await expect(jgb.fetch(undefined)).rejects.toThrow('curva vacía');
	});
});
