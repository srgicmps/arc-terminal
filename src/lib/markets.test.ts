import { describe, expect, it } from 'vitest';
import { b3Holidays, bmeHolidays, CLOCK_MARKETS, clockState, easter, localDate, lseHolidays, madridDay, MARKETS, marketStatus, nyseHolidays, until, xetraHolidays, zoned } from './markets.ts';

const dates = (list: { date: string }[]) => list.map((h) => h.date);

describe('markets', () => {
	it('calcula el domingo de Pascua', () => {
		expect(easter(2024)).toEqual({ m: 3, d: 31 });
		expect(easter(2025)).toEqual({ m: 4, d: 20 });
		expect(easter(2026)).toEqual({ m: 4, d: 5 });
		expect(easter(2027)).toEqual({ m: 3, d: 28 });
	});

	it('NYSE 2026: el 4 de julio cae en sábado y se cierra el viernes 3', () => {
		expect(dates(nyseHolidays(2026))).toEqual([
			'2026-01-01',
			'2026-01-19',
			'2026-02-16',
			'2026-04-03',
			'2026-05-25',
			'2026-06-19',
			'2026-07-03',
			'2026-09-07',
			'2026-11-26',
			'2026-12-25'
		]);
	});

	it('NYSE 2027: Navidad en sábado se cierra el 24 y Juneteenth el 18', () => {
		const list = dates(nyseHolidays(2027));
		expect(list).toContain('2027-12-24');
		expect(list).toContain('2027-06-18');
		expect(list).toContain('2027-07-05');
		expect(list).toContain('2027-03-26');
	});

	it('NYSE 2022: Año Nuevo en sábado no se recupera', () => {
		expect(dates(nyseHolidays(2022))[0]).toBe('2022-01-17');
	});

	it('BME 2026: días sin TARGET2 que caen entre semana', () => {
		expect(dates(bmeHolidays(2026))).toEqual([
			'2026-01-01',
			'2026-04-03',
			'2026-04-06',
			'2026-05-01',
			'2026-12-25'
		]);
	});

	it('LSE: Navidad en sábado pasa al lunes 27 y San Esteban al martes 28 (2027)', () => {
		expect(dates(lseHolidays(2027))).toEqual([
			'2027-01-01',
			'2027-03-26',
			'2027-03-29',
			'2027-05-03',
			'2027-05-31',
			'2027-08-30',
			'2027-12-27',
			'2027-12-28'
		]);
		// 2028: Año Nuevo en sábado → lunes 3; Navidad lunes y San Esteban martes.
		expect(dates(lseHolidays(2028))).toContain('2028-01-03');
		expect(dates(lseHolidays(2028)).slice(-2)).toEqual(['2028-12-25', '2028-12-26']);
	});

	describe('reloj de bolsas', () => {
		const market = (code: string) => CLOCK_MARKETS.find((m) => m.code === code)!;
		const at = (iso: string) => Date.parse(iso);

		it('un martes normal: Nueva York abierta a las 10:00 y Madrid cerrada a las 18:00', () => {
			// 14 oct 2026, 16:00 Madrid = 10:00 Nueva York (las dos en horario de verano).
			expect(clockState(market('NYC'), at('2026-10-14T14:00:00Z'))).toEqual({ time: '10:00', isOpen: true, holiday: null });
			expect(clockState(market('MAD'), at('2026-10-14T16:00:00Z'))).toEqual({ time: '18:00', isOpen: false, holiday: null });
		});

		it('Navidad: Nueva York y Londres cerradas por festivo en horario de sesión', () => {
			expect(clockState(market('NYC'), at('2026-12-25T15:00:00Z'))).toEqual({ time: '10:00', isOpen: false, holiday: 'Navidad' });
			expect(clockState(market('LON'), at('2026-12-25T10:00:00Z'))).toEqual({ time: '10:00', isOpen: false, holiday: 'Navidad' });
		});

		it('Lunes de Pascua: Madrid cerrada por festivo y Nueva York abierta', () => {
			expect(clockState(market('MAD'), at('2026-04-06T08:00:00Z'))).toEqual({
				time: '10:00',
				isOpen: false,
				holiday: 'Lunes de Pascua'
			});
			expect(clockState(market('NYC'), at('2026-04-06T15:00:00Z')).isOpen).toBe(true);
		});

		it('el festivo se mira con la fecha local de la bolsa, no con la de Madrid', () => {
			// 4 jul 2025 (viernes), 23:30 en Nueva York = 5:30 del sábado en Madrid: sigue siendo el festivo.
			expect(clockState(market('NYC'), at('2025-07-05T03:30:00Z')).holiday).toBe('Día de la Independencia');
		});

		it('Tokio cierra a mediodía y los fines de semana', () => {
			expect(clockState(market('TYO'), at('2026-10-14T02:30:00Z')).isOpen).toBe(false); // 11:30
			expect(clockState(market('TYO'), at('2026-10-14T04:00:00Z')).isOpen).toBe(true); // 13:00
			expect(clockState(market('TYO'), at('2026-10-17T04:00:00Z')).isOpen).toBe(false); // sábado
		});
	});
});

describe('sesiones de las bolsas', () => {
	const at = (iso: string) => Date.parse(iso);
	const mk = (code: string) => MARKETS.find((m) => m.code === code)!;
	const hhmm = (frac: number) => {
		const mins = Math.round(frac * 1440);
		return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
	};

	it('zoned: hora local a instante, con y sin horario de verano', () => {
		expect(new Date(zoned('2026-10-14', 570, 'America/New_York')).toISOString()).toBe('2026-10-14T13:30:00.000Z');
		expect(new Date(zoned('2026-12-14', 570, 'America/New_York')).toISOString()).toBe('2026-12-14T14:30:00.000Z');
		expect(new Date(zoned('2026-10-14', 0, 'Europe/Madrid')).toISOString()).toBe('2026-10-13T22:00:00.000Z');
		expect(new Date(zoned('2026-10-14', 540, 'Asia/Tokyo')).toISOString()).toBe('2026-10-14T00:00:00.000Z');
	});

	it('el reloj de la barra sigue con sus cuatro bolsas', () => {
		expect(CLOCK_MARKETS.map((m) => m.code)).toEqual(['NYC', 'LON', 'MAD', 'TYO']);
	});

	it('abierta: cuándo cierra; cerrada: cuándo abre', () => {
		// Miércoles 14 oct 2026, 13:20 en Nueva York (19:20 en Madrid).
		expect(marketStatus(mk('NYC'), at('2026-10-14T17:20:00Z'))).toEqual({ isOpen: true, next: at('2026-10-14T20:00:00Z'), holiday: null });
		// A las 13:20 de Madrid, Nueva York abre en 2 h 10 min.
		const ny = marketStatus(mk('NYC'), at('2026-10-14T11:20:00Z'));
		expect(ny.isOpen).toBe(false);
		expect(until(ny.next! - at('2026-10-14T11:20:00Z'))).toBe('2 h 10 min');
	});

	it('pausa de mediodía y fin de semana', () => {
		// Hong Kong a las 12:30: vuelve a las 13:00.
		expect(marketStatus(mk('HKG'), at('2026-10-14T04:30:00Z'))).toMatchObject({ isOpen: false, next: at('2026-10-14T05:00:00Z') });
		// Sábado: Madrid abre el lunes a las 9:00.
		expect(marketStatus(mk('MAD'), at('2026-10-17T10:00:00Z')).next).toBe(at('2026-10-19T07:00:00Z'));
	});

	it('festivos: Navidad en Nueva York abre el día 28', () => {
		const st = marketStatus(mk('NYC'), at('2026-12-25T15:00:00Z'));
		expect(st).toMatchObject({ isOpen: false, holiday: 'Navidad' });
		expect(new Date(st.next!).toISOString()).toBe('2026-12-28T14:30:00.000Z');
	});

	it('la barra de 24 h va en hora de Madrid, también cuando EE. UU. aún no ha cambiado la hora', () => {
		const day = madridDay(mk('NYC'), at('2026-10-14T10:00:00Z'));
		expect(day.spans.map(([a, b]) => [hhmm(a), hhmm(b)])).toEqual([['15:30', '22:00']]);
		expect(hhmm(day.now)).toBe('12:00');
		// Lunes 26 oct: Europa ya está en horario de invierno y EE. UU. no (hasta el 1 nov).
		expect(madridDay(mk('NYC'), at('2026-10-26T10:00:00Z')).spans.map(([a, b]) => [hhmm(a), hhmm(b)])).toEqual([['14:30', '21:00']]);
		// Tokio, con su pausa: dos tramos de madrugada.
		expect(madridDay(mk('TYO'), at('2026-10-14T10:00:00Z')).spans.map(([a, b]) => [hhmm(a), hhmm(b)])).toEqual([
			['02:00', '04:30'],
			['05:30', '08:30']
		]);
		// Domingo: nada.
		expect(madridDay(mk('MAD'), at('2026-10-18T10:00:00Z')).spans).toEqual([]);
	});

	it('until: formato corto', () => {
		expect(until(45 * 60_000)).toBe('45 min');
		expect(until(120 * 60_000)).toBe('2 h');
		expect(until((2 * 1440 + 3 * 60 + 5) * 60_000)).toBe('2 d 3 h');
	});
});

describe('formateadores guardados por zona', () => {
	// Versión anterior, que creaba un Intl.DateTimeFormat en cada llamada: la de ahora tiene que dar lo mismo.
	const beforeLocalDate = (tz: string, ms: number) =>
		new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
	const beforeOffset = (tz: string, ms: number) => {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: tz,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23'
		}).formatToParts(new Date(ms));
		const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
		const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
		return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
	};
	const beforeZoned = (date: string, mins: number, tz: string) => {
		const [y, m, d] = date.split('-').map(Number);
		const guess = Date.UTC(y, m - 1, d, 0, mins);
		return guess - beforeOffset(tz, guess - beforeOffset(tz, guess) * 60_000) * 60_000;
	};
	const beforeClock = (market: (typeof MARKETS)[number], now: number) => {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone: market.tz,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			weekday: 'short',
			hourCycle: 'h23'
		}).formatToParts(new Date(now));
		const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
		const [h, m] = [Number(get('hour')), Number(get('minute'))];
		const date = `${get('year')}-${get('month')}-${get('day')}`;
		const holiday = market.holidays?.(Number(get('year'))).find((x) => x.date === date)?.name ?? null;
		const mins = h * 60 + m;
		const weekend = get('weekday') === 'Sat' || get('weekday') === 'Sun';
		let isOpen = !weekend && !holiday && mins >= market.open[0] && mins < market.open[1];
		if (isOpen && market.lunch && mins >= market.lunch[0] && mins < market.lunch[1]) isOpen = false;
		return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, isOpen, holiday };
	};

	const zones = [...new Set([...MARKETS.map((m) => m.tz), 'UTC', 'America/Los_Angeles', 'Australia/Sydney', 'Asia/Kathmandu'])];
	// Cada 21 h 39 min durante dos años (así cae a todas las horas), con los cambios de hora de los dos hemisferios dentro.
	const instants = Array.from({ length: 800 }, (_, i) => Date.parse('2025-01-01T00:00:00Z') + i * 1299 * 60_000);

	it('localDate y zoned dan lo mismo que antes, zona a zona y alternando zonas', () => {
		instants.forEach((ms, i) => {
			const tz = zones[i % zones.length];
			const date = localDate(tz, ms);
			expect(date).toBe(beforeLocalDate(tz, ms));
			const mins = (i * 37) % 1440;
			expect(zoned(date, mins, tz), `${date} ${mins} ${tz}`).toBe(beforeZoned(date, mins, tz));
		});
	});

	it('clockState da lo mismo que antes', () => {
		instants.forEach((ms, i) => {
			const mk = MARKETS[i % MARKETS.length];
			expect(clockState(mk, ms), `${mk.code} ${new Date(ms).toISOString()}`).toEqual(beforeClock(mk, ms));
		});
	});
});

describe('festivos de Fráncfort y São Paulo', () => {
	const mk = (code: string) => MARKETS.find((m) => m.code === code)!;
	it('el 25 de diciembre no abren; Fráncfort vuelve el 28 y São Paulo el 28', () => {
		const at = Date.parse('2026-12-25T10:00:00Z');
		expect(marketStatus(mk('FRA'), at)).toMatchObject({ isOpen: false, holiday: 'Navidad' });
		expect(new Date(marketStatus(mk('FRA'), at).next!).toISOString()).toBe('2026-12-28T08:00:00.000Z');
		expect(marketStatus(mk('SAO'), Date.parse('2026-12-25T15:00:00Z'))).toMatchObject({ isOpen: false, holiday: 'Navidad' });
	});

	it('Xetra: Pascua y fin de año; B3: Carnaval y Corpus Christi', () => {
		const xetra = xetraHolidays(2026).map((h) => h.date);
		expect(xetra).toEqual(['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-24', '2026-12-25', '2026-12-31']);
		const b3 = b3Holidays(2026).map((h) => `${h.date} ${h.name}`);
		expect(b3).toContain('2026-02-16 Carnaval');
		expect(b3).toContain('2026-02-17 Carnaval');
		expect(b3).toContain('2026-06-04 Corpus Christi');
	});
});
