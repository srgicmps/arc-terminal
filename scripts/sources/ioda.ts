// Caídas de internet por país según IODA (https://ioda.inetintel.cc.gatech.edu), del Georgia Tech:
// vigila la conectividad con varias señales (rutas BGP, sondeo activo «ping-slash24», tráfico al
// telescopio «merit-nt» y tráfico a Google, «gtr») y lanza alertas cuando una cae por debajo de lo
// normal. API pública y sin clave. Términos: uso libre citando a IODA; no publican límite por IP, así
// que se pide cada 30 min. Las horas de la API son segundos Unix.
import type { IodaOutage } from '../../src/lib/types.ts';
import { getJson, list, num, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

export type { IodaOutage };

/** Horas hacia atrás que se miran. */
const HOURS = 12;
/**
 * Caída mínima (en %) para contar. IODA marca «critical» una bajada de rutas BGP del 1 % (umbral
 * «< 0.99»): en países pequeños es ruido (Palau, 57 de 59 rutas). Si no se sabe la caída, cuenta.
 */
const MIN_DROP = 10;

export const iodaUrl = (now = Date.now()) => {
	const until = Math.floor(now / 1000);
	return `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts?from=${until - HOURS * 3600}&until=${until}&entityType=country&limit=2000`;
};

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

/**
 * Agrupa las alertas por país y señal. Un país sale si la última alerta de alguna de sus señales no
 * es «normal» (es decir, la señal no se ha recuperado todavía).
 */
export function parseIoda(body: Raw): IodaOutage[] {
	type Alert = { code: string; name: string; signal: string; time: number; level: string; drop: number | null };
	const alerts: Alert[] = list<Raw>(body?.data).flatMap((a) => {
		const code = String(a?.entity?.code ?? '').toUpperCase();
		const time = num(a?.time);
		const signal = String(a?.datasource ?? '');
		if (!code || time === null || !signal) return [];
		const value = num(a?.value);
		const normal = num(a?.historyValue);
		const drop = value !== null && normal ? Math.round(Math.max(0, 1 - value / normal) * 100) : null;
		return [{ code, name: plain(a?.entity?.name, 80) || code, signal, time, level: String(a?.level ?? '').toLowerCase(), drop }];
	});
	alerts.sort((a, b) => a.time - b.time);

	const countries = new Map<string, { name: string; signals: Map<string, Alert[]> }>();
	for (const a of alerts) {
		const c = countries.get(a.code) ?? { name: a.name, signals: new Map() };
		c.signals.set(a.signal, [...(c.signals.get(a.signal) ?? []), a]);
		countries.set(a.code, c);
	}

	const outages: IodaOutage[] = [];
	for (const [code, c] of countries) {
		// La racha de cada señal: las alertas desde la última vez que estuvo «normal».
		const open = [...c.signals.values()]
			.map((all) => {
				const lastNormal = all.findLastIndex((a) => a.level === 'normal');
				return all.slice(lastNormal + 1);
			})
			.filter((run) => run.length);
		if (!open.length) continue;
		const flat = open.flat();
		const latest = open.map((run) => run[run.length - 1]);
		const drops = latest.map((a) => a.drop).filter((d): d is number => d !== null);
		if (drops.length === latest.length && Math.max(...drops) < MIN_DROP) continue;
		outages.push({
			code,
			name: c.name,
			level: latest.some((a) => a.level === 'critical') ? 'critical' : 'warning',
			signals: open.map((run) => run[0].signal).sort(),
			since: iso(Math.min(...flat.map((a) => a.time))),
			last: iso(Math.max(...flat.map((a) => a.time))),
			drop: drops.length ? Math.max(...drops) : null,
			url: `https://ioda.inetintel.cc.gatech.edu/country/${code}`
		});
	}
	return outages.sort((a, b) =>
		a.level === b.level ? b.signals.length - a.signals.length || (b.drop ?? 0) - (a.drop ?? 0) : a.level === 'critical' ? -1 : 1
	);
}

export const ioda: Source<IodaOutage[]> = {
	name: 'ioda',
	label: 'Caídas de internet por país · IODA (Georgia Tech)',
	maxAgeMinutes: 30,
	// Lo normal es que no haya ningún país caído.
	allowEmpty: true,
	async fetch() {
		const body = await getJson<Raw>(iodaUrl());
		if (!Array.isArray(body?.data)) throw new Error('IODA no devuelve una lista de alertas');
		return parseIoda(body);
	}
};
