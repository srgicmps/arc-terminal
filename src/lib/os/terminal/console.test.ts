import { describe, expect, it } from 'vitest';
import { commonPrefix, complete, execLine, type ExecCtx } from './console.ts';
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
	it('limpia y da ayuda', () => {
		expect(execLine('clear', ctx()).clear).toBe(true);
		expect(execLine('ayuda', ctx()).lines.length).toBeGreaterThan(4);
	});
	it('enseña el historial', () => {
		expect(execLine('historial', ctx({ history: ['ECO', 'NVDA'] })).lines.map((l) => l.text)).toContain('  2  NVDA');
	});
	it('completa con Tab', () => {
		expect(complete('limp', all).value).toBe('limpiar');
		expect(commonPrefix(['WS', 'WB', 'WX'])).toBe('W');
		expect(complete('xyzxyz', all).list).toEqual([]);
	});
});
