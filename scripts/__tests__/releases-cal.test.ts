// Calendarios de publicación (Eurostat, BLS, INE) y su relación con las series de la terminal.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextFor, shortDay, topicOf } from '../../src/lib/nextrelease.ts';
import { releasesCal, upcoming } from '../sources/releases-cal.ts';
import { mockFetch } from './mock.ts';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const ics = (...events: [string, string][]) =>
	[
		'BEGIN:VCALENDAR',
		...events.flatMap(([start, summary]) => ['BEGIN:VEVENT', `DTSTART${start}`, `SUMMARY:${summary}`, 'END:VEVENT']),
		'END:VCALENDAR'
	].join('\r\n');

const EUROSTAT = ics(
	[':20261013T090000Z', 'Euro area unemployment - August 2026'], // ya pasado
	[';TZID=Europe/Luxembourg:20261030T110000', 'Flash estimate euro area inflation - October 2026'],
	[':20261231T100000Z', 'Euro area GDP'] // más allá de 45 días
);
const BLS = ics([';TZID=America/New_York:20261113T083000', 'Consumer Price Index for October 2026']);
const INE = ics([';VALUE=DATE:20261030', 'Índice de Precios de Consumo (IPC). Indicador adelantado. Octubre 2026']);

describe('releases-cal', () => {
	it('reconoce los temas por organismo y título', () => {
		expect(topicOf('Eurostat', 'Flash estimate euro area inflation')).toBe('ea-inflation');
		expect(topicOf('BLS', 'The Employment Situation for October')).toBe('us-jobs');
		expect(topicOf('INE', 'Encuesta de Población Activa (EPA). Tercer trimestre')).toBe('es-epa');
		expect(topicOf('INE', 'Estadística de Hipotecas')).toBeNull();
	});

	it('se queda con los próximos 45 días', () => {
		const events = upcoming('Eurostat', EUROSTAT, 'Europe/Luxembourg', new Date('2026-10-14T00:00:00Z'));
		expect(events).toEqual([
			{
				date: '2026-10-30T10:00:00.000Z',
				allDay: false,
				title: 'Flash estimate euro area inflation - October 2026',
				source: 'Eurostat',
				topic: 'ea-inflation'
			}
		]);
	});

	it('junta INE, Eurostat y el BLS (fechas de FRED); si uno falla, usa su copia anterior', async () => {
		vi.stubEnv('FRED_API_KEY', 'clave');
		const fetch = mockFetch((url) => {
			if (url.includes('ine.es')) return INE;
			if (url.includes('release_id=10')) return { release_dates: [{ date: '2026-11-13' }, { date: '2027-03-01' }] };
			if (url.includes('release_id=50')) return { release_dates: [{ date: '2026-11-06' }] };
			return undefined; // Eurostat no responde
		});
		const previous = {
			events: [
				{
					date: '2026-10-30T10:00:00.000Z',
					allDay: false,
					title: 'Inflation',
					source: 'Eurostat' as const,
					topic: 'ea-inflation'
				},
				{
					date: '2026-10-01T09:00:00.000Z',
					allDay: false,
					title: 'viejo',
					source: 'Eurostat' as const,
					topic: 'ea-inflation'
				}
			]
		};
		const { events } = await releasesCal.fetch(previous);
		expect(events.map((e) => [e.source, e.date, e.topic])).toEqual([
			['INE', '2026-10-29T23:00:00.000Z', 'es-ipc'],
			['Eurostat', '2026-10-30T10:00:00.000Z', 'ea-inflation'],
			['BLS', '2026-11-06T13:30:00.000Z', 'us-jobs'],
			['BLS', '2026-11-13T13:30:00.000Z', 'us-cpi']
		]);
		// La clave va en la consulta a FRED, que no se publica.
		expect(String(fetch.mock.calls.find((c) => String(c[0]).includes('stlouisfed'))?.[0])).toContain('api_key=clave');
		vi.unstubAllEnvs();
	});

	it('sin la clave de FRED, sin el BLS', async () => {
		mockFetch((url) => (url.includes('ine.es') ? INE : url.includes('eurostat') ? EUROSTAT : undefined));
		const { events } = await releasesCal.fetch(undefined);
		expect(events.some((e) => e.source === 'BLS')).toBe(false);
		expect(events).toHaveLength(2);
	});

	it('falla si no responde ninguno', async () => {
		mockFetch(() => undefined);
		await expect(releasesCal.fetch(undefined)).rejects.toThrow('ningún calendario');
	});

	it('próximo dato de cada serie', async () => {
		const events = upcoming('BLS', BLS, 'America/New_York', new Date('2026-10-14T00:00:00Z'));
		expect(nextFor('core-cpi-us', events)?.date).toBe('2026-11-13T13:30:00.000Z');
		expect(nextFor('cpi-us', events, new Date('2026-12-01'))).toBeNull();
		expect(nextFor('unemployment-us', events)).toBeNull();
		expect(nextFor('wti', events)).toBeNull();
		expect(shortDay('2026-11-13T13:30:00.000Z')).toBe('13 nov');
	});
});
