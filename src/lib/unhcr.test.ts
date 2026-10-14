import { describe, expect, it } from 'vitest';
import { byCountry, top } from './unhcr.ts';
import type { UnhcrData } from './types.ts';

const data: UnhcrData = {
	year: 2025,
	countries: [
		{ iso3: 'SYR', name: 'Syrian Arab Rep.', from: 6_000_000, hosted: 10_000, idps: 7_000_000 },
		{ iso3: 'TUR', name: 'Türkiye', from: 50_000, hosted: 3_000_000, idps: 0 },
		{ iso3: 'XKX', name: 'Kosovo', from: 1_000, hosted: 0, idps: 0 }
	]
};

describe('unhcr', () => {
	it('top: de más a menos, sin ceros y con el nombre en español si la terminal conoce el país', () => {
		expect(top(data, 'hosted').map((c) => c.iso3)).toEqual(['TUR', 'SYR']);
		expect(top(data, 'from', 2).map((c) => c.value)).toEqual([6_000_000, 50_000]);
		expect(top(null, 'from')).toEqual([]);
	});

	it('byCountry: solo los países que conoce la terminal, por código de dos letras', () => {
		const out = byCountry(data);
		expect(Object.keys(out).sort()).toEqual(expect.arrayContaining(['TR']));
		expect(out.XK).toBeUndefined();
	});
});
