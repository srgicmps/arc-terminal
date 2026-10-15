import { describe, expect, it } from 'vitest';
import { commonPrefix, complete, execLine, looksLikeMath, type ExecCtx } from './console.ts';
import { COMMANDS } from '../../commands.ts';

const all = COMMANDS.map((c) => ({ code: c.code, desc: c.desc, kind: 'Función', aliases: c.aliases }));
const ctx = (over: Partial<ExecCtx> = {}): ExecCtx => ({ answers: { get: () => undefined, now: Date.UTC(2026, 9, 15, 10) }, all, history: [], ...over });

describe('consola de Arc OS', () => {
	it('abre un comando como la barra', () => {
		const r = execLine('eco', ctx());
		expect(r.open?.route).toBe('/eco');
		expect(r.history).toBe('ECO');
		expect(r.lines[0].text).toBe('arc> eco');
	});
	it('calcula sin abrir nada', () => {
		const r = execLine('=2*21', ctx());
		expect(r.open).toBeUndefined();
		expect(r.lines[1].text).toContain('42');
	});
	it('calcula también sin «=» y deja la cuenta para seguir', () => {
		const r = execLine('2+2', ctx());
		expect(r.open).toBeUndefined();
		expect(r.lines[1].text).toContain('= 4');
		expect(execLine('=2*21', ctx()).next).toBe('=42');
		expect(looksLikeMath('(1250-200)*1,21')).toBe(true);
		for (const t of ['2026', 'NVDA', 'eco', 'hora tokio', '100 usd eur']) expect(looksLikeMath(t), t).toBe(false);
	});
	it('marca lo que aún se está cargando para volver a pedirlo', () => {
		expect(execLine('100 usd eur', ctx()).pending).toBe(true);
		const fx = { rates: new Map([['USD', { perEur: 1.1, date: '2026-10-14' }], ['EUR', { perEur: 1, date: '2026-10-14' }]]), status: 'ok' } as unknown as ExecCtx['fx'];
		const r = execLine('110 usd eur', ctx({ fx }));
		expect(r.pending).toBeUndefined();
		expect(r.lines[1].text).toContain('= 100 EUR');
	});
	it('limpia y da ayuda', () => {
		expect(execLine('clear', ctx()).clear).toBe(true);
		expect(execLine('ayuda', ctx()).lines.length).toBeGreaterThan(4);
	});
	it('enseña el historial', () => {
		expect(execLine('historial', ctx({ history: ['ECO', 'NVDA'] })).lines.map((l) => l.text)).toContain('  2  NVDA');
	});
	it('completa con Tab', () => {
		expect(complete('limp', all).value).toBe('limpiar');
		// «lim» también encaja con otras cosas por su descripción, pero solo «limpiar» empieza así.
		expect(complete('lim', all).value).toBe('limpiar');
		expect(complete('NEW', all).value.trim()).toBe('NEWS');
		const w = complete('W', all);
		expect(w.value).toBe('W');
		expect(w.list.length).toBeGreaterThan(1);
		expect(commonPrefix(['WS', 'WB', 'WX'])).toBe('W');
		expect(complete('xyzxyz', all).list).toEqual([]);
	});
});
