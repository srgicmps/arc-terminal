import { describe, expect, it } from 'vitest';
import { actionOption, nextMis, parseAction, shareInfo, shareTarget } from './actions.ts';

describe('parseAction', () => {
	it('reconoce «compartir» con y sin vista, sin importar mayúsculas ni tildes', () => {
		expect(parseAction('compartir WS')).toEqual({ kind: 'share', arg: 'WS' });
		expect(parseAction('COMPARTIR')).toEqual({ kind: 'share', arg: '' });
		expect(parseAction('share eco')).toEqual({ kind: 'share', arg: 'eco' });
	});
	it('deja pasar los comandos normales', () => {
		expect(parseAction('WS')).toBeNull();
		expect(parseAction('NEWS compartir')).toBeNull();
		expect(parseAction('')).toBeNull();
	});
});

describe('compartir una vista', () => {
	it('resuelve el comando y su ruta', () => {
		const target = shareTarget({ arg: 'ws' }, []);
		expect(target?.kind).toBe('command');
		const info = shareInfo(target!);
		expect(info.route).toBe('/ws');
		expect(info.title).toBe('Arc Terminal · WS');
	});
	it('un valor va a su ficha', () => {
		const info = shareInfo(shareTarget({ arg: 'NVDA' }, [])!);
		expect(info.route).toBe('/s');
		expect(info.search).toBe('?sym=NVDA');
	});
	it('sin vista, la abierta', () => {
		expect(shareTarget({ arg: '' }, [])).toBeNull();
		expect(actionOption({ kind: 'share', arg: '' }, 'compartir', []).code).toBe('COMPARTIR');
	});
	it('la sugerencia ejecuta lo escrito', () => {
		const o = actionOption({ kind: 'share', arg: 'ws' }, ' compartir ws ', []);
		expect(o).toMatchObject({ code: 'COMPARTIR WS', kind: 'Acción', run: 'compartir ws' });
	});
});

describe('acciones de MIS, vigila y alerta', () => {
	it('«+NVDA» y «-aapl»', () => {
		expect(parseAction('+NVDA')).toEqual({ kind: 'mis', add: true, code: 'NVDA' });
		expect(parseAction(' - aapl')).toEqual({ kind: 'mis', add: false, code: 'AAPL' });
		expect(parseAction('+')).toBeNull();
	});
	it('nextMis añade al final sin repetir y quita', () => {
		expect(nextMis(['AAPL', 'NVDA'], { add: true, code: 'NVDA' })).toEqual(['AAPL', 'NVDA']);
		expect(nextMis(['AAPL'], { add: true, code: 'MSFT' })).toEqual(['AAPL', 'MSFT']);
		expect(nextMis(['AAPL', 'MSFT'], { add: false, code: 'AAPL' })).toEqual(['MSFT']);
	});
	it('«vigila aranceles»', () => {
		expect(parseAction('vigila  aranceles  UE')).toMatchObject({ kind: 'watch', word: 'aranceles UE' });
		expect(parseAction('VIGILA')).toMatchObject({ kind: 'watch', word: null });
	});
	it('«alerta …»', () => {
		const a = parseAction('alerta NVDA > 150');
		expect(a).toMatchObject({ kind: 'alert', alert: { asset: 'NVDA', op: '>', value: 150 } });
		expect(parseAction('alerta tontería')).toMatchObject({ kind: 'alert', alert: null });
		expect(actionOption(parseAction('alertas')!, 'alertas', []).code).toBe('ALERTAS');
		expect(actionOption(a!, 'alerta NVDA > 150', []).code).toBe('ALERTA NVDA > 150');
	});
});
