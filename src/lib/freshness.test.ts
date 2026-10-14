import { describe, expect, it } from 'vitest';
import { ageMinutes, ago, CRON_MINUTES, staleAfter } from './freshness.ts';

describe('staleAfter', () => {
	it('el doble del mayor entre maxAgeMinutes y el cron', () => {
		expect(staleAfter(175)).toBe(350);
		expect(staleAfter(25)).toBe(50);
		// Una fuente que se refresca más a menudo que el cron depende del cron.
		expect(staleAfter(12)).toBe(2 * CRON_MINUTES);
	});

	it('sin dato no avisa', () => {
		expect(staleAfter(undefined)).toBeNull();
		expect(staleAfter(null)).toBeNull();
		expect(staleAfter(0)).toBeNull();
	});
});

describe('ago', () => {
	it('minutos, horas y días en español corto', () => {
		expect(ago(45)).toBe('hace 45 min');
		expect(ago(59.9)).toBe('hace 59 min');
		expect(ago(60)).toBe('hace 1 h');
		expect(ago(372)).toBe('hace 6 h');
		expect(ago(24 * 60)).toBe('hace 1 d');
		expect(ago(3000)).toBe('hace 2 d');
	});

	it('nunca en negativo (relojes desajustados)', () => {
		expect(ago(-3)).toBe('hace 0 min');
	});
});

describe('ageMinutes', () => {
	const now = Date.parse('2026-10-14T12:00:00Z');

	it('minutos transcurridos', () => {
		expect(ageMinutes('2026-10-14T06:00:00Z', now)).toBe(360);
	});

	it('null sin fecha, con fecha rota o antes de arrancar el reloj', () => {
		expect(ageMinutes(null, now)).toBeNull();
		expect(ageMinutes('no es fecha', now)).toBeNull();
		expect(ageMinutes('2026-10-14T06:00:00Z', 0)).toBeNull();
	});
});
