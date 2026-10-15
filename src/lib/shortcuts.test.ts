import { describe, expect, it } from 'vitest';
import { isShortcut, SHORTCUTS } from './shortcuts.ts';

describe('shortcuts', () => {
	it('no repite ids', () => {
		expect(new Set(SHORTCUTS.map((s) => s.id)).size).toBe(SHORTCUTS.length);
	});
	it('cada atajo tiene teclas o texto', () => {
		for (const s of SHORTCUTS) expect(s.keys.length > 0 || 'how' in s).toBe(true);
	});
	it('reconoce las teclas', () => {
		expect(isShortcut({ key: '/', shiftKey: false }, 'bar')).toBe(true);
		expect(isShortcut({ key: 'F', shiftKey: true }, 'fullscreen')).toBe(true);
		expect(isShortcut({ key: 'ArrowRight', shiftKey: false, altKey: true }, 'queue')).toBe(true);
		expect(isShortcut({ key: 'ArrowRight', shiftKey: false }, 'queue')).toBe(false);
		expect(isShortcut({ key: 'f', shiftKey: false }, 'fullscreen')).toBe(false);
		expect(isShortcut({ key: 'M', shiftKey: true }, 'panel')).toBe(true);
		expect(isShortcut({ key: 'Escape', shiftKey: false }, 'home')).toBe(true);
		expect(isShortcut({ key: 'Enter', shiftKey: false }, 'open')).toBe(false);
	});
});
