/// <reference types="node" />
// Precio de la luz en el mercado mayorista europeo, media diaria de hoy y de mañana por zona de precio.
// Energy-Charts (Fraunhofer ISE), sin clave: https://api.energy-charts.info/price?bzn=DE-LU
// Respuesta: { license_info, unix_seconds: [...], price: [...] (€/MWh, cada 15 min), unit }.
// La licencia cambia por zona: las de SMARD (Bundesnetzagentur) son CC BY 4.0, pero otras (España, de
// EPEX SPOT) son «solo para uso privado e interno». Como la web es pública, solo se guardan las zonas que
// llegan con CC BY; España sale de REE (fuente «power»), que sí se puede reutilizar.
// Cita: «Energy-Charts / SMARD (Bundesnetzagentur)».
import type { EuPowerData, EuPowerZone, PowerData } from '../../src/lib/types.ts';
import { getJson, madridDate, type Source } from '../lib.ts';

/**
 * Zonas que se piden: código de Energy-Charts, país y nombre en español. Solo las que llegan con licencia
 * CC BY: Portugal, Suecia (SE3) y Finlandia vienen «solo para uso privado» y no se piden.
 */
export const ZONES: { zone: string; country: string; name: string }[] = [
	{ zone: 'FR', country: 'FR', name: 'Francia' },
	{ zone: 'DE-LU', country: 'DE', name: 'Alemania y Luxemburgo' },
	{ zone: 'IT-North', country: 'IT', name: 'Italia (norte)' },
	{ zone: 'NL', country: 'NL', name: 'Países Bajos' },
	{ zone: 'BE', country: 'BE', name: 'Bélgica' },
	{ zone: 'AT', country: 'AT', name: 'Austria' },
	{ zone: 'CH', country: 'CH', name: 'Suiza' },
	{ zone: 'PL', country: 'PL', name: 'Polonia' },
	{ zone: 'DK1', country: 'DK', name: 'Dinamarca (oeste)' },
	{ zone: 'NO2', country: 'NO', name: 'Noruega (sur)' }
];

const API = 'https://api.energy-charts.info/price';
export const ATTRIBUTION = 'Energy-Charts / SMARD (Bundesnetzagentur)';

/**
 * Pausa entre peticiones: la API responde 429 si se le piden más de 4 o 5 seguidas. Con 1,5 s aún saltaba
 * y los reintentos alargaban la descarga a 94 s; con 3 s son unos 40 s sin reintentos.
 */
export const GAP_MS = 3_000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' });

/**
 * Media de cada día de Madrid a partir de precios con instante. Un día solo cuenta si tiene precio en al
 * menos 23 horas distintas (el del cambio de hora de marzo tiene 23): así no sale una media de medio día.
 */
export function dailyMeans(points: { t: number; v: number }[]): Map<string, number> {
	const byDay = new Map<string, { sum: number; n: number; hours: Set<string> }>();
	for (const { t, v } of points) {
		if (!Number.isFinite(v)) continue;
		const d = new Date(t);
		const day = fmtDay.format(d);
		const g = byDay.get(day) ?? { sum: 0, n: 0, hours: new Set<string>() };
		g.sum += v;
		g.n++;
		g.hours.add(fmtHour.format(d));
		byDay.set(day, g);
	}
	const out = new Map<string, number>();
	for (const [day, g] of byDay) if (g.hours.size >= 23) out.set(day, Math.round((g.sum / g.n) * 100) / 100);
	return out;
}

interface Raw {
	license_info?: string;
	unix_seconds?: number[];
	price?: (number | null)[];
}

export const energycharts: Source<EuPowerData> = {
	name: 'energycharts',
	label: 'Precio de la luz en Europa · Energy-Charts / SMARD',
	// Los precios de mañana salen una vez al día (hacia las 13:00): cada 3 horas sobra.
	maxAgeMinutes: 180,
	// Diez peticiones con pausa entre ellas, y reintentos si salta el 429 (en la Action llegó a 149 s).
	deadlineMs: 180_000,
	// Va en la segunda fase para tener el mayorista de España de REE (fuente «power»).
	after: true,
	async fetch(_previous, ctx) {
		const dashed = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
		const today = dashed(madridDate(0));
		const tomorrow = dashed(madridDate(1));
		const zones: EuPowerZone[] = [];
		for (const [i, z] of ZONES.entries()) {
			// En los tests (vitest) sin pausa.
			if (i && !process.env.VITEST) await wait(GAP_MS);
			try {
				const body = await getJson<Raw>(`${API}?bzn=${encodeURIComponent(z.zone)}&start=${today}&end=${tomorrow}`);
				// Solo las zonas que se pueden publicar.
				if (!/CC BY/i.test(body.license_info ?? '')) {
					console.log(`  energycharts · ${z.zone}: sin licencia CC BY, no se guarda`);
					continue;
				}
				const ts = body.unix_seconds ?? [];
				const means = dailyMeans(ts.map((t, k) => ({ t: t * 1000, v: Number(body.price?.[k] ?? NaN) })));
				const zone = { ...z, today: means.get(today) ?? null, tomorrow: means.get(tomorrow) ?? null, source: ATTRIBUTION };
				if (zone.today !== null || zone.tomorrow !== null) zones.push(zone);
			} catch (error) {
				// Una zona que falla no tumba las demás.
				console.log(`  energycharts · ${z.zone}: ${(error as Error).message}`);
			}
		}

		// España: el mayorista de REE, que ya trae la fuente «power» (instantes con zona horaria de Madrid).
		const spot = ctx?.get<PowerData>('power')?.spot ?? [];
		const es = dailyMeans(spot.map((p) => ({ t: Date.parse(p.t), v: p.v })));
		if (es.size) {
			zones.unshift({ zone: 'ES', country: 'ES', name: 'España', today: es.get(today) ?? null, tomorrow: es.get(tomorrow) ?? null, source: 'REE' });
		}

		if (!zones.some((z) => z.source === ATTRIBUTION)) throw new Error('Energy-Charts no devuelve ninguna zona con licencia CC BY');
		return { date: today, zones };
	}
};
