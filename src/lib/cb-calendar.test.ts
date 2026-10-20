import { describe, expect, it } from 'vitest';
import { CB, CB_MEETINGS, cbUpcoming, lprDates, zonedInstant, type CbBank } from './cb-calendar.ts';
import { decisionTime, MEETINGS } from './meetings.ts';
import { hm } from './format.ts';

describe('cb-calendar', () => {
	// Aviso anual: a partir de octubre tiene que estar el calendario del año siguiente de cada banco.
	it('tiene las fechas del año que viene', () => {
		const now = new Date();
		const year = now.getUTCFullYear() + (now.getUTCMonth() >= 9 ? 1 : 0);
		const missing = (Object.keys(CB) as CbBank[]).filter(
			(b) => !CB_MEETINGS.some((m) => m.bank === b && m.date.startsWith(String(year)))
		);
		expect(missing, `Faltan fechas de ${year} en src/lib/cb-calendar.ts`).toEqual([]);
	});

	it('pasa la hora local del banco a hora de Madrid, con los cambios de hora', () => {
		// BoE a las 12:00 de Londres: 13:00 en Madrid todo el año.
		expect(hm(zonedInstant('2026-11-05', '12:00', 'Europe/London').toISOString())).toBe('13:00');
		// BoC a las 9:45 de Toronto: 15:45 en Madrid; la semana en que solo ha cambiado Europa, 14:45.
		expect(hm(zonedInstant('2026-12-09', '09:45', 'America/Toronto').toISOString())).toBe('15:45');
		expect(hm(zonedInstant('2026-10-28', '09:45', 'America/Toronto').toISOString())).toBe('14:45');
		// RBA a las 14:30 de Sídney (horario de verano austral): 04:30 en Madrid.
		expect(hm(zonedInstant('2026-12-08', '14:30', 'Australia/Sydney').toISOString())).toBe('04:30');
	});

	it('da al BCE y a la Fed la misma hora que meetings.ts', () => {
		for (const m of MEETINGS) {
			const cb = CB_MEETINGS.find((c) => c.bank === m.bank && c.date === m.date);
			expect(cb?.at && hm(cb.at)).toBe(decisionTime(m));
		}
	});

	it('zonedInstant con el formateador guardado da lo mismo que antes', () => {
		// Versión anterior, con un Intl.DateTimeFormat nuevo en cada llamada.
		const before = (date: string, time: string, tz: string) => {
			const guess = new Date(`${date}T${time}:00Z`);
			const parts = new Intl.DateTimeFormat('en-GB', {
				timeZone: tz,
				hourCycle: 'h23',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			}).formatToParts(guess);
			const p = (t: string) => Number(parts.find((x) => x.type === t)?.value);
			return new Date(guess.getTime() - (Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute')) - guess.getTime()));
		};
		const zones = [...new Set(Object.values(CB).map((b) => b.tz))];
		const times = ['00:30', '02:00', '09:45', '12:00', '14:15', '23:59'];
		// Un día de cada 3 durante dos años, alternando zonas y horas.
		for (let i = 0; i < 250; i++) {
			const date = new Date(Date.UTC(2026, 0, 1 + i * 3)).toISOString().slice(0, 10);
			const tz = zones[i % zones.length];
			const time = times[i % times.length];
			expect(zonedInstant(date, time, tz).toISOString(), `${date} ${time} ${tz}`).toBe(before(date, time, tz).toISOString());
		}
		// Y cada reunión de la lista, con su zona.
		for (const m of CB_MEETINGS.filter((x) => x.at)) expect(m.at).toBe(before(m.date, CB[m.bank].time!, CB[m.bank].tz).toISOString());
	});

	it('mueve el LPR del fin de semana al lunes', () => {
		const d = lprDates(2026);
		expect(d).toHaveLength(12);
		expect(d[8]).toBe('2026-09-21'); // domingo 20 → lunes 21
		expect(d[5]).toBe('2026-06-22'); // sábado 20 → lunes 22
		expect(d[9]).toBe('2026-10-20');
	});

	it('filtra por fecha y banco, en orden', () => {
		const list = cbUpcoming('2026-10-14');
		expect(list[0].date >= '2026-10-14').toBe(true);
		expect(list.every((m, i) => i === 0 || (list[i - 1].at ?? list[i - 1].date) <= (m.at ?? `${m.date}T12:00`))).toBe(true);
		expect(cbUpcoming('2026-10-14', ['boj'])[0]).toMatchObject({ bank: 'boj', date: '2026-10-30', at: null });
	});
});
