// Avisos de Europa por país (MeteoAlarm): recuento por color y zonas en naranja o rojo.
import { describe, expect, it } from 'vitest';
import { alertEntries } from '../sources/alerts.ts';
import { feedUrl, summarize } from '../sources/alerts-eu.ts';

const entry = (area: string, severity: string, event: string, id: string) =>
	`<entry><title>Warning for ${area}</title><cap:areaDesc>${area}</cap:areaDesc><cap:severity>${severity}</cap:severity>` +
	`<cap:event>${event}</cap:event><cap:identifier>${id}</cap:identifier><cap:status>Actual</cap:status>` +
	`<cap:onset>2026-10-14T10:00:00+00:00</cap:onset><cap:expires>2026-10-15T21:59:59+00:00</cap:expires>` +
	`<link href="https://meteoalarm.org/es/live/region/${id}"/></entry>`;
const feed = (...entries: string[]) =>
	`<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom" ` +
	`xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2"><title>MeteoAlarm France</title>${entries.join('')}</feed>`;
const now = Date.parse('2026-10-14T12:00:00Z');

describe('alerts-eu', () => {
	it('cuenta por color y junta por zona las naranjas y rojas, la más grave primero', () => {
		const alerts = alertEntries(
			feed(
				entry('Var', 'Severe', 'Rain', 'a'),
				entry('Var', 'Extreme', 'Flooding', 'b'),
				entry('Var', 'Severe', 'Thunderstorm', 'c'),
				entry('Gard', 'Severe', 'Wind', 'd'),
				entry('Paris', 'Moderate', 'Wind', 'e')
			),
			now
		);
		expect(summarize('FR', alerts)).toEqual({
			code: 'FR',
			counts: { red: 1, orange: 3, yellow: 1 },
			zones: [
				{ area: 'Var', level: 'red', hazards: ['Lluvias', 'Tormentas'], url: 'https://meteoalarm.org/es/live/region/b' },
				{ area: 'Gard', level: 'orange', hazards: ['Viento'], url: 'https://meteoalarm.org/es/live/region/d' }
			]
		});
	});

	it('sin avisos, todo a cero', () => {
		expect(summarize('PT', alertEntries(feed(), now))).toEqual({ code: 'PT', counts: { red: 0, orange: 0, yellow: 0 }, zones: [] });
	});

	it('la URL del feed lleva el nombre del país', () => {
		expect(feedUrl('france')).toBe('https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-france');
	});
});
