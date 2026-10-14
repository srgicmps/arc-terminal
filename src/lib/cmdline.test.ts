// Barra de comandos: sugerencias y qué se abre al pulsar Intro.
import { describe, expect, it } from 'vitest';
import { isTickerLike, norm, resolveInput, suggest, type Option } from './cmdline.ts';
import { COMMANDS, TICKERS } from './commands.ts';

const ALL: Option[] = [
	...COMMANDS.map((c) => ({ code: c.code, desc: c.desc, kind: 'Función' })),
	...TICKERS.map((t) => ({ code: t.code, desc: t.name, kind: 'Valor' }))
];

/** Lo que abriría la barra con ese texto, en forma corta: «/fuel» o «sym:NVDA». */
const open = (raw: string) => {
	const t = resolveInput(raw, suggest(raw, ALL));
	return t === null ? null : t.kind === 'command' ? t.command.route : `sym:${t.sym}`;
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

describe('resolveInput', () => {
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
