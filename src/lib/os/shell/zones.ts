// Reloj de la bandeja de Arc OS: la hora de aquí y, al desplegarlo, la de otras ciudades con su bolsa
// abierta o cerrada (src/lib/markets.ts). Lógica pura.
import { MARKETS, marketStatus, type ClockMarket } from '../../markets.ts';

export interface Zone {
	label: string;
	tz: string;
	/** Su bolsa, si tiene: para «abierta / cerrada». */
	market?: ClockMarket;
}

const mk = (code: string) => MARKETS.find((m) => m.code === code);

/** Las ciudades del reloj desplegado, de oeste a este. */
export const ZONES: Zone[] = [
	{ label: 'Nueva York', tz: 'America/New_York', market: mk('NYC') },
	{ label: 'São Paulo', tz: 'America/Sao_Paulo', market: mk('SAO') },
	{ label: 'Londres', tz: 'Europe/London', market: mk('LON') },
	{ label: 'Madrid', tz: 'Europe/Madrid', market: mk('MAD') },
	{ label: 'Fráncfort', tz: 'Europe/Berlin', market: mk('FRA') },
	{ label: 'Bombay', tz: 'Asia/Kolkata', market: mk('BOM') },
	{ label: 'Hong Kong', tz: 'Asia/Hong_Kong', market: mk('HKG') },
	{ label: 'Tokio', tz: 'Asia/Tokyo', market: mk('TYO') }
];

/** «14:05» en esa zona. */
export function timeIn(tz: string, now: number): string {
	return new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}

/** Diferencia en horas con `base` («+6», «−1», «0»); con medias horas, «+3,5». */
export function offsetFrom(tz: string, base: string, now: number): string {
	const mins = (zone: string) => {
		const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(now);
		const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
		return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) / 60_000;
	};
	const h = (mins(tz) - mins(base)) / 60;
	if (h === 0) return '0';
	return `${h > 0 ? '+' : '−'}${Math.abs(h).toLocaleString('es-ES', { maximumFractionDigits: 1 })}`;
}

/** Cuántas bolsas del reloj están abiertas ahora, para la bandeja («3 abiertas»). */
export function openMarkets(now: number, zones = ZONES): number {
	return zones.filter((z) => z.market && marketStatus(z.market, now).isOpen).length;
}
