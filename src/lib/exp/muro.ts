// Muro (experiencia 7): Arc Terminal para una tele o un segundo monitor. Letra enorme, relojes de las
// bolsas, titulares que rotan, una cinta de cotizaciones y, si pasa algo gordo, un aviso a pantalla completa.
// Sin tocar nada. Aquí, lo que se calcula al construir la web (/data/muro.json) y la rotación; lógica pura.
import type { ImpCurrent, Quake, Quote } from '../types.ts';

/** Lo mismo que los avisos P1 al móvil (scripts/alerts/config.ts): un terremoto fuerte o un tema enorme. */
export const WALL_ALERT = {
	quakeMag: 6.5,
	quakeMagTsunami: 6,
	/** Un aviso sale en el muro durante estas horas desde que pasó (o desde que lo vemos). */
	hours: 3,
	impMedia: 6,
	impSections: 3
};

export interface WallHeadline {
	title: string;
	sources: number;
	/** Desde cuándo lo vemos (ISO 8601). */
	first: string;
}

export interface WallAlert {
	kind: 'terremoto' | 'noticia';
	title: string;
	detail: string;
	/** ISO 8601. */
	time: string;
}

export interface WallQuote {
	symbol: string;
	price: number;
	changePct: number | null;
}

export interface WallData {
	headlines: WallHeadline[];
	alerts: WallAlert[];
	tape: WallQuote[];
}

const title = (i: Pick<ImpCurrent, 'title' | 'titleEs'>) => i.titleEs ?? i.title;

/** Lo que necesita el muro, recortado: pesa poco y la vista lo vuelve a pedir cada pocos minutos. */
export function buildWall(imp: ImpCurrent[], quakes: Quake[], quotes: Quote[], now: number): WallData {
	const since = now - WALL_ALERT.hours * 3_600_000;
	const recent = (iso: string | null | undefined) => !!iso && Date.parse(iso) >= since && Date.parse(iso) <= now + 60_000;
	const alerts: WallAlert[] = [
		...quakes
			.filter((q) => recent(q.time) && (q.mag >= WALL_ALERT.quakeMag || (q.tsunami && q.mag >= WALL_ALERT.quakeMagTsunami)))
			.map((q) => ({
				kind: 'terremoto' as const,
				title: `Terremoto de magnitud ${q.mag.toLocaleString('es-ES', { maximumFractionDigits: 1 })}`,
				detail: q.tsunami ? `${q.place} · aviso de tsunami` : q.place,
				time: q.time
			})),
		...imp
			.filter((i) => recent(i.first) && i.sources.length >= WALL_ALERT.impMedia && i.sections.length >= WALL_ALERT.impSections)
			.map((i) => ({ kind: 'noticia' as const, title: title(i), detail: `${i.sources.length} medios`, time: i.first }))
	].sort((a, b) => b.time.localeCompare(a.time));
	return {
		headlines: imp.slice(0, 12).map((i) => ({ title: title(i), sources: i.sources.length, first: i.first })),
		alerts: alerts.slice(0, 3),
		tape: quotes
			.filter((q) => Number.isFinite(q.price))
			.map((q) => ({ symbol: q.symbol, price: q.price, changePct: q.changePct }))
	};
}

/** El titular que toca a esta hora: cambia cada `seconds`, todos ven el mismo a la vez. */
export function rotation(n: number, now: number, seconds: number): number {
	return n ? Math.floor(now / (seconds * 1000)) % n : 0;
}

/** ¿Se enseña el aviso a pantalla completa? Los primeros `secs` de cada `every` segundos, mientras dure. */
export function alertShowing(now: number, every = 60, secs = 15): boolean {
	return (now / 1000) % every < secs;
}
