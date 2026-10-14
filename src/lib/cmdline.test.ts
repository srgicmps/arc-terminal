// Barra de comandos: sugerencias y qué se abre al pulsar Intro.
import { describe, expect, it } from 'vitest';
import {
	canonical,
	exampleTarget,
	findCommand,
	HISTORY_KEY,
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
import { COMMANDS, TICKERS } from './commands.ts';

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
		expect(open('ECO paro')).toBe('/eco');
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

	it('guarda los 5 últimos, el más reciente primero y sin repetir', () => {
		let list: string[] = [];
		for (const e of ['ECO', 'NVDA', 'FUEL', 'eco', 'WS', 'LUZ', 'BOE']) list = pushHistory(list, e);
		expect(list).toEqual(['BOE', 'LUZ', 'WS', 'eco', 'FUEL']);
		expect(pushHistory(list, '  ')).toBe(list);
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
