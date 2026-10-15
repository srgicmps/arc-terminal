// «Tu mañana»: el resumen personal de cada usuario de la web, una vez al día a la hora que elige en AVISOS.
// Lo 5 que importa hoy PARA ÉL, en lenguaje claro: el tiempo en su sitio, sus valores, sus resultados y bancos
// centrales del día y los titulares de IMP de sus temas. Sale por su ntfy (users.ts) y, si lo pide, por email:
// la Action manda el texto a /api/brief con el service token y la web lo envía con Brevo (cloud/brief.ts), así el
// email nunca sale de Cloudflare. Lógica pura salvo `weatherAt` (Open-Meteo, sin clave).
import type { AlertConfig, GroupId } from '../../src/lib/alertconfig.ts';
import { BANKS, decisionTime, MEETINGS } from '../../src/lib/meetings.ts';
import { SITE } from '../site.ts';
import { cheapWindows, hourLabel, hourly, madridNow } from '../../src/lib/power.ts';
import { figures, madrid, num, type Alert, type Inputs, type NotifyLog } from './rules.ts';

/** El tiempo de hoy en su sitio. */
export interface Weather {
	min: number;
	max: number;
	/** Probabilidad máxima de lluvia, en %. */
	rain: number | null;
	code: number | null;
}

/** Secciones de IMP (src/lib/news.ts) de cada grupo de AVISOS. */
const SECTIONS: Partial<Record<GroupId, string[]>> = {
	imp: ['es', 'world', 'gov'],
	conflictos: ['geo', 'world'],
	mercados: ['ws'],
	macro: ['eco', 'intl'],
	tech: ['tech', 'ai'],
	energia: ['eco']
};

/** Cuántas líneas como mucho («lo 5 que importa»). */
export const BRIEF_LINES = 5;
/** Hasta cuánto después de su hora se manda si la pasada llega tarde (o no la hubo). */
const LATE_MIN = 180;

const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
export const briefId = (today: string) => `brief:${today}`;

/** ¿Le toca ahora? A partir de su hora (hasta 3 h después) y solo si hoy no se ha mandado. */
export function briefDue(config: AlertConfig, log: NotifyLog, now: number): boolean {
	if (!config.on || !config.brief.on) return false;
	const { date, hm } = madrid(now);
	const late = toMin(hm) - toMin(config.brief.at);
	return late >= 0 && late <= LATE_MIN && !log.entries.some((e) => e.k === briefId(date));
}

const SKY: [number, string][] = [
	[0, 'despejado'],
	[3, 'nubes y claros'],
	[48, 'niebla'],
	[67, 'lluvia'],
	[77, 'nieve'],
	[82, 'chubascos'],
	[86, 'nieve'],
	[99, 'tormenta']
];
const sky = (code: number | null) => (code === null ? '' : (SKY.find(([max]) => code <= max)?.[1] ?? ''));

const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;

/** El tiempo de hoy, en una línea. */
export function weatherLine(name: string, w: Weather): string {
	const what = sky(w.code);
	const wet = w.rain !== null && w.rain >= 30;
	// «lluvia (40 %)» si el cielo ya dice lluvia; si no, «40 % de lluvia» aparte.
	const rainy = ['lluvia', 'chubascos', 'tormenta', 'nieve'].includes(what);
	const sky2 = what ? `, ${what}${wet && rainy ? ` (${w.rain} %)` : ''}` : '';
	return `${name}: ${Math.round(w.min)}–${Math.round(w.max)} °C${sky2}${wet && !rainy ? `, ${w.rain} % de lluvia` : ''}.`;
}

/** Las líneas del resumen, por orden de importancia para él. Como mucho BRIEF_LINES. */
export function briefLines(
	config: AlertConfig,
	d: Inputs,
	today: string,
	base: Set<string>,
	weather: Weather | null,
	/** Ahora (para la luz que queda hoy). */
	now = Date.parse(`${today}T08:00:00+02:00`)
): string[] {
	const lines: string[] = [];
	if (weather && config.brief.place) lines.push(weatherLine(config.brief.place.name, weather));
	// La luz (si tiene los avisos de casa de la luz): la mejor franja de 2 h que queda hoy.
	if (config.home.luz) {
		const [w] = cheapWindows(hourly(d.power?.pvpc ?? []), today, 2, 1, madridNow(now));
		if (w) lines.push(`Luz más barata hoy: de ${hourLabel(w.first)} a ${hourLabel(w.after)} (${num(w.avg, 3)} €/kWh).`);
	}
	// Los mercados, si los sigue.
	if (config.groups.includes('mercados')) {
		const m = figures(d, ['S&P 500', 'Nasdaq', 'BTC']);
		if (m) lines.push(`Mercados: ${m}.`);
	}

	// Sus valores: los que más se movieron en la última sesión.
	const mine = new Set([...config.mis, ...(config.baseStocks && !config.mis.length ? base : [])]);
	const moved = (d.alertQuotes ?? [])
		.filter((q) => q?.symbol && mine.has(q.symbol) && Number.isFinite(q.changePct))
		.sort((a, b) => Math.abs(b.changePct!) - Math.abs(a.changePct!))
		.slice(0, 3);
	if (moved.length) lines.push(`Tus valores ayer: ${moved.map((q) => `${q.symbol} ${pct(q.changePct!)}`).join(' · ')}.`);

	// Su agenda: resultados de sus valores y bancos centrales (si sigue macro o mercados).
	const hours: Record<string, string> = { bmo: 'antes de abrir', amc: 'al cierre', dmh: 'en sesión' };
	const earnings = (d.finnhub?.earnings ?? []).filter((e) => e?.date === today && mine.has(e.symbol)).slice(0, 3);
	if (earnings.length)
		lines.push(`Hoy presentan resultados: ${earnings.map((e) => `${e.symbol}${hours[e.hour] ? ` (${hours[e.hour]})` : ''}`).join(', ')}.`);
	if (config.groups.some((g) => g === 'macro' || g === 'mercados'))
		for (const m of MEETINGS.filter((m) => m.date === today))
			lines.push(`El ${BANKS[m.bank].name} decide los tipos hoy a las ${decisionTime(m)}.`);

	// Titulares de IMP de sus temas; si no llegan, los más importantes.
	const sections = new Set(config.groups.flatMap((g) => SECTIONS[g] ?? []));
	const top = d.imp?.current ?? [];
	const theirs = top.filter((t) => (t.sections ?? []).some((s) => sections.has(s)));
	// Al menos dos titulares: lo personal ocupa como mucho BRIEF_LINES − 2.
	lines.splice(BRIEF_LINES - 2);
	for (const t of [...theirs, ...top.filter((t) => !theirs.includes(t))]) {
		if (lines.length >= BRIEF_LINES) break;
		// En español si la Action lo ha traducido (titleEs), como en IMP.
		const title = t.titleEs ?? t.title;
		lines.push(title.endsWith('.') ? title : `${title}.`);
	}
	return lines.slice(0, BRIEF_LINES);
}

/** El aviso de ntfy (y el texto del email). */
export function briefAlert(lines: string[], now: number): Alert {
	const { date } = madrid(now);
	const day = new Date(now).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
	return {
		id: briefId(date),
		type: 'brief',
		level: 3,
		title: `Tu mañana · ${day}`,
		body: lines.length ? lines.map((l, i) => `${i + 1}. ${l}`).join('\n') : 'Hoy no hay nada destacado para ti.',
		tags: 'sunrise',
		click: `${SITE}/`,
		time: now
	};
}

/** El tiempo de hoy en un sitio (Open-Meteo, sin clave). null si no responde. */
export async function weatherAt(lat: number, lon: number, fetcher: typeof fetch = fetch): Promise<Weather | null> {
	const url =
		`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
		'&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=1';
	try {
		const res = await fetcher(url, { signal: AbortSignal.timeout(15_000) });
		if (!res.ok) return null;
		const d = ((await res.json()) as { daily?: Record<string, (number | null)[]> }).daily ?? {};
		const [max, min] = [d.temperature_2m_max?.[0], d.temperature_2m_min?.[0]];
		if (typeof max !== 'number' || typeof min !== 'number') return null;
		return { min, max, rain: d.precipitation_probability_max?.[0] ?? null, code: d.weather_code?.[0] ?? null };
	} catch {
		return null;
	}
}
