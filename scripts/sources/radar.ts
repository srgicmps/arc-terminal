// Cloudflare Radar (https://radar.cloudflare.com): cortes de internet verificados por su equipo (con causa:
// corte de cable, apagón, orden del gobierno…) y los países más atacados por DDoS en 7 días, en capa 3
// (red) y capa 7 (HTTP). Complementa a IODA (ioda.ts), que detecta caídas automáticamente y antes.
//
// Necesita el token CLOUDFLARE_RADAR_TOKEN (gratuito, con permiso de lectura de Radar); sin él, la fuente
// se salta. Va en la cabecera Authorization, nunca en la URL, así que no sale en los registros. Datos
// con licencia CC BY-NC 4.0: uso no comercial citando a Cloudflare Radar.
import type { RadarData, RadarOutage, RadarTarget } from '../../src/lib/types.ts';
import { getJson, list, num, plain, type Source } from '../lib.ts';

export type { RadarData };

type Raw = Record<string, any>;

const API = 'https://api.cloudflare.com/client/v4/radar';
const ENV = 'CLOUDFLARE_RADAR_TOKEN';
const TOP = 10;

export const radarUrls = {
	outages: `${API}/annotations/outages?dateRange=7d&limit=50&format=json`,
	l3: `${API}/attacks/layer3/top/locations/target?dateRange=7d&limit=${TOP}&format=json`,
	l7: `${API}/attacks/layer7/top/locations/target?dateRange=7d&limit=${TOP}&format=json`
};

/** «CABLE_CUT» o «cable_cut» → «cable cut», para buscar en las tablas. */
const key = (v: unknown) => String(v ?? '').toLowerCase().replace(/[_-]+/g, ' ').trim();

const CAUSES: Record<string, string> = {
	'cable cut': 'corte de cable',
	'power outage': 'apagón eléctrico',
	'government directed': 'orden del gobierno',
	'military action': 'acción militar',
	weather: 'meteorología',
	'natural disaster': 'catástrofe natural',
	earthquake: 'terremoto',
	fire: 'incendio',
	'technical problem': 'fallo técnico',
	maintenance: 'mantenimiento',
	cyberattack: 'ciberataque',
	'cyber attack': 'ciberataque',
	unknown: 'causa desconocida'
};

const SCOPES: Record<string, string> = {
	nationwide: 'nacional',
	regional: 'regional',
	network: 'un operador',
	platform: 'una plataforma'
};

const words = (v: unknown, table: Record<string, string>) => table[key(v)] ?? (key(v) || '');

export function parseOutages(body: Raw): RadarOutage[] {
	return list<Raw>(body?.result?.annotations)
		.flatMap((a): RadarOutage[] => {
			const start = String(a?.startDate ?? '');
			if (!a?.id || Number.isNaN(Date.parse(start))) return [];
			const codes = list<unknown>(a?.locations)
				.map((c) => String(c ?? '').toUpperCase())
				.filter((c) => /^[A-Z]{2}$/.test(c));
			const end = a?.endDate && !Number.isNaN(Date.parse(a.endDate)) ? String(a.endDate) : null;
			const url = /^https:\/\//.test(String(a?.linkedUrl ?? '')) ? String(a.linkedUrl) : null;
			return [
				{
					id: String(a.id),
					codes,
					cause: words(a?.outage?.outageCause, CAUSES) || 'causa desconocida',
					scope: words(a?.outage?.outageType, SCOPES),
					networks: list<Raw>(a?.asnsDetails)
						.map((n) => plain(n?.name, 60))
						.filter(Boolean)
						.slice(0, 3),
					start,
					end,
					url
				}
			];
		})
		.sort((a, b) => Number(a.end !== null) - Number(b.end !== null) || b.start.localeCompare(a.start));
}

/** Ranking de destinos: acepta los nombres de campo de capa 3 y de capa 7. */
export function parseTargets(body: Raw): RadarTarget[] {
	return list<Raw>(body?.result?.top_0)
		.flatMap((t): RadarTarget[] => {
			const code = String(t?.targetCountryAlpha2 ?? t?.clientCountryAlpha2 ?? '').toUpperCase();
			const pct = num(t?.value);
			if (!/^[A-Z]{2}$/.test(code) || pct === null) return [];
			return [{ code, name: plain(t?.targetCountryName ?? t?.clientCountryName, 60) || code, pct }];
		})
		.sort((a, b) => b.pct - a.pct)
		.slice(0, TOP);
}

export const radar: Source<RadarData> = {
	name: 'radar',
	label: 'Cortes de internet y ataques DDoS · Cloudflare Radar',
	maxAgeMinutes: 60,
	requires: ENV,
	async fetch() {
		const init = { headers: { Authorization: `Bearer ${process.env[ENV]}` } };
		const [outages, l3, l7] = await Promise.all([
			getJson<Raw>(radarUrls.outages, init),
			getJson<Raw>(radarUrls.l3, init),
			getJson<Raw>(radarUrls.l7, init)
		]);
		for (const body of [outages, l3, l7])
			if (body?.success === false) throw new Error(`Cloudflare Radar responde con error: ${plain(body?.errors?.[0]?.message, 120)}`);
		const data = { outages: parseOutages(outages), l3: parseTargets(l3), l7: parseTargets(l7) };
		if (!data.l3.length && !data.l7.length) throw new Error('Cloudflare Radar no devuelve el ranking de ataques');
		return data;
	}
};
