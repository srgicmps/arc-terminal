// Avisos meteorológicos de Europa por país (MeteoAlarm, la red de los servicios meteorológicos europeos,
// EUMETNET): el feed Atom de cada país, sin clave. De cada uno se guarda el recuento de avisos en vigor por
// color y las zonas (provincias, departamentos…) con aviso naranja o rojo. MeteoAlarm pide citar
// «EUMETNET-MeteoAlarm» y el servicio nacional; el aviso oficial es el de cada servicio. Cada 30 min.
// 'alerts' (Menorca, para el aviso ntfy) va aparte y no cambia.
import type { AlertColor, AlertsEuData, EuAlertCountry, WxAlert } from '../../src/lib/weather.ts';
import { getText, settle, type Source } from '../lib.ts';
import { alertEntries } from './alerts.ts';

/** País (ISO) y nombre del feed de MeteoAlarm. */
export const EU_FEEDS: [string, string][] = [
	['ES', 'spain'],
	['PT', 'portugal'],
	['FR', 'france'],
	['IT', 'italy'],
	['DE', 'germany'],
	['AT', 'austria'],
	['CH', 'switzerland'],
	['NL', 'netherlands'],
	['BE', 'belgium'],
	['GR', 'greece']
];

export const feedUrl = (slug: string) => `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${slug}`;

/** Zonas en naranja o rojo que se guardan por país, como mucho. */
const MAX_ZONES = 12;

/** Resume los avisos de un país: recuento por color y una fila por zona en naranja o rojo. */
export function summarize(code: string, alerts: WxAlert[]): EuAlertCountry {
	const counts: Record<AlertColor, number> = { red: 0, orange: 0, yellow: 0 };
	const zones = new Map<string, EuAlertCountry['zones'][number]>();
	// Llegan del más grave al más leve: la primera vez que sale una zona fija su color.
	for (const a of alerts) {
		counts[a.level]++;
		if (a.level === 'yellow') continue;
		const z = zones.get(a.area) ?? { area: a.area, level: a.level, hazards: [], url: a.url };
		if (!z.hazards.includes(a.hazard)) z.hazards.push(a.hazard);
		zones.set(a.area, z);
	}
	return { code, counts, zones: [...zones.values()].slice(0, MAX_ZONES) };
}

export const alertsEu: Source<AlertsEuData> = {
	name: 'alerts-eu',
	label: 'Avisos meteorológicos en Europa por país · EUMETNET-MeteoAlarm y los servicios nacionales',
	maxAgeMinutes: 30,
	async fetch() {
		const now = Date.now();
		const countries = await settle(
			'alerts-eu',
			EU_FEEDS,
			([code]) => code,
			async ([code, slug]) => summarize(code, alertEntries(await getText(feedUrl(slug)), now))
		);
		if (!countries.length) throw new Error('MeteoAlarm no ha dado ningún país');
		return { countries };
	}
};
