// Avisos de casa (F16) y la víspera de los resultados (F12), por usuario: cada uno los enciende en AVISOS
// (`home` de src/lib/alertconfig.ts) y los recibe por su tema (users.ts). Una vez al día cada uno.
// - Luz: las 3 mejores franjas de 2 h de mañana (PVPC), desde que se publica, hacia las 20:30.
// - Polen: los que llegan a moderado o alto mañana en su sitio (el de «Tu mañana»; CAMS, solo Europa).
// - Resultados: sus valores (los de AVISOS) que presentan mañana.
// Lógica pura: el polen de su sitio lo pide users.ts (Open-Meteo, sin clave) y llega ya leído.
import type { AlertConfig } from '../../src/lib/alertconfig.ts';
import { cheapWindows, hourLabel, hourly } from '../../src/lib/power.ts';
import { AIR_API, airParams, parseAir } from '../../src/lib/openmeteo.ts';
import { pollenHigh, type AirData, type AirDay } from '../../src/lib/weather.ts';
import { addDays, madrid, num, SITE, type Draft, type Inputs, type Rule, type RuleContext } from './rules.ts';

/** Desde qué hora de Madrid sale cada uno (hasta medianoche). */
export const HOME_FROM = { luz: '20:45', pollen: '19:00', results: '18:00' };

const list = <T>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);
const after = (now: number, hm: string) => madrid(now).hm >= hm;

export function luzHomeRule(d: Inputs, { now, today }: RuleContext): Draft[] {
	if (!after(now, HOME_FROM.luz)) return [];
	const tomorrow = addDays(today, 1);
	const best = cheapWindows(hourly(list(d.power?.pvpc)), tomorrow, 2, 3);
	if (!best.length) return [];
	return [
		{
			id: `casa:luz:${tomorrow}`,
			title: 'Horas baratas de mañana',
			body: `${best.map((w) => `${hourLabel(w.first)}–${hourLabel(w.after)} · ${num(w.avg, 3)} €/kWh`).join('\n')}\nPara la lavadora, el lavavajillas o el coche (PVPC, 2 h seguidas).`,
			tags: 'bulb',
			click: `${SITE}/luz`,
			time: now
		}
	];
}

export function pollenHomeRule(place: string, day: AirDay | null): Rule['run'] {
	return (_d, { now, today }) => {
		if (!after(now, HOME_FROM.pollen) || !day || day.date !== addDays(today, 1)) return [];
		const high = pollenHigh(day);
		if (!high.length) return [];
		return [
			{
				id: `casa:polen:${day.date}`,
				title: `Polen mañana en ${place}`,
				body: `${high.map((p) => `${p.name}: ${p.level.label.toLowerCase()} (${num(p.value, 0)} granos/m³)`).join(' · ')}.`,
				tags: 'blossom',
				click: `${SITE}/wx`,
				time: now
			}
		];
	};
}

export function resultsEveRule(mis: string[]): Rule['run'] {
	const hours: Record<string, string> = { bmo: 'antes de abrir', amc: 'al cierre', dmh: 'en sesión' };
	return (d, { now, today }) => {
		if (!after(now, HOME_FROM.results) || !mis.length) return [];
		const tomorrow = addDays(today, 1);
		const mine = new Set(mis);
		const due = list(d.finnhub?.earnings).filter((e) => e?.date === tomorrow && mine.has(e.symbol));
		if (!due.length) return [];
		return [
			{
				id: `casa:resultados:${tomorrow}`,
				title: due.length === 1 ? `Mañana presenta resultados ${due[0].symbol}` : `Mañana presentan resultados ${due.length} de tus valores`,
				body: `${due.map((e) => `${e.symbol}${hours[e.hour] ? ` (${hours[e.hour]})` : ''}`).join(', ')}.`,
				tags: 'moneybag',
				click: `${SITE}/cal`,
				time: now
			}
		];
	};
}

/** Las reglas de casa que ha encendido. `pollen`: el día de mañana en su sitio, si se ha podido leer. */
export function homeRules(config: AlertConfig, pollen: AirDay | null = null): Rule[] {
	const h = config.home;
	return [
		...(h.luz ? [{ type: 'casa', level: 3 as const, run: luzHomeRule }] : []),
		...(h.pollen && config.brief.place ? [{ type: 'casa', level: 3 as const, run: pollenHomeRule(config.brief.place.name, pollen) }] : []),
		...(h.results ? [{ type: 'casa', level: 3 as const, run: resultsEveRule(config.mis) }] : [])
	];
}

/** Aire y polen de un sitio (Open-Meteo, CAMS, sin clave). null si no responde. */
export async function airAt(lat: number, lon: number, fetcher: typeof fetch = fetch): Promise<AirData | null> {
	try {
		const res = await fetcher(`${AIR_API}?${airParams({ lat, lon })}`, { signal: AbortSignal.timeout(15_000) });
		return res.ok ? parseAir(await res.json(), '') : null;
	} catch {
		return null;
	}
}
