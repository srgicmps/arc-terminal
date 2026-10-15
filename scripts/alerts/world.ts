// Avisos del mundo: catástrofes (GDACS), apagón en España (REE), caídas de internet (IODA), servicios
// caídos (páginas de estado) y brotes (OMS). Van aparte de rules.ts para no chocar con él: rules.ts solo
// añade WORLD_RULES a RULES, WORLD_FILES a FILES y WorldInputs a Inputs.
//
// Ojo: este archivo no importa valores de rules.ts (solo tipos). rules.ts sí importa de aquí, y un
// import circular de valores fallaría según cuál se cargue primero.
//
// Los JSON pueden durar más que los 7 días de historial de notify-log (una sequía naranja, un evento
// abierto de AWS desde hace meses), así que estas reglas apuntan lo ya avisado en `log.last` mientras el
// hecho siga en los datos, y lo borran cuando desaparece.
import { madridTime } from '../issues.ts';
import type { GdacsEvent } from '../sources/gdacs.ts';
import type { IodaOutage } from '../sources/ioda.ts';
import type { DemandData } from '../sources/ree-demand.ts';
import type { ServiceStatus } from '../sources/statuspage.ts';
import type { OutbreakNews } from '../sources/who.ts';
import type { Draft, NotifyLog, Rule, RuleContext } from './rules.ts';

import { SITE } from '../site.ts';
const MIN = 60_000;
const HOUR = 60 * MIN;

// ---------- Umbrales ----------

/** G20 (sin la UE ni la Unión Africana como bloque) y los 27 de la UE, en códigos ISO. */
const BIG = [
	'AR', 'AU', 'BR', 'CA', 'CN', 'DE', 'FR', 'GB', 'IN', 'ID', 'IT', 'JP', 'KR', 'MX', 'RU', 'SA', 'ZA', 'TR', 'US',
	'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'GR', 'HU', 'IE', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT',
	'RO', 'SK', 'SI', 'ES', 'SE'
];

export const WORLD = {
	/** GDACS: niveles que avisan. */
	gdacs: { levels: ['red'] as string[] },
	/**
	 * Apagón: la demanda real ha caído al menos `drop` (en tanto por uno) en `minutes` minutos o menos y,
	 * además, va al menos `gap` % por debajo de la prevista. Con una caída de `hardDrop` o más basta con
	 * eso: el 28/04/2025 la real pasó de 26.968 a 1.785 MW en 5 min (−93 %), y REE rehízo luego la prevista
	 * para que coincidiera con la real, así que no conviene depender solo de ella. En un día normal la real
	 * no baja más de un 3 % en 30 min. Un dato de más de `maxAgeMinutes` no cuenta (copia vieja). Tras un
	 * aviso, `waitHours` sin otro.
	 */
	blackout: { gap: 20, drop: 0.15, hardDrop: 0.3, minutes: 30, maxAgeMinutes: 60, waitHours: 6 },
	/** IODA: países grandes con nivel crítico; el de casa, también con aviso. */
	ioda: { countries: BIG, home: 'ES' },
	/** Páginas de estado: indicadores que avisan. */
	status: { indicators: ['major', 'critical'] as string[] },
	/** Horas sin ver un hecho (un evento de GDACS, un país caído…) hasta olvidar que ya se avisó. */
	forgetHours: 48
};

// ---------- Datos ----------

/** Lo que leen estas reglas (static/data/*.json); cualquiera puede faltar. */
export interface WorldInputs {
	gdacs?: GdacsEvent[];
	reeDemand?: DemandData;
	ioda?: IodaOutage[];
	statuspage?: ServiceStatus[];
	who?: OutbreakNews[];
}

export const WORLD_FILES: Record<keyof WorldInputs, string> = {
	gdacs: 'gdacs',
	reeDemand: 'ree-demand',
	ioda: 'ioda',
	statuspage: 'statuspage',
	who: 'who-don'
};

const list = <T>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);

const pct = (v: number) => `${Math.round(v).toLocaleString('es-ES')} %`;

const fmtMadrid = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Madrid',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/** «2026-10-14» y «12:35» en Madrid. */
function madrid(ms: number): { date: string; hm: string } {
	const p = Object.fromEntries(fmtMadrid.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
	return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}

/** Hora de la última vez que se vio un hecho (las marcas antiguas, «1», cuentan como muy viejas). */
const seenAt = (v: string | undefined) => (v && /^\d{4}-\d\d-\d\dT/.test(v) ? Date.parse(v) : -Infinity);

/**
 * Una sola vez por clave mientras siga en los datos: quita las que ya están en `log.last` y les apunta la
 * hora en que se han visto. Las que ya no salen se olvidan tras `WORLD.forgetHours` sin verlas (si vuelven
 * a aparecer después, es otro hecho). El margen evita repetir un aviso si una fuente da una pasada vacía
 * por error (GDACS admite listas vacías). Devuelve las que faltan por avisar.
 */
function once<T>(prefix: string, items: { key: string; item: T }[], { now, log, update }: RuleContext): { key: string; item: T }[] {
	const present = new Set(items.map((i) => `${prefix}${i.key}`));
	const seen = [...present].filter((k) => log.last[k] !== undefined);
	const gone = Object.keys(log.last).filter(
		(k) => k.startsWith(prefix) && !present.has(k) && now - seenAt(log.last[k]) > WORLD.forgetHours * HOUR
	);
	if (seen.length || gone.length) {
		const t = new Date(now).toISOString();
		update((l) => {
			seen.forEach((k) => (l.last[k] = t));
			gone.forEach((k) => delete l.last[k]);
		});
	}
	return items.filter((i) => log.last[`${prefix}${i.key}`] === undefined);
}

const mark = (key: string, now: number) => (l: NotifyLog) => void (l.last[key] = new Date(now).toISOString());

// ---------- P1 ----------

/** Alerta roja de GDACS. Un aviso por evento, aunque cambie de episodio. Id: gdacs:<id>. */
export function gdacsRule(d: WorldInputs, ctx: RuleContext): Draft[] {
	if (!Array.isArray(d.gdacs)) return [];
	const red = d.gdacs.filter((e) => e?.id && WORLD.gdacs.levels.includes(e.level));
	return once('gdacs:', red.map((e) => ({ key: e.id, item: e })), ctx).map(({ item: e }) => ({
		id: `gdacs:${e.id}`,
		title: `🔴 ${e.kind}${e.country ? ` · ${e.country}` : ''}`,
		body: [e.name, e.severity, 'Alerta roja de GDACS (ONU y Comisión Europea).'].filter(Boolean).join('\n'),
		tags: 'rotating_light',
		click: e.url || `${SITE}/geo`,
		time: Date.parse(e.updated ?? e.from ?? '') || ctx.now,
		commit: mark(`gdacs:${e.id}`, ctx.now)
	}));
}

/** La mayor caída de la demanda real (en tanto por uno) en `minutes` minutos o menos. */
export function steepestDrop(points: DemandData['recent'], minutes: number): number {
	const pts = list(points)
		.map((p) => ({ t: Date.parse(p?.time ?? ''), v: Number(p?.real) }))
		.filter((p) => Number.isFinite(p.t) && p.v > 0)
		.sort((a, b) => a.t - b.t);
	let worst = 0;
	for (let i = 0; i < pts.length; i++) {
		for (let j = i + 1; j < pts.length && pts[j].t - pts[i].t <= minutes * MIN; j++) {
			worst = Math.max(worst, 1 - pts[j].v / pts[i].v);
		}
	}
	return worst;
}

/**
 * Posible apagón en España: caída brusca de la demanda real (y muy por debajo de la prevista, salvo que la
 * caída sea enorme). Espera de 6 h entre avisos. Id: blackout:<día>:<hora> (de Madrid).
 */
export function blackoutRule(d: WorldInputs, { now, log }: RuleContext): Draft[] {
	const r = d.reeDemand;
	const t = Date.parse(r?.time ?? '');
	const w = WORLD.blackout;
	if (!r || !Number.isFinite(t) || now - t > w.maxAgeMinutes * MIN) return [];
	const drop = steepestDrop(r.recent, w.minutes);
	const gap = typeof r.gap === 'number' ? r.gap : null;
	if (drop < w.drop || (drop < w.hardDrop && (gap === null || gap < w.gap))) return [];
	const last = Date.parse(log.last['blackout'] ?? '');
	if (Number.isFinite(last) && t - last < w.waitHours * HOUR) return [];
	const { date, hm } = madrid(t);
	return [
		{
			id: `blackout:${date}:${hm.slice(0, 2)}`,
			title: '⚡ Posible apagón en España',
			body:
				`La demanda eléctrica ha caído un ${pct(drop * 100)} en ${w.minutes} min o menos: ` +
				`${Math.round(r.real).toLocaleString('es-ES')} MW a las ${hm}` +
				(gap !== null && r.forecast ? `, ${pct(gap)} por debajo de la prevista (${Math.round(r.forecast).toLocaleString('es-ES')} MW)` : '') +
				' (REE).',
			tags: 'zap',
			click: `${SITE}/luz`,
			time: t,
			commit: (l) => void (l.last['blackout'] = new Date(t).toISOString())
		}
	];
}

/**
 * Caída de internet en un país grande (nivel crítico) o en España (también aviso). Un aviso por país
 * mientras siga caído: `since` se mueve con la ventana de 12 h de IODA y no sirve para no repetir.
 * Id: ioda:<país>:<desde>.
 */
export function iodaRule(d: WorldInputs, ctx: RuleContext): Draft[] {
	if (!Array.isArray(d.ioda)) return [];
	const hits = d.ioda.filter((o) => {
		if (!o?.code || !o.since) return false;
		const big = WORLD.ioda.countries.includes(o.code);
		return o.code === WORLD.ioda.home || (big && o.level === 'critical');
	});
	return once('ioda:', hits.map((o) => ({ key: o.code, item: o })), ctx).map(({ item: o }) => {
		const signals = list(o.signals).join(', ');
		return {
			id: `ioda:${o.code}:${o.since}`,
			title: `🌐 Caída de internet · ${o.name}`,
			body: [
				`${o.level === 'critical' ? 'Crítica' : 'Aviso'}${typeof o.drop === 'number' ? `: hasta un ${pct(o.drop)} por debajo de lo normal` : ''}.`,
				signals ? `Señales: ${signals}.` : '',
				`Desde ${madridTime(o.since)} (IODA).`
			]
				.filter(Boolean)
				.join(' '),
			tags: 'globe_with_meridians',
			click: o.url || `${SITE}/geo`,
			time: Date.parse(o.since) || ctx.now,
			commit: mark(`ioda:${o.code}`, ctx.now)
		};
	});
}

// ---------- P2 ----------

const RANK: Record<string, number> = { none: 0, maintenance: 1, minor: 2, major: 3, critical: 4 };

/**
 * Servicio con incidencia grave (indicador major o critical) y datos de esta pasada (no `stale`). Un aviso
 * por incidencia: las de impacto major o critical; si ninguna lo es, la más reciente. Id: status:<servicio>:<incidencia>.
 */
export function statusRule(d: WorldInputs, ctx: RuleContext): Draft[] {
	if (!Array.isArray(d.statuspage)) return [];
	const items = d.statuspage.flatMap((s) => {
		if (!s?.id || s.stale || !WORLD.status.indicators.includes(s.indicator)) return [];
		const incidents = list(s.incidents).filter((i) => i?.id);
		const grave = incidents.filter((i) => (RANK[i.impact] ?? 0) >= RANK.major);
		const latest = [...incidents].sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''))[0];
		const chosen = grave.length ? grave : latest ? [latest] : [];
		return chosen.map((i) => ({ key: `${s.id}:${i.id}`, item: { s, i } }));
	});
	// Las marcas de los servicios que esta pasada no ha podido leer (stale) se conservan.
	const stale = d.statuspage.filter((s) => s?.stale).map((s) => `status:${s.id}:`);
	const kept = Object.keys(ctx.log.last).filter((k) => stale.some((p) => k.startsWith(p)));
	const all = [...items, ...kept.map((k) => ({ key: k.slice('status:'.length), item: null }))];
	return once('status:', all, ctx).flatMap(({ key, item }) => {
		if (!item) return [];
		const { s, i } = item;
		return [
			{
				id: `status:${key}`,
				title: `🛠 ${s.name}: ${s.indicator === 'critical' ? 'caída grave' : 'caída parcial'}`,
				body: `${i.name}${i.status ? ` (${i.status})` : ''}.\n${s.description}.`,
				tags: 'warning',
				click: i.url || s.page,
				time: Date.parse(i.updated ?? i.started ?? '') || ctx.now,
				commit: mark(`status:${key}`, ctx.now)
			}
		];
	});
}

/**
 * Parte nuevo de brotes de la OMS: un id que no estaba en la pasada anterior. La primera vez solo apunta
 * los que hay. Id: who:<id del parte>.
 */
export function whoRule(d: WorldInputs, ctx: RuleContext): Draft[] {
	if (!Array.isArray(d.who) || !d.who.length) return [];
	const items = d.who.filter((n) => n?.id).map((n) => ({ key: n.id, item: n }));
	if (ctx.log.last['who:init'] === undefined) {
		const t = new Date(ctx.now).toISOString();
		ctx.update((l) => {
			l.last['who:init'] = t;
			items.forEach((i) => (l.last[`who:${i.key}`] = t));
		});
		return [];
	}
	// who:init también empieza por «who:»: se cuenta como presente para que no se borre.
	return once('who:', [...items, { key: 'init', item: null }], ctx).flatMap(({ item: n }) =>
		n
			? [
					{
						id: `who:${n.id}`,
						title: `🦠 OMS: ${n.title}`,
						body: n.summary || 'Parte nuevo de Disease Outbreak News.',
						tags: 'microbe',
						click: n.url,
						time: Date.parse(n.date ?? '') || ctx.now,
						commit: mark(`who:${n.id}`, ctx.now)
					}
				]
			: []
	);
}

// ---------- Lista ----------

/** Se añaden al final de RULES (scripts/alerts/rules.ts). */
export const WORLD_RULES: Rule[] = [
	{ type: 'gdacs', level: 1, run: gdacsRule },
	{ type: 'blackout', level: 1, run: blackoutRule },
	{ type: 'ioda', level: 1, run: iodaRule },
	{ type: 'status', level: 2, run: statusRule },
	{ type: 'who', level: 2, run: whoRule }
];
