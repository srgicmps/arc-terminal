import { describe, expect, it } from 'vitest';
import { esRegion, holidaysFor, upcomingBreaks, weekendOf, type WorldHoliday } from './puentes.ts';

const items: WorldHoliday[] = [
	{ date: '2026-10-12', name: 'Fiesta Nacional de España' }, // lunes
	{ date: '2026-11-01', name: 'Todos los Santos' }, // domingo
	{ date: '2026-11-09', name: 'Almudena', counties: ['ES-MD'] }, // lunes
	{ date: '2026-12-08', name: 'Inmaculada Concepción' }, // martes
	{ date: '2026-12-25', name: 'Navidad' }, // viernes
	{ date: '2027-01-06', name: 'Epifanía del Señor' } // miércoles
];

describe('puentes (F6)', () => {
	it('esRegion: la comunidad de Tu sitio', () => {
		expect(esRegion('Comunidad de Madrid')).toBe('ES-MD');
		expect(esRegion('Islas Baleares')).toBe('ES-IB');
		expect(esRegion('Cataluña')).toBe('ES-CT');
		expect(esRegion('')).toBeNull();
	});

	it('holidaysFor: los nacionales y los de tu comunidad', () => {
		expect([...holidaysFor(items, 'ES-MD').keys()]).toContain('2026-11-09');
		expect([...holidaysFor(items, 'ES-CT').keys()]).not.toContain('2026-11-09');
		expect([...holidaysFor(items, null).keys()]).not.toContain('2026-11-09');
	});

	it('upcomingBreaks: fin de semana largo, puente de un día y de dos', () => {
		const b = upcomingBreaks(holidaysFor(items, 'ES-MD'), '2026-10-15');
		expect(b.map((x) => [x.from, x.to, x.days, x.take])).toEqual([
			['2026-11-07', '2026-11-09', 3, []], // Almudena, lunes
			['2026-12-05', '2026-12-08', 4, ['2026-12-07']], // Inmaculada, martes: puente el lunes
			['2026-12-25', '2026-12-27', 3, []], // Navidad, viernes
			['2027-01-02', '2027-01-06', 5, ['2027-01-04', '2027-01-05']] // Reyes, miércoles: dos días
		]);
		expect(b[1].holidays).toEqual([{ date: '2026-12-08', names: ['Inmaculada Concepción'] }]);
	});

	it('con el fin de semana de cada país: en Israel el domingo es laborable', () => {
		const sunday = new Map([['2026-10-18', ['Fiesta']]]);
		expect(upcomingBreaks(sunday, '2026-10-15')).toEqual([]);
		const b = upcomingBreaks(sunday, '2026-10-15', 365, weekendOf('IL'));
		expect(b.map((x) => [x.from, x.to, x.days])).toEqual([['2026-10-16', '2026-10-18', 3]]);
		expect(weekendOf('FR')).toEqual([0, 6]);
	});
});
