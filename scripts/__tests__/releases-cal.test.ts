// Calendarios de publicación (Eurostat, BLS, INE) y su relación con las series de la terminal.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextFor, nextMap, shortDay, topicOf } from '../../src/lib/nextrelease.ts';
import { pastEvents, releasesCal, upcoming } from '../sources/releases-cal.ts';
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
		expect(topicOf('INE', 'Contabilidad Nacional Trimestral de España (CNTR). Avance')).toBe('es-gdp');
		expect(topicOf('Fed', 'H.4.1 Factors Affecting Reserve Balances')).toBe('us-h41');
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

	it('el dato de día completo de hoy sigue; el de ayer no', () => {
		const cal = ics([';VALUE=DATE:20261014', 'IPC hoy'], [';VALUE=DATE:20261013', 'IPC ayer']);
		const events = upcoming('INE', cal, 'Europe/Madrid', new Date('2026-10-14T10:00:00Z'));
		expect(events.map((e) => e.title)).toEqual(['IPC hoy']);
	});

	it('junta el INE y el BLS (fechas de FRED); si uno falla, usa su copia anterior', async () => {
		vi.stubEnv('FRED_API_KEY', 'clave');
		const fetch = mockFetch((url) => {
			if (url.includes('release_id=10')) return { release_dates: [{ date: '2026-11-13' }, { date: '2027-03-01' }] };
			if (url.includes('release_id=50')) return { release_dates: [{ date: '2026-11-06' }] };
			return undefined; // el INE no responde
		});
		const previous = {
			events: [
				{ date: '2026-10-30T08:00:00.000Z', allDay: false, title: 'IPC', source: 'INE' as const, topic: 'es-ipc' },
				{ date: '2026-10-01T07:00:00.000Z', allDay: false, title: 'viejo', source: 'INE' as const, topic: 'es-ipc' }
			]
		};
		const { events } = await releasesCal.fetch(previous);
		expect(events.map((e) => [e.source, e.date, e.topic])).toEqual([
			['INE', '2026-10-30T08:00:00.000Z', 'es-ipc'],
			['BLS', '2026-11-06T13:30:00.000Z', 'us-jobs'],
			['BLS', '2026-11-13T13:30:00.000Z', 'us-cpi']
		]);
		// La clave va en la consulta a FRED, que no se publica.
		expect(String(fetch.mock.calls.find((c) => String(c[0]).includes('stlouisfed'))?.[0])).toContain('api_key=clave');
		vi.unstubAllEnvs();
	});

	it('PIB y PCE (BEA), paro semanal (DOL) y H.4.1 (Fed), cada uno con su hora; si uno falla, siguen los demás', async () => {
		vi.stubEnv('FRED_API_KEY', 'clave');
		mockFetch((url) => {
			if (url.includes('release_id=53')) return { release_dates: [{ date: '2026-10-29' }] };
			if (url.includes('release_id=180')) return { release_dates: [{ date: '2026-10-15' }] };
			if (url.includes('release_id=20')) return { release_dates: [{ date: '2026-10-15' }] };
			return undefined;
		});
		const { events } = await releasesCal.fetch(undefined);
		expect(events.map((e) => [e.source, e.date, e.topic])).toEqual([
			['DOL', '2026-10-15T12:30:00.000Z', 'us-claims'],
			['Fed', '2026-10-15T20:30:00.000Z', 'us-h41'],
			['BEA', '2026-10-29T12:30:00.000Z', 'us-gdp']
		]);
		vi.unstubAllEnvs();
	});

	it('sin la clave de FRED, solo el INE', async () => {
		mockFetch((url) => (url.includes('ine.es') ? INE : undefined));
		const { events } = await releasesCal.fetch(undefined);
		expect(events.map((e) => e.source)).toEqual(['INE']);
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

	it('mapa de próximos datos por serie, para SeriesTable', () => {
		const events = upcoming('BLS', BLS, 'America/New_York', new Date('2026-10-14T00:00:00Z'));
		expect(nextMap(['cpi-us', 'core-cpi-us', 'wti'], events)).toEqual({
			'cpi-us': { date: '2026-11-13T13:30:00.000Z', title: 'Consumer Price Index for October 2026' },
			'core-cpi-us': { date: '2026-11-13T13:30:00.000Z', title: 'Consumer Price Index for October 2026' }
		});
	});
});

describe('pastEvents', () => {
	const ev = (date: string, title: string) => ({ date, allDay: false, title, source: 'INE' as const, topic: 'ipc' });
	it('guarda las de los últimos 8 días, sin repetir y por fecha', () => {
		const from = new Date('2026-10-14T00:00:00Z');
		const previous = {
			past: [ev('2026-10-01T07:00:00Z', 'muy vieja'), ev('2026-10-10T07:00:00Z', 'IPC')],
			events: [ev('2026-10-10T07:00:00Z', 'IPC'), ev('2026-10-13T07:00:00Z', 'EPA'), ev('2026-10-14T07:00:00Z', 'hoy')]
		};
		expect(pastEvents(previous, from).map((e) => e.title)).toEqual(['IPC', 'EPA']);
	});

	it('sin copia anterior, nada', () => {
		expect(pastEvents(undefined, new Date())).toEqual([]);
	});
});
