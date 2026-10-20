import { describe, expect, it } from 'vitest';
import { isOsMode, osLabel, shouldInvite } from './mode.ts';

describe('modo de Arc OS', () => {
	it('nombres de Sergi', () => {
		expect(osLabel('clasico')).toBe('Terminal clásico');
		expect(osLabel('os')).toBe('Modo OS');
		expect(isOsMode('x')).toBe(false);
	});
	it('invita solo a quien ya usaba la terminal y no lo ha visto ni elegido', () => {
		expect(shouldInvite(null, null, ['arc-theme'])).toBe(true);
		expect(shouldInvite(null, null, [])).toBe(false);
		expect(shouldInvite('clasico', null, ['arc-theme'])).toBe(false);
		expect(shouldInvite(null, '1', ['arc-theme'])).toBe(false);
		expect(shouldInvite(null, null, ['arc-os-invite'])).toBe(false);
	});
	it('no invita a quien llega nuevo: arc-modo y arc-style los pone app.html solos', () => {
		expect(shouldInvite(null, null, ['arc-modo', 'arc-style'])).toBe(false);
		expect(shouldInvite(null, null, ['arc-modo', 'arc-style', 'arc-theme'])).toBe(true);
	});
});
