// Barra de comandos: sugerencias y qué se abre al pulsar Intro.
import { describe, expect, it } from 'vitest';
import {
	calcInput,
	canonical,
	commandDay,
	exampleTarget,
	findCommand,
	HISTORY_KEY,
	HISTORY_MAX,
	historyStep,
	historyOptions,
	isTickerLike,
	norm,
	pushHistory,
	readHistory,
	resolveInput,
	splitInput,
	suggest,
	targetPath,
	writeHistory,
	type Option
} from './cmdline.ts';
import { parseSymbols, PERF_PERIODS } from './cmp.ts';
import { COMMANDS } from './commands.ts';
import { TICKERS } from './tickers.ts';

const ALL: Option[] = [
	...COMMANDS.map((c) => ({ code: c.code, desc: c.desc, kind: 'Función', aliases: c.aliases })),
	...TICKERS.map((t) => ({ code: t.code, desc: t.name, kind: 'Valor' }))
];

/** Lo que abriría la barra con ese texto, en forma corta: «/fuel», «/news?q=paro» o «sym:NVDA». */
const open = (raw: string) => {
	const t = resolveInput(raw, suggest(raw, ALL));
	if (t === null) return null;
	if (t.kind === 'symbol') return `sym:${t.sym}`;
	const { route, search } = targetPath(t);
	return route + search;
};

describe('norm e isTickerLike', () => {
	it('quita tildes y pasa a mayúsculas', () => {
		expect(norm('  diésel ')).toBe('DIESEL');
	});

	it('reconoce códigos de valor', () => {
		expect(isTickerLike('nvda')).toBe(true);
		expect(isTickerLike('BRK.B')).toBe(true);
		expect(isTickerLike('BME:REP')).toBe(true);
		expect(isTickerLike('wall street')).toBe(false);
		expect(isTickerLike('ABCDEFGHIJKLM')).toBe(false);
	});
});

describe('suggest', () => {
	it('pone primero el código exacto', () => {
		expect(suggest('es', ALL)[0].code).toBe('ES');
	});

	it('vacío no sugiere nada', () => {
		expect(suggest('  ', ALL)).toEqual([]);
	});
});

describe('alias en español', () => {
	it('encuentran el comando sin tildes ni mayúsculas', () => {
		expect(findCommand('Diesel')?.code).toBe('FUEL');
		expect(findCommand('ESPAÑA')?.code).toBe('ES');
		expect(findCommand('boletin')?.code).toBe('BOE');
		expect(findCommand('Wall Street')?.code).toBe('WS');
		expect(findCommand('nada')).toBeUndefined();
	});

	it('las sugerencias encuentran por alias', () => {
		expect(suggest('gaso', ALL)[0].code).toBe('FUEL');
		expect(suggest('pvpc', ALL)[0].code).toBe('LUZ');
		expect(suggest('clim', ALL)[0].code).toBe('WX');
		expect(suggest('ayu', ALL)[0].code).toBe('HELP');
	});
});

describe('resolveInput', () => {
	it('«gasolina» abre FUEL, no la ficha GASOLINA', () => {
		expect(open('gasolina')).toBe('/fuel');
		expect(open('diésel')).toBe('/fuel');
		expect(open('wall street')).toBe('/ws');
		expect(open('tiempo')).toBe('/wx');
	});

	it('una palabra con sugerencias abre la primera, no una ficha', () => {
		expect(open('gasolineras')).toBe('/fuel');
		expect(open('wikipedia')).toBe('/wiki');
	});

	it('un comando exacto abre su vista', () => {
		expect(open('eco')).toBe('/eco');
		expect(open('help')).toBe('/help');
	});

	it('un valor conocido abre su ficha', () => {
		expect(open('nvda')).toBe('sym:NVDA');
		expect(open('brk.b')).toBe('sym:BRK.B');
	});

	it('sin sugerencias, abre la ficha con lo escrito', () => {
		expect(open('BME:REP')).toBe('sym:BME:REP');
		expect(open('intc')).toBe('sym:INTC');
	});

	it('vacío no abre nada', () => {
		expect(open('')).toBeNull();
	});
});

describe('comandos con texto detrás', () => {
	it('separa la primera palabra del resto', () => {
		expect(splitInput('  NEWS   inflación subyacente ')).toEqual({ head: 'NEWS', arg: 'inflación subyacente' });
		expect(splitInput('ECO')).toEqual({ head: 'ECO', arg: '' });
	});

	it('lleva el texto al parámetro de la vista', () => {
		expect(open('NEWS inflación')).toBe(`/news?q=${encodeURIComponent('inflación')}`);
		expect(open('boe vivienda')).toBe('/boe?q=vivienda');
		expect(open('FUEL Madrid')).toBe('/fuel?zona=Madrid');
		expect(open('fuel 28')).toBe('/fuel?zona=28');
		expect(open('gasolina Palma')).toBe('/fuel?zona=Palma');
	});

	it('un comando sin argumento ignora el texto; un alias de dos palabras sigue siendo alias', () => {
		expect(open('ECO hola')).toBe('/eco');
		expect(open('ECO paro')).toBe('/eco#panel=Paro'); // M47: si es un panel, va a él
		expect(open('wall street')).toBe('/ws');
	});

	it('sugiere ejecutar el comando con ese texto', () => {
		expect(suggest('NEWS paro', ALL)).toEqual([
			{ code: 'NEWS', desc: 'Buscar en los titulares: paro', kind: 'Función', run: 'NEWS paro' }
		]);
	});

	it('cada ejemplo de HELP enlaza a lo mismo que abre la barra (también WX, que empieza por «LUGAR»)', () => {
		for (const c of COMMANDS.filter((c) => c.arg)) {
			const { route, search } = exampleTarget(c);
			expect(route + search, c.code).toBe(open(c.arg!.example));
			expect(search, c.code).not.toBe('');
		}
		const wx = COMMANDS.find((c) => c.code === 'WX')!;
		expect(exampleTarget(wx).search).toBe(`?${wx.arg!.param}=Tokio`);
	});

	it('el historial guarda el texto', () => {
		const t = resolveInput('news Inflación', []);
		expect(t && canonical(t)).toBe('NEWS Inflación');
		expect(historyOptions(['NEWS Inflación'])[0]).toEqual({
			code: 'NEWS',
			desc: 'Buscar en los titulares: Inflación',
			kind: 'Reciente',
			run: 'NEWS Inflación'
		});
	});
});

describe('historial', () => {
	/** Un localStorage de mentira. */
	const memory = (initial?: string) => {
		const data = new Map<string, string>(initial === undefined ? [] : [[HISTORY_KEY, initial]]);
		return {
			getItem: (k: string) => data.get(k) ?? null,
			setItem: (k: string, v: string) => void data.set(k, v)
		};
	};

	it('guarda los 50 últimos, el más reciente primero y sin repetir; enseña 5', () => {
		let list: string[] = [];
		for (const e of ['ECO', 'NVDA', 'FUEL', 'eco', 'WS', 'LUZ', 'BOE']) list = pushHistory(list, e);
		expect(list).toEqual(['BOE', 'LUZ', 'WS', 'eco', 'FUEL', 'NVDA']);
		expect(pushHistory(list, '  ')).toBe(list);
		for (let i = 0; i < 60; i++) list = pushHistory(list, `X${i}`);
		expect(list).toHaveLength(HISTORY_MAX);
		expect(historyOptions(list)).toHaveLength(5);
	});

	it('↑ y ↓ recorren el historial como en un terminal', () => {
		const list = ['BOE', 'LUZ', 'WS'];
		expect(historyStep(list, -1, 1)).toEqual({ idx: 0, value: 'BOE' });
		expect(historyStep(list, 0, 1)).toEqual({ idx: 1, value: 'LUZ' });
		expect(historyStep(list, 2, 1)).toEqual({ idx: 2, value: 'WS' });
		expect(historyStep(list, 1, -1)).toEqual({ idx: 0, value: 'BOE' });
		expect(historyStep(list, 0, -1)).toEqual({ idx: -1, value: '' });
		expect(historyStep([], -1, 1)).toEqual({ idx: -1, value: '' });
	});

	it('lee y escribe en el almacenamiento', () => {
		const store = memory();
		writeHistory(['FUEL', 'NVDA'], () => store);
		expect(readHistory(() => store)).toEqual(['FUEL', 'NVDA']);
	});

	it('no rompe sin almacenamiento, con datos corruptos o si el navegador lo bloquea', () => {
		expect(readHistory(() => undefined)).toEqual([]);
		expect(readHistory(() => memory('{no es json'))).toEqual([]);
		expect(readHistory(() => memory('{"a":1}'))).toEqual([]);
		expect(readHistory(() => memory('["ECO", 3, ""]'))).toEqual(['ECO']);
		const blocked = () => {
			throw new Error('SecurityError');
		};
		expect(readHistory(blocked)).toEqual([]);
		expect(() => writeHistory(['ECO'], blocked)).not.toThrow();
	});

	it('se muestra como sugerencias', () => {
		expect(historyOptions(['FUEL', 'NVDA', 'BME:REP'])).toEqual([
			{ code: 'FUEL', desc: COMMANDS.find((c) => c.code === 'FUEL')!.desc, kind: 'Reciente', run: 'FUEL' },
			{ code: 'NVDA', desc: 'NVIDIA', kind: 'Reciente', run: 'NVDA' },
			{ code: 'BME:REP', desc: 'Valor', kind: 'Reciente', run: 'BME:REP' }
		]);
	});
});

describe('CMP', () => {
	it('«CMP NVDA AMD AVGO» abre /cmp con los valores en ?s=', () => {
		const target = resolveInput('CMP NVDA AMD AVGO', []);
		expect(target).toMatchObject({ kind: 'command', arg: 'NVDA AMD AVGO' });
		expect(target && targetPath(target)).toEqual({ route: '/cmp', search: '?s=NVDA%20AMD%20AVGO' });
	});

	it('lee los valores en mayúsculas, sin repetir y como mucho cinco', () => {
		expect(parseSymbols('nvda, amd  AVGO;nvda')).toEqual(['NVDA', 'AMD', 'AVGO']);
		expect(parseSymbols('A B C D E F')).toEqual(['A', 'B', 'C', 'D', 'E']);
		expect(parseSymbols('BME:SAN <script>')).toEqual(['BME:SAN']);
		expect(parseSymbols(null)).toEqual([]);
	});
});

describe('CMP: plazos de la tabla', () => {
	// Las claves que llegaron de verdad en perf.json (registro de la Action del #128, 14-10-2026).
	const REAL = ['13Week', '26Week', '52Week', '5Day', 'monthToDate', 'yearToDate'];

	it('cada columna de la tabla es una clave que Finnhub da de verdad', () => {
		for (const [key] of PERF_PERIODS) expect(REAL).toContain(key);
	});
});

describe('funciones por valor («NVDA GP»)', () => {
	const open = (raw: string) => resolveInput(raw, suggest(raw, ALL));

	it('«nvda gp» abre la ficha con la función, sin distinguir mayúsculas', () => {
		const t = open('nvda gp');
		expect(t).toEqual({ kind: 'symbol', sym: 'NVDA', fn: 'gp' });
		expect(targetPath(t!)).toEqual({ route: '/s', search: '?sym=NVDA&fn=gp' });
		expect(canonical(t!)).toBe('NVDA GP');
	});

	it('«NVDA» sola sigue abriendo la ficha sin función', () => {
		expect(open('NVDA')).toEqual({ kind: 'symbol', sym: 'NVDA' });
	});

	it('los comandos ganan: «ES GP» abre ES', () => {
		const t = open('ES GP');
		expect(t?.kind === 'command' && t.command.code).toBe('ES');
	});

	it('vale con cualquier valor, también de otra bolsa', () => {
		expect(open('BME:REP DES')).toEqual({ kind: 'symbol', sym: 'BME:REP', fn: 'des' });
		expect(open('brk.b fa')).toEqual({ kind: 'symbol', sym: 'BRK.B', fn: 'fa' });
	});

	it('una función que no existe se queda como símbolo, como hasta ahora', () => {
		expect(open('NVDA XYZ')).toEqual({ kind: 'symbol', sym: 'NVDA XYZ' });
	});

	it('al escribir «NVDA » sugiere las funciones, y «NVDA G» solo GP', () => {
		expect(suggest('NVDA ', ALL).map((o) => o.code)).toEqual(['NVDA GP', 'NVDA DES', 'NVDA FA', 'NVDA TA', 'NVDA CN', 'NVDA SEC']);
		const g = suggest('NVDA G', ALL);
		expect(g.map((o) => o.code)).toEqual(['NVDA GP']);
		expect(g[0].desc).toContain('NVIDIA');
		// Intro con «NVDA G» abre la primera sugerencia.
		expect(open('NVDA G')).toEqual({ kind: 'symbol', sym: 'NVDA', fn: 'gp' });
	});

	it('en el historial se ve el valor y la función', () => {
		const [o] = historyOptions(['NVDA GP']);
		expect(o).toMatchObject({ code: 'NVDA GP', run: 'NVDA GP' });
		expect(o.desc).toBe('Gráfico · NVIDIA');
	});
});

it('una palabra cualquiera con espacio no sugiere funciones («aranceles »)', () => {
	const all: Option[] = TICKERS.map((t) => ({ code: t.code, desc: t.name, kind: 'Valor' }));
	expect(suggest('aranceles ', all).some((o) => o.kind === 'Función')).toBe(false);
	expect(suggest('BME:REP ', all).map((o) => o.code)[0]).toBe('BME:REP GP');
});

describe('ir a un panel y ayuda (M47, M48)', () => {
	it('«ECO TIPOS» y «WS curva» llevan al panel por el hash', () => {
		expect(open('ECO TIPOS')).toBe('/eco#panel=Bancos%20centrales');
		expect(open('ws curva')).toBe('/ws#panel=Curvas%20de%20tipos');
		expect(open('ECO inflación g20')).toBe('/eco#panel=Inflaci%C3%B3n%20del%20G20');
	});

	it('en un comando con texto, el panel tiene que ir entero', () => {
		expect(open('WX Mar')).toBe('/wx#panel=Mar');
		expect(open('WX Mar del Plata')).toBe('/wx?buscar=Mar%20del%20Plata');
		expect(open('FUEL Madrid')).toBe('/fuel?zona=Madrid');
	});

	it('sugiere los paneles que coinciden y los guarda en el historial con su título', () => {
		const s = suggest('ECO PIB', ALL);
		expect(s.map((o) => o.code)).toEqual(['ECO PIB', 'ECO PIB interanual']);
		expect(s[0].kind).toBe('Panel');
		const t = resolveInput('ECO tipos', []);
		expect(t && canonical(t)).toBe('ECO Bancos centrales');
		expect(historyOptions(['ECO Bancos centrales'])[0]).toMatchObject({ code: 'ECO Bancos centrales', kind: 'Reciente' });
	});

	it('un texto que no es panel sigue abriendo el comando', () => {
		expect(open('ECO paro juvenil')).toBe('/eco#panel=Paro%20juvenil');
		expect(open('ECO zzz')).toBe('/eco');
	});

	it('«ECO ?» abre su ficha del MANUAL', () => {
		expect(open('ECO ?')).toBe('/manual#cmd-ECO');
		expect(open('news ?')).toBe('/manual#cmd-NEWS');
		expect(suggest('ECO ?', ALL)[0]).toMatchObject({ code: 'ECO ?', kind: 'Ayuda' });
		const t = resolveInput('wx ?', []);
		expect(t && canonical(t)).toBe('WX ?');
	});
});

describe('códigos de Bloomberg (M45)', () => {
	it('llevan al comando y, si toca, a su panel', () => {
		expect(open('WEI')).toBe('/ws#panel=Mercados');
		expect(open('fxc')).toBe('/ws#panel=Divisas');
		expect(open('YCRV')).toBe('/ws#panel=Curvas%20de%20tipos');
		expect(open('GC')).toBe('/ws#panel=Curvas%20de%20tipos');
		expect(open('WIRP')).toBe('/eco#panel=Pr%C3%B3ximas%20reuniones');
		expect(open('ECOW')).toBe('/cal');
		expect(open('EVTS')).toBe('/cal');
		expect(open('N')).toBe('/news');
		expect(open('CN')).toBe('/news');
		expect(open('BI')).toBe('/ai');
	});

	it('cada código es único, no pisa un comando y su panel existe', () => {
		const codes = COMMANDS.flatMap((c) => (c.bloomberg ?? []).map((b) => b.code));
		expect(new Set(codes).size).toBe(codes.length);
		for (const c of COMMANDS)
			for (const b of c.bloomberg ?? []) {
				expect(findCommand(b.code), b.code).toBeUndefined();
				if (b.panel) expect(c.manual?.panels?.some((p) => p.name === b.panel), `${b.code}: ${b.panel}`).toBe(true);
			}
	});

	it('salen en las sugerencias al escribir el código', () => {
		expect(suggest('FXC', ALL)[0]).toMatchObject({ code: 'FXC', kind: 'Bloomberg' });
		expect(suggest('YCR', ALL).some((o) => o.code === 'YCRV')).toBe(true);
	});
});

describe('fechas en los comandos (M49)', () => {
	// Jueves, 15 de octubre de 2026, a mediodía en Madrid.
	const NOW = Date.parse('2026-10-15T10:00:00Z');

	it('«CAL viernes» y «WX sábado» pasan el día en ?dia=', () => {
		const cal = commandDay('CAL viernes', NOW);
		expect(cal && targetPath({ kind: 'command', ...cal }).search).toBe('?dia=2026-10-16');
		const wx = commandDay('wx sábado', NOW);
		expect(wx && targetPath({ kind: 'command', ...wx }).search).toBe('?dia=2026-10-17');
	});

	it('«LUZ mañana» va al panel de ese día', () => {
		const luz = commandDay('LUZ mañana', NOW);
		expect(luz && targetPath({ kind: 'command', ...luz })).toEqual({ route: '/luz', search: '#panel=viernes%2C%2016%20de%20octubre%20de%202026' });
	});

	it('el historial guarda lo escrito, no la fecha', () => {
		const t = resolveInput('LUZ mañana', []);
		expect(t && canonical(t)).toBe('LUZ mañana');
	});

	it('si no es una fecha, el texto sigue siendo del comando', () => {
		expect(commandDay('WX Tokio', NOW)).toBeNull();
		expect(commandDay('ECO mañana', NOW)).toBeNull();
		expect(open('WX Tokio')).toBe('/wx?buscar=Tokio');
	});
});

describe('calculadora y conversor (M46)', () => {
	const fx = {
		status: 'ready' as const,
		rates: new Map([
			['EUR', { perEur: 1, date: '2026-10-14' }],
			['USD', { perEur: 1.25, date: '2026-10-14' }]
		])
	};

	it('«=1250*1.21» da la cuenta y deja el resultado para seguir', () => {
		expect(calcInput('=1250*1.21')).toEqual({ text: '= 1512,5', desc: '1250*1.21', next: '=1512.5' });
		expect(calcInput('=2+')?.text).toBe('= ?');
		expect(suggest('=1250*1.21', ALL)[0]).toMatchObject({ code: '= 1512,5', kind: 'Calculadora', run: '=1250*1.21' });
	});

	it('«100 USD EUR» con los cambios del BCE', () => {
		expect(calcInput('100 USD EUR', fx)?.text).toBe('100 USD = 80 EUR');
		expect(calcInput('100 eur a usd', fx)?.desc).toBe('Cambio de referencia del BCE · 2026-10-14');
		expect(calcInput('100 USD EUR')?.desc).toBe('Cargando los cambios del BCE…');
		expect(calcInput('100 USD XYZ', fx)?.desc).toBe('Divisas con cambio del BCE: EUR, USD');
	});

	it('lo demás no es cuenta', () => {
		expect(calcInput('NVDA')).toBeNull();
		expect(calcInput('CMP NVDA AMD')).toBeNull();
	});
});
