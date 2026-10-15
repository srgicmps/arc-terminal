import { describe, expect, it } from 'vitest';
import { actionOption, parseAction, shareInfo, shareTarget } from './actions.ts';

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
		const target = shareTarget({ kind: 'share', arg: 'ws' }, []);
		expect(target?.kind).toBe('command');
		const info = shareInfo(target!);
		expect(info.route).toBe('/ws');
		expect(info.title).toBe('Arc Terminal · WS');
	});
	it('un valor va a su ficha', () => {
		const info = shareInfo(shareTarget({ kind: 'share', arg: 'NVDA' }, [])!);
		expect(info.route).toBe('/s');
		expect(info.search).toBe('?sym=NVDA');
	});
	it('sin vista, la abierta', () => {
		expect(shareTarget({ kind: 'share', arg: '' }, [])).toBeNull();
		expect(actionOption({ kind: 'share', arg: '' }, 'compartir', []).code).toBe('COMPARTIR');
	});
	it('la sugerencia ejecuta lo escrito', () => {
		const o = actionOption({ kind: 'share', arg: 'ws' }, ' compartir ws ', []);
		expect(o).toMatchObject({ code: 'COMPARTIR WS', kind: 'Acción', run: 'compartir ws' });
	});
});
