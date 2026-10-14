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

	it('junta los tres calendarios y, si uno falla, usa su copia anterior', async () => {
		mockFetch((url) => (url.includes('eurostat') ? EUROSTAT : url.includes('ine.es') ? INE : undefined));
		const previous = {
			events: [
				{ date: '2026-11-13T13:30:00.000Z', allDay: false, title: 'CPI', source: 'BLS' as const, topic: 'us-cpi' },
				{ date: '2026-10-01T12:30:00.000Z', allDay: false, title: 'viejo', source: 'BLS' as const, topic: 'us-cpi' }
			]
		};
		const { events } = await releasesCal.fetch(previous);
		expect(events.map((e) => [e.source, e.date])).toEqual(
			[
				['Eurostat', '2026-10-30T10:00:00.000Z'],
				['INE', '2026-10-29T23:00:00.000Z'],
				['BLS', '2026-11-13T13:30:00.000Z']
			].sort((a, b) => a[1].localeCompare(b[1]))
		);
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
