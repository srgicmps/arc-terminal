// FUEL, «Mi gasolinera» (F3): una estación favorita por usuario, con lo que costaba cada día que abriste FUEL.
// Se guarda en localStorage (clave `arc-fuel-fav`, un «dato» de prefs.ts), así que viaja con los ajustes de tu
// cuenta. La API del Ministerio solo da el precio de hoy: el historial de la estación lo va apuntando el navegador.
import type { FuelKey, FuelPrices } from './fuel.ts';

export const MY_FUEL_KEY = 'arc-fuel-fav';
/** Días que se guardan del historial (unos 6 KB). */
export const MY_FUEL_DAYS = 120;

export interface MyStation {
	id: string;
	/** Zona de FUEL donde está: «menorca» o el id de la provincia. */
	zone: string;
	name: string;
	town: string;
	/** Un apunte por día (de Madrid), del más antiguo al más reciente. */
	log: { d: string; p: FuelPrices }[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const price = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Lee lo guardado; null si no hay o no vale. */
export function parseMyStation(raw: string | null): MyStation | null {
	try {
		const v: unknown = JSON.parse(raw ?? 'null');
		if (!isObj(v) || typeof v.id !== 'string' || typeof v.zone !== 'string') return null;
		const log = Array.isArray(v.log)
			? v.log.flatMap((e) =>
					isObj(e) && typeof e.d === 'string' && isObj(e.p)
						? [{ d: e.d, p: { g95: price(e.p.g95), diesel: price(e.p.diesel), g98: price(e.p.g98), glp: price(e.p.glp) } }]
						: []
				)
			: [];
		return { id: v.id, zone: v.zone, name: String(v.name ?? ''), town: String(v.town ?? ''), log };
	} catch {
		return null;
	}
}

/** Apunta el precio de hoy (sustituye el de hoy si ya estaba) y deja solo los últimos `MY_FUEL_DAYS` días. */
export function logPrices(st: MyStation, day: string, prices: FuelPrices): MyStation {
	const log = [...st.log.filter((e) => e.d !== day), { d: day, p: prices }].sort((a, b) => a.d.localeCompare(b.d));
	return { ...st, log: log.slice(-MY_FUEL_DAYS) };
}

export interface MyStationStats {
	price: number;
	/** Media de la zona. */
	avg: number;
	/** Puesto por precio en su zona (1 = la más barata) y cuántas venden ese combustible. */
	rank: number;
	of: number;
	/** Lo que ahorras (positivo) o pagas de más (negativo) en un depósito de `litres` frente a la media. */
	save: number;
	/** Cambio desde el apunte anterior (otro día), en €/L, o null. */
	change: number | null;
}

/** Su precio de hoy frente a las demás de su zona, con el combustible elegido. null si no lo vende. */
export function myStationStats(
	st: MyStation,
	stations: { id: string; prices: FuelPrices }[],
	fuel: FuelKey,
	today: string,
	litres = 50
): MyStationStats | null {
	const prices = stations.flatMap((s) => (s.prices[fuel] == null ? [] : [{ id: s.id, v: s.prices[fuel]! }]));
	const mine = prices.find((p) => p.id === st.id);
	if (!mine) return null;
	const avg = prices.reduce((a, p) => a + p.v, 0) / prices.length;
	const before = [...st.log].reverse().find((e) => e.d < today && e.p[fuel] != null)?.p[fuel] ?? null;
	return {
		price: mine.v,
		avg,
		rank: 1 + prices.filter((p) => p.v < mine.v).length,
		of: prices.length,
		save: (avg - mine.v) * litres,
		change: before === null ? null : mine.v - before
	};
}
