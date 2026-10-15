import { describe, expect, it } from 'vitest';
import { hashPanel, panelHash, samePanel } from './panelhash.ts';

describe('panelhash', () => {
	it('va y vuelve', () => {
		expect(panelHash('Curvas de tipos')).toBe('#panel=Curvas%20de%20tipos');
		expect(hashPanel(panelHash('Inflación del G20'))).toBe('Inflación del G20');
		expect(hashPanel('#cmd-ECO')).toBeNull();
		expect(hashPanel('#panel=%E0')).toBeNull();
	});

	it('compara sin tildes ni mayúsculas', () => {
		expect(samePanel('inflacion del g20', 'Inflación del G20')).toBe(true);
	});
});
