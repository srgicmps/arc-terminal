import { describe, expect, it } from 'vitest';
import { accountLine, keyLabel } from './account.ts';

describe('accountLine', () => {
	it('sin servidor no es un aviso', () => {
		expect(accountLine('local', '')).toEqual({ text: 'Sin cuenta: todo se queda en este navegador.', warn: false });
	});
	it('sin conexión, sesión caducada o error: aviso, y dice que se guarda aquí', () => {
		for (const s of ['offline', 'auth', 'error'] as const) {
			const l = accountLine(s, 'ana@x');
			expect(l.warn).toBe(true);
			expect(l.text).toMatch(/aquí/);
		}
	});
	it('lo que no cabe se nombra', () => {
		const l = accountLine('ok', 'ana@x', ['arc-os-note-n1']);
		expect(l.warn).toBe(true);
		expect(l.text).toContain('una nota muy larga');
		expect(accountLine('ok', 'ana@x').warn).toBe(false);
	});
	it('keyLabel usa prefs.ts', () => {
		expect(keyLabel('arc-os-fs')).toBe('tus carpetas del escritorio de arc os');
	});
});
