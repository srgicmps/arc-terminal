// Horas, bolsas y agenda en la barra (lote 27-A), sin IA: «hora tokio», «¿está abierta la bolsa?»,
// «¿abre la bolsa mañana?», «¿cuándo es el próximo BCE?». Usa los horarios y festivos de markets.ts y el
// calendario de bancos centrales de cb-calendar.ts. Recibe el texto ya limpio (plain de answers.ts).
import { CB, cbUpcoming, type CbBank } from '../cb-calendar.ts';
import { hmIn, weekday } from '../format.ts';
import { addDays, holidayOn, localDate, marketStatus, MARKETS, sessionsOn, until, type ClockMarket } from '../markets.ts';
import { madridDate } from '../meetings.ts';
import type { Answer } from './answers.ts';

/** Ciudades de «hora …»: zona horaria, nombre y su bolsa (código de MARKETS), si la tiene. */
const CITIES: { keys: string[]; name: string; tz: string; market?: string }[] = [
	{ keys: ['madrid', 'espana'], name: 'Madrid', tz: 'Europe/Madrid', market: 'MAD' },
	{ keys: ['ny', 'nueva york', 'new york', 'wall street', 'nyse'], name: 'Nueva York', tz: 'America/New_York', market: 'NYC' },
	{ keys: ['londres', 'london', 'lse'], name: 'Londres', tz: 'Europe/London', market: 'LON' },
	{ keys: ['tokio', 'tokyo', 'japon'], name: 'Tokio', tz: 'Asia/Tokyo', market: 'TYO' },
	{ keys: ['hong kong', 'hk'], name: 'Hong Kong', tz: 'Asia/Hong_Kong', market: 'HKG' },
	{ keys: ['shanghai', 'pekin', 'china'], name: 'Shanghái', tz: 'Asia/Shanghai', market: 'SHA' },
	{ keys: ['bombay', 'mumbai', 'india', 'delhi'], name: 'Bombay', tz: 'Asia/Kolkata', market: 'BOM' },
	{ keys: ['francfort', 'frankfurt', 'berlin', 'alemania', 'xetra'], name: 'Fráncfort', tz: 'Europe/Berlin', market: 'FRA' },
	{ keys: ['sao paulo', 'brasil'], name: 'São Paulo', tz: 'America/Sao_Paulo', market: 'SAO' },
	{ keys: ['paris', 'francia'], name: 'París', tz: 'Europe/Paris' },
	{ keys: ['los angeles', 'san francisco', 'california'], name: 'Los Ángeles', tz: 'America/Los_Angeles' },
	{ keys: ['chicago'], name: 'Chicago', tz: 'America/Chicago' },
	{ keys: ['mexico'], name: 'Ciudad de México', tz: 'America/Mexico_City' },
	{ keys: ['dubai'], name: 'Dubái', tz: 'Asia/Dubai' },
	{ keys: ['moscu'], name: 'Moscú', tz: 'Europe/Moscow' },
	{ keys: ['singapur'], name: 'Singapur', tz: 'Asia/Singapore' },
	{ keys: ['sidney', 'sydney', 'australia'], name: 'Sídney', tz: 'Australia/Sydney' },
	{ keys: ['seul', 'corea'], name: 'Seúl', tz: 'Asia/Seoul' },
	{ keys: ['buenos aires', 'argentina'], name: 'Buenos Aires', tz: 'America/Argentina/Buenos_Aires' }
];

const city = (s: string) => CITIES.find((c) => c.keys.includes(s.trim()));
const market = (code: string) => MARKETS.find((m) => m.code === code)!;

/** Diferencia de horas con Madrid en ese instante: «+7 h», «−6 h», «misma hora». */
function vsMadrid(tz: string, now: number): string {
	const minutes = (zone: string) => {
		const [h, m] = hmIn(new Date(now).toISOString(), zone).split(':').map(Number);
		const day = localDate(zone, now);
		return Date.parse(`${day}T00:00:00Z`) / 60_000 + h * 60 + m;
	};
	const diff = (minutes(tz) - minutes('Europe/Madrid')) / 60;
	if (!diff) return 'misma hora que Madrid';
	const abs = Math.abs(diff);
	const text = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace('.', ',');
	return `${diff > 0 ? '+' : '−'}${text} h respecto a Madrid`;
}

/** «abierta, cierra en 2 h» / «cerrada (Navidad), abre en 1 d 3 h». */
function statusText(mk: ClockMarket, now: number): string {
	const st = marketStatus(mk, now);
	const next = st.next ? `, ${st.isOpen ? 'cierra' : 'abre'} en ${until(st.next - now)}` : '';
	return `${st.isOpen ? 'abierta' : `cerrada${st.holiday ? ` (${st.holiday})` : ''}`}${next}`;
}

/** Si un día hay sesión: «abre de 9:00 a 17:30 (hora de Madrid)» o «cerrada: festivo (Navidad)». */
function dayText(mk: ClockMarket, date: string): string {
	const spans = sessionsOn(mk, date);
	if (!spans.length) {
		const h = holidayOn(mk, date);
		return h ? `cerrada: festivo (${h})` : 'cerrada: fin de semana';
	}
	const hm = (ms: number) => hmIn(new Date(ms).toISOString(), 'Europe/Madrid');
	return `abre de ${hm(spans[0][0])} a ${hm(spans[spans.length - 1][1])} (hora de Madrid)`;
}

/** La bolsa de la que se pregunta: la que se nombra o, si no, Madrid. */
function marketIn(q: string): ClockMarket {
	for (const c of CITIES) if (c.market && c.keys.some((k) => new RegExp(`\\b${k}\\b`).test(q))) return market(c.market);
	return market('MAD');
}

/** Bancos de «próximo BCE», «¿cuándo es la Fed?». */
const BANK_WORDS: [RegExp, CbBank][] = [
	[/\b(bce|ecb)\b/, 'ecb'],
	[/\b(fed|fomc|reserva federal)\b/, 'fed'],
	[/\b(boe|banco de inglaterra)\b/, 'boe'],
	[/\b(boj|banco de japon)\b/, 'boj'],
	[/\b(bns|snb)\b/, 'snb'],
	[/\b(boc|banco de canada)\b/, 'boc'],
	[/\b(rba)\b/, 'rba']
];

/** «hora tokio», «¿abre la bolsa mañana?», «próximo BCE». null si no es una de estas preguntas. */
export function clockAnswer(q: string, now: number): Answer | null {
	// «hora tokio», «hora en NY», «qué hora es en Londres»
	const h = q.match(/^(?:que )?hora(?: es)?(?: en| de)? (.+)$/);
	if (h) {
		const c = city(h[1]);
		if (!c) return { code: 'HORA', desc: `No conozco «${h[1]}»: prueba con Tokio, NY, Londres, Hong Kong, Bombay…` };
		const iso = new Date(now).toISOString();
		const day = localDate(c.tz, now) === localDate('Europe/Madrid', now) ? '' : ` (${weekday(localDate(c.tz, now))})`;
		const bolsa = c.market ? ` · bolsa ${statusText(market(c.market), now)}` : '';
		return { code: c.name.toUpperCase(), desc: `${hmIn(iso, c.tz)}${day} · ${vsMadrid(c.tz, now)}${bolsa}` };
	}
	if (q === 'hora' || q === 'horas') {
		const list = ['NYC', 'LON', 'TYO'].map((code) => {
			const mk = market(code);
			return `${mk.short} ${hmIn(new Date(now).toISOString(), mk.tz)}`;
		});
		return { code: 'HORA', desc: list.join(' · ') };
	}
	// «próximo BCE», «¿cuándo es la próxima Fed?», «reunión del BCE»
	if (/\b(proxim[oa]s?|cuando|reunion|siguiente)\b/.test(q)) {
		const bank = BANK_WORDS.find(([re]) => re.test(q))?.[1];
		if (bank) {
			const m = cbUpcoming(madridDate(now), [bank])[0];
			const info = CB[bank];
			if (!m) return { code: info.name, desc: 'No hay más fechas en el calendario de este año', open: 'CAL' };
			const days = Math.round((Date.parse(`${m.date}T12:00:00Z`) - Date.parse(`${madridDate(now)}T12:00:00Z`)) / 86_400_000);
			const inDays = days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`;
			const at = m.at ? ` a las ${hmIn(m.at, 'Europe/Madrid')} (Madrid)` : '';
			return { code: info.name, desc: `Próxima decisión de tipos: ${weekday(m.date)} ${m.date.slice(0, 4)}${at} · ${inDays}`, open: 'CAL' };
		}
	}
	// «¿está abierta la bolsa?», «¿abre la bolsa mañana?», «¿abre Wall Street el lunes?»
	if (/\b(bolsa|bolsas|wall street|nyse|ibex|mercado|mercados)\b/.test(q) && /\b(abre|abierta|abierto|cierra|cerrada|cerrado|festivo|hay)\b/.test(q)) {
		const mk = marketIn(q);
		const name = mk.code === 'NYC' ? 'Wall Street' : `La bolsa de ${mk.name}`;
		const today = localDate(mk.tz, now);
		if (/\bmanana\b/.test(q)) {
			const date = addDays(today, 1);
			return { code: mk.short.toUpperCase(), desc: `Mañana (${weekday(date)}): ${name} ${dayText(mk, date)}` };
		}
		if (/\b(hoy)\b/.test(q) || !/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(q))
			return { code: mk.short.toUpperCase(), desc: `${name}: ${statusText(mk, now)}` };
		const names = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
		const want = names.findIndex((d) => new RegExp(`\\b${d}\\b`).test(q));
		let date = addDays(today, 1);
		while (new Date(`${date}T12:00:00Z`).getUTCDay() !== want) date = addDays(date, 1);
		return { code: mk.short.toUpperCase(), desc: `${weekday(date)}: ${name} ${dayText(mk, date)}` };
	}
	return null;
}
