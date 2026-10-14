// Red Eléctrica: de dónde sale la electricidad (mix de generación por tecnologías), en toda España y en
// Baleares. https://www.ree.es/es/apidatos · Sin clave · Reutilización libre citando la fuente.
import type { MixGroup, PowerMix, PowerMixData } from '../../src/lib/types.ts';
import { getJson, list, madridDate, settle, type Source } from '../lib.ts';

type Raw = Record<string, any>;

const API = 'https://apidatos.ree.es/es/datos/generacion';

// Sistemas eléctricos: geo_limit y geo_ids de la API de REE.
const SYSTEMS = [
	{ id: 'nacional', label: 'España', geo: 8741 },
	{ id: 'baleares', label: 'Baleares', geo: 8743 }
];

// Cada tecnología de REE va a uno de los grupos que se dibujan. Lo que no encaja va a «Otras».
const GROUPS: { key: MixGroup['key']; label: string; match: RegExp }[] = [
	{ key: 'wind', label: 'Eólica', match: /^e[óo]lica/i },
	{ key: 'solar', label: 'Solar', match: /^solar/i },
	{ key: 'hydro', label: 'Hidráulica', match: /^hidr[áa]ulica|^hidroe[óo]lica/i },
	{ key: 'nuclear', label: 'Nuclear', match: /^nuclear/i },
	{ key: 'gas', label: 'Gas', match: /ciclo combinado|turbina de gas/i }
];

const day = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

/** Pide un dato diario de REE para los dos últimos días (el de hoy puede no estar todavía). */
async function daily(path: string, geo: { id: string; geo: number }) {
	const params = new URLSearchParams({
		start_date: `${day(madridDate(-1))}T00:00`,
		end_date: `${day(madridDate(0))}T23:59`,
		time_trunc: 'day',
		geo_trunc: 'electric_system',
		geo_limit: geo.id,
		geo_ids: String(geo.geo)
	});
	const body = await getJson<{ included?: Raw[] }>(`${API}/${path}?${params}`);
	return list<Raw>(body.included);
}

/** Último valor de cada serie para la fecha indicada. */
const valueOn = (item: Raw, date: string) =>
	Number(list<Raw>(item.attributes?.values).find((v) => String(v.datetime).startsWith(date))?.value);

async function fetchSystem(system: (typeof SYSTEMS)[number]): Promise<PowerMix | null> {
	const items = (await daily('estructura-generacion', system)).filter((i) => !i.attributes?.composite);
	// El último día que tenga datos: hoy si REE ya lo ha publicado; si no, ayer.
	const dates = items.flatMap((i) => list<Raw>(i.attributes?.values).map((v) => String(v.datetime).slice(0, 10)));
	const date = dates.sort().at(-1);
	if (!date) return null;

	const techs = items
		.map((i) => ({
			label: String(i.attributes?.title ?? i.type),
			renewable: /^renovable/i.test(String(i.attributes?.type ?? '')),
			mwh: valueOn(i, date)
		}))
		// Algunas tecnologías consumen (bombeo, enlaces que exportan): solo cuenta lo que se genera.
		.filter((t) => Number.isFinite(t.mwh) && t.mwh > 0);
	const total = techs.reduce((a, t) => a + t.mwh, 0);
	if (!total) return null;

	const groups: MixGroup[] = [...GROUPS, { key: 'other' as const, label: 'Otras', match: /$^/ }].map((g) => {
		const inGroup = techs.filter((t) =>
			g.key === 'other' ? !GROUPS.some((o) => o.match.test(t.label)) : g.match.test(t.label)
		);
		const mwh = inGroup.reduce((a, t) => a + t.mwh, 0);
		return { key: g.key, label: g.label, mwh: Math.round(mwh), share: mwh / total, techs: inGroup.map((t) => t.label) };
	});
	const renewable = techs.filter((t) => t.renewable).reduce((a, t) => a + t.mwh, 0) / total;

	// Emisiones de CO₂ del día (toneladas); si REE no las da, se queda sin dato.
	const co2Items = await daily('no-renovables-detalle-emisiones-CO2', system).catch(() => []);
	const co2Total = co2Items.find((i) => /total/i.test(String(i.attributes?.title ?? i.type)));
	const co2 = co2Total ? valueOn(co2Total, date) : NaN;

	return {
		id: system.id,
		label: system.label,
		date,
		mwh: Math.round(total),
		renewable,
		co2: Number.isFinite(co2) ? Math.round(co2) : null,
		groups
	};
}

export const powerMix: Source<PowerMixData> = {
	name: 'power-mix',
	label: 'Mix de generación eléctrica y % renovable · Red Eléctrica',
	maxAgeMinutes: 55,
	async fetch() {
		const systems = await settle('power-mix', SYSTEMS, (s) => s.label, fetchSystem);
		if (!systems.length) throw new Error('REE no da el mix de generación');
		return { systems };
	}
};
