import { describe, expect, it } from 'vitest';
import { europeAverage, vsAverage, zonesOf } from './eupower.ts';
import type { EuPowerZone } from './types.ts';

const z = (zone: string, country: string, today: number | null, tomorrow: number | null): EuPowerZone => ({ zone, country, name: zone, today, tomorrow, source: 'X' });
const zones = [z('ES', 'ES', 60, 80), z('FR', 'FR', 90, null), z('DE-LU', 'DE', 120, 100)];

describe('eupower', () => {
	it('media de las zonas con precio, día a día', () => {
		expect(europeAverage(zones, 'today')).toBe(90);
		expect(europeAverage(zones, 'tomorrow')).toBe(90);
		expect(europeAverage([], 'today')).toBeNull();
	});

	it('España frente a la media', () => {
		expect(vsAverage(zones, 'ES', 'today')).toEqual({ diff: -30, pct: (-30 / 90) * 100 });
		expect(vsAverage(zones, 'FR', 'tomorrow')).toBeNull();
		expect(vsAverage(zones, 'XX', 'today')).toBeNull();
	});

	it('zonas de un país', () => {
		expect(zonesOf(zones, 'DE').map((x) => x.zone)).toEqual(['DE-LU']);
	});
});
