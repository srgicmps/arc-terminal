import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCsv } from '../csv.ts';
import { appendDaily, getJson, list, madridDate, madridDay, num, plain, request, settle, tidy } from '../lib.ts';
import { mockFetch } from './mock.ts';

afterEach(() => {
	vi.useRealTimers();
});

describe('num', () => {
	it('lee números con coma o punto decimal', () => {
		expect(num('1,599')).toBe(1.599);
		expect(num('1.599')).toBe(1.599);
		expect(num(' 2,5 ')).toBe(2.5);
		expect(num(-3.25)).toBe(-3.25);
	});

	it('devuelve null si no hay número', () => {
		expect(num('')).toBeNull();
		expect(num('   ')).toBeNull();
		expect(num('n/d')).toBeNull();
		expect(num(null)).toBeNull();
		expect(num(undefined)).toBeNull();
		expect(num(NaN)).toBeNull();
		expect(num(Infinity)).toBeNull();
		expect(num({})).toBeNull();
	});
});

describe('list', () => {
	it('convierte un objeto suelto en lista y deja las listas como están', () => {
		expect(list({ a: 1 })).toEqual([{ a: 1 }]);
		expect(list([1, 2])).toEqual([1, 2]);
		expect(list(null)).toEqual([]);
		expect(list(undefined)).toEqual([]);
		expect(list(0)).toEqual([0]);
	});
});

describe('plain', () => {
	it('quita etiquetas HTML y CDATA', () => {
		expect(plain('<p>Hola <b>mundo</b></p>')).toBe('Hola mundo');
		expect(plain('<![CDATA[Texto <i>en</i> CDATA]]>')).toBe('Texto en CDATA');
	});

	it('traduce las entidades más comunes', () => {
		expect(plain('A&amp;B &quot;c&quot; &lt;d&gt;&nbsp;e')).toBe('A&B "c" <d> e');
		expect(plain('It&#39;s &apos;x&apos; &#8217;y')).toBe('It’s ’x’ ’y');
		expect(plain('Espa&#241;a')).toBe('España');
	});

	it('junta espacios y recorta con puntos suspensivos', () => {
		expect(plain('  a \n\t b  ')).toBe('a b');
		expect(plain('abcdefghij', 5)).toBe('abcd…');
		expect(plain('abcde', 5)).toBe('abcde');
	});

	it('acepta valores vacíos o que no son texto', () => {
		expect(plain(undefined)).toBe('');
		expect(plain(null)).toBe('');
		expect(plain(42)).toBe('42');
	});
});

describe('tidy', () => {
	it('pasa a minúsculas los textos en mayúsculas, respetando siglas y números', () => {
		expect(tidy('CARRETERA ME-1 KM 12')).toBe('Carretera ME-1 Km 12');
		expect(tidy('AVENIDA DE LA CONSTITUCION, S/N')).toBe('Avenida de la Constitucion, s/n');
		expect(tidy('PUERTO  DE   MAHON')).toBe('Puerto de Mahon');
	});

	it('deja tal cual los textos que ya tienen minúsculas', () => {
		expect(tidy('Mercadal (Es)')).toBe('Mercadal (Es)');
	});

	it('pone en mayúsculas los puntos cardinales y, si se pide, las palabras cortas', () => {
		expect(tidy('20 KM NE DE MAHON')).toBe('20 Km NE de Mahon');
		expect(tidy('BP ES CASTELL', true)).toBe('BP ES Castell');
		expect(tidy('BP ES CASTELL')).toBe('Bp Es Castell');
	});

	it('acepta undefined', () => {
		expect(tidy(undefined)).toBe('');
	});
});

describe('appendDaily', () => {
	it('añade un día nuevo y mantiene el orden por fecha', () => {
		const h = appendDaily([{ date: '2026-10-13', v: 1 }], { date: '2026-10-14', v: 2 });
		expect(h).toEqual([
			{ date: '2026-10-13', v: 1 },
			{ date: '2026-10-14', v: 2 }
		]);
	});

	it('sustituye el punto si ese día ya existía', () => {
		const h = appendDaily(
			[
				{ date: '2026-10-13', v: 1 },
				{ date: '2026-10-14', v: 2 }
			],
			{ date: '2026-10-14', v: 3 }
		);
		expect(h).toEqual([
			{ date: '2026-10-13', v: 1 },
			{ date: '2026-10-14', v: 3 }
		]);
	});

	it('empieza de cero sin historial y se queda solo con los últimos `keep`', () => {
		expect(appendDaily(undefined, { date: '2026-10-14' })).toEqual([{ date: '2026-10-14' }]);
		const h = appendDaily(
			[{ date: '2026-10-12' }, { date: '2026-10-13' }],
			{ date: '2026-10-14' },
			2
		);
		expect(h.map((p) => p.date)).toEqual(['2026-10-13', '2026-10-14']);
	});
});

describe('madridDate y madridDay', () => {
	it('usan el día de Madrid, no el de UTC', () => {
		vi.useFakeTimers();
		// 23:30 UTC del 13 de octubre = 01:30 del 14 en Madrid (horario de verano).
		vi.setSystemTime(new Date('2026-10-13T23:30:00Z'));
		expect(madridDate()).toBe('20261014');
		expect(madridDay()).toBe('2026-10-14');
		expect(madridDate(-1)).toBe('20261013');
		expect(madridDate(1)).toBe('20261015');
	});

	it('cuentan bien los días alrededor del cambio de hora de primavera', () => {
		vi.useFakeTimers();
		// 23:30 del sábado 28 de marzo de 2026 en Madrid; esa noche se adelanta la hora.
		vi.setSystemTime(new Date('2026-03-28T22:30:00Z'));
		expect(madridDate(1)).toBe('20260329');
		// 00:30 del lunes 30 de marzo en Madrid: ayer fue domingo 29.
		vi.setSystemTime(new Date('2026-03-29T22:30:00Z'));
		expect(madridDate(0)).toBe('20260330');
		expect(madridDate(-1)).toBe('20260329');
	});

	it('cuentan bien los días alrededor del cambio de hora de otoño', () => {
		vi.useFakeTimers();
		// 00:30 del lunes 26 de octubre de 2026 en Madrid (la noche anterior se retrasó la hora).
		vi.setSystemTime(new Date('2026-10-25T23:30:00Z'));
		expect(madridDate(0)).toBe('20261026');
		expect(madridDate(-1)).toBe('20261025');
		// 23:30 del sábado 24 de octubre: mañana es domingo 25.
		vi.setSystemTime(new Date('2026-10-24T21:30:00Z'));
		expect(madridDate(1)).toBe('20261025');
	});
});

describe('parseCsv', () => {
	it('lee cabecera y filas, con comillas, comas internas y saltos CRLF', () => {
		const csv = 'KEY,TIME_PERIOD,OBS_VALUE\r\n"A,1",2026-09,"2,5"\r\nB,2026-10,"di ""hola"""\r\n\r\n';
		expect(parseCsv(csv)).toEqual([
			{ KEY: 'A,1', TIME_PERIOD: '2026-09', OBS_VALUE: '2,5' },
			{ KEY: 'B', TIME_PERIOD: '2026-10', OBS_VALUE: 'di "hola"' }
		]);
	});

	it('acepta la última fila sin salto de línea y celdas que faltan', () => {
		expect(parseCsv('a,b\n1')).toEqual([{ a: '1', b: '' }]);
		expect(parseCsv('')).toEqual([]);
	});
});

describe('request y getJson', () => {
	it('manda el User-Agent y devuelve el JSON', async () => {
		const fetch = mockFetch(() => ({ ok: true }));
		await expect(getJson('https://example.org/api')).resolves.toEqual({ ok: true });
		const init = fetch.mock.calls[0][1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers['User-Agent']).toMatch(/^ArcTerminal/);
		expect(headers.Accept).toBe('application/json');
	});

	it('no reintenta un 404', async () => {
		const fetch = mockFetch(() => undefined);
		await expect(request('https://example.org/x')).rejects.toThrow('HTTP 404 en https://example.org/x');
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('reintenta un 500 y acaba devolviendo la respuesta buena', async () => {
		vi.useFakeTimers();
		let calls = 0;
		mockFetch(() => (++calls === 1 ? new Response('', { status: 500 }) : 'bien'));
		const res = request('https://example.org/x');
		await vi.runAllTimersAsync();
		await expect((await res).text()).resolves.toBe('bien');
		expect(calls).toBe(2);
	});
});

describe('settle', () => {
	it('se queda con los resultados buenos y apunta los fallos sin romper', async () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const out = await settle('test', [1, 2, 3], (n) => `n${n}`, async (n) => {
			if (n === 2) throw new Error('falla');
			return n === 3 ? null : n * 10;
		});
		expect(out).toEqual([10]);
		expect(log).toHaveBeenCalledWith('  test · n2: falla');
		expect(log).toHaveBeenCalledWith('  test · n3: sin datos');
	});
});
