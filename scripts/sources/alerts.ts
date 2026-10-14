// Avisos meteorológicos (amarillo, naranja, rojo) en Menorca. Salen del feed Atom de MeteoAlarm para España,
// que republica los avisos CAP de AEMET sin clave. MeteoAlarm pide citar la fuente («EUMETNET-MeteoAlarm»
// y el servicio nacional, AEMET) y recuerda que el aviso oficial es el del servicio nacional.
import { XMLParser } from 'fast-xml-parser';
import type { AlertColor, AlertsData, WxAlert } from '../../src/lib/weather.ts';
import { getText, list, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

export const ALERTS_URL = 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-spain';

const ZONE = /menorca/i;

const xml = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@',
	removeNSPrefix: true,
	parseTagValue: false,
	textNodeName: '#text'
});

const text = (v: unknown): string => plain(typeof v === 'object' && v !== null ? (v as Raw)['#text'] : v);

// CAP: Moderate = amarillo, Severe = naranja, Extreme = rojo. Minor (verde) no es un aviso.
const BY_SEVERITY: Record<string, AlertColor> = { moderate: 'yellow', severe: 'orange', extreme: 'red' };

function colorOf(severity: string, title: string): AlertColor | null {
	const s = BY_SEVERITY[severity.toLowerCase()];
	if (s) return s;
	if (/\b(red|rojo)\b/i.test(title)) return 'red';
	if (/\b(orange|naranja)\b/i.test(title)) return 'orange';
	if (/\b(yellow|amarillo)\b/i.test(title)) return 'yellow';
	return null;
}

// Fenómenos en español a partir del texto del aviso (viene en español o en inglés según el feed).
const HAZARDS: [RegExp, string][] = [
	[/thunder|tormenta/i, 'Tormentas'],
	[/coast|costero|oleaje|mar\b/i, 'Costeros'],
	[/rain|flood|lluvia|precipitaci|inundaci/i, 'Lluvias'],
	[/snow|ice|nieve|nevada|hielo/i, 'Nieve'],
	[/high.?temp|heat|calor|m[aá]xima/i, 'Calor'],
	[/low.?temp|cold|fr[ií]o|m[ií]nima/i, 'Frío'],
	[/fog|niebla/i, 'Nieblas'],
	[/fire|incendio/i, 'Incendios'],
	[/dust|polvo/i, 'Polvo en suspensión'],
	[/wind|viento/i, 'Viento'],
	[/avalanch|alud/i, 'Aludes']
];

function hazardOf(event: string, title: string): string {
	for (const [re, name] of HAZARDS) if (re.test(event) || re.test(title)) return name;
	return event || title;
}

const time = (v: unknown): string => {
	const t = Date.parse(text(v));
	return Number.isFinite(t) ? new Date(t).toISOString() : '';
};

/** Avisos en vigor o próximos para Menorca. `now` en milisegundos, para poder probarlo. */
export function parseAlerts(body: string, now = Date.now()): AlertsData {
	const doc = xml.parse(body) as Raw;
	if (!doc?.feed) throw new Error('no se entiende el formato de MeteoAlarm');

	const seen = new Set<string>();
	const alerts: WxAlert[] = [];
	for (const e of list<Raw>(doc.feed.entry)) {
		const area = text(e.areaDesc);
		if (!ZONE.test(area)) continue;
		if (/^(cancel|ack|error)$/i.test(text(e.message_type))) continue;
		if (/^(test|exercise|draft)$/i.test(text(e.status))) continue;

		const title = text(e.title);
		const level = colorOf(text(e.severity), title);
		if (!level) continue;

		const expires = time(e.expires);
		if (expires && Date.parse(expires) < now) continue;

		const onset = time(e.onset) || time(e.effective) || time(e.sent);
		const hazard = hazardOf(text(e.event), title);
		const key = `${level}|${hazard}|${area}|${onset}`;
		if (seen.has(key)) continue;
		seen.add(key);

		// Cada entrada trae la página de la zona en MeteoAlarm (?geocode=…) y el XML del aviso (CAP, /api/):
		// nos quedamos con la página; si no la hay, la de avisos de AEMET.
		const link = list<Raw>(e.link).find((l) => l?.['@href'] && !/\/api\//.test(l['@href']));
		alerts.push({
			id: text(e.identifier) || text(e.id) || key,
			level,
			hazard,
			area,
			onset,
			expires,
			url: String(link?.['@href'] ?? 'https://www.aemet.es/es/eltiempo/prediccion/avisos')
		});
	}

	const rank: Record<AlertColor, number> = { red: 0, orange: 1, yellow: 2 };
	alerts.sort((a, b) => rank[a.level] - rank[b.level] || a.onset.localeCompare(b.onset));
	return { zone: 'Menorca', alerts };
}

export const alerts: Source<AlertsData> = {
	name: 'alerts',
	label: 'Avisos meteorológicos en Menorca · MeteoAlarm (EUMETNET) con datos de AEMET',
	maxAgeMinutes: 25,
	// Sin avisos en vigor, la lista viene vacía: es lo normal casi todos los días.
	allowEmpty: true,
	async fetch() {
		return parseAlerts(await getText(ALERTS_URL));
	}
};
