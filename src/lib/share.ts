// «Compartir» de los paneles: el menú del sistema (navigator.share) si lo hay y, si no, copiar al
// portapapeles. Lógica pura, sin depender del navegador: recibe el navigator (o uno simulado en los tests).
import { nf } from './format.ts';

export interface ShareInfo {
	title: string;
	text?: string;
	/** Absoluta o relativa a la página actual. Por defecto, la página actual con su query. */
	url?: string;
}

/** Los datos, o una función que los devuelve al pulsar (así el texto refleja lo que se ve en ese momento). */
export type ShareSource = ShareInfo | (() => ShareInfo);

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Lo que se usa del navigator: así los tests pasan uno simulado. */
export interface ShareNavigator {
	share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
	canShare?: (data: { title?: string; text?: string; url?: string }) => boolean;
	clipboard?: { writeText?: (text: string) => Promise<void> };
}

/** La URL absoluta: `url` resuelta contra la página actual, o la propia página si no hay `url`. */
export function absoluteUrl(url: string | undefined, current: string): string {
	return new URL(url ?? current, current).href;
}

/** Texto para el portapapeles: título, texto y URL, uno por línea (sin repetir el título). */
export function shareText(info: ShareInfo): string {
	const lines = [info.title, info.text && info.text !== info.title ? info.text : '', info.url ?? ''];
	return lines.filter(Boolean).join('\n');
}

const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';

/**
 * Comparte con el menú del sistema; si no existe o falla (salvo que el usuario lo cierre: AbortError),
 * copia al portapapeles. `legacyCopy` es el plan B si tampoco hay portapapeles (execCommand).
 */
export async function shareOrCopy(
	info: ShareInfo,
	nav: ShareNavigator,
	legacyCopy: (text: string) => boolean = () => false
): Promise<ShareResult> {
	const data = { title: info.title, text: info.text, url: info.url };
	// Si el menú del sistema dice de antemano que no puede con estos datos, se copia sin esperar a que falle:
	// tras un await fallido, Safari ya no deja usar el portapapeles (se ha perdido el gesto del usuario).
	if (typeof nav.share === 'function' && nav.canShare?.(data) !== false) {
		try {
			await nav.share(data);
			return 'shared';
		} catch (e) {
			if (isAbort(e)) return 'cancelled';
		}
	}
	const text = shareText(info);
	try {
		if (typeof nav.clipboard?.writeText !== 'function') throw new Error('sin portapapeles');
		await nav.clipboard.writeText(text);
		return 'copied';
	} catch {
		try {
			return legacyCopy(text) ? 'copied' : 'failed';
		} catch {
			return 'failed';
		}
	}
}

/** Copia con un <textarea> oculto y execCommand: navegadores viejos o páginas sin permiso de portapapeles. */
export function legacyCopy(text: string, doc: Document): boolean {
	const area = doc.createElement('textarea');
	area.value = text;
	area.setAttribute('readonly', '');
	area.style.position = 'fixed';
	area.style.opacity = '0';
	doc.body.append(area);
	area.select();
	try {
		return doc.execCommand('copy');
	} finally {
		area.remove();
	}
}

// ── Textos de cada vista ────────────────────────────────────────────────────────────────────

/** FUEL: «Gasolina 95 más barata en Menorca: Petro X (Maó) 1,559 €/L». */
export function fuelShare(o: {
	fuel: string;
	place: string;
	station: string;
	town: string;
	price: number;
	avg?: number | null;
}): Omit<ShareInfo, 'url'> {
	const avg = o.avg != null && Number.isFinite(o.avg) ? ` Media de la zona: ${nf(o.avg, 3)} €/L.` : '';
	return {
		title: `Gasolineras más baratas · ${o.place}`,
		text: `${o.fuel} más barata en ${o.place}: ${o.station} (${o.town}) ${nf(o.price, 3)} €/L.${avg}`
	};
}

/** LUZ: precio medio del día y hora más barata (horas de Madrid, como las da Red Eléctrica). */
export function luzShare(o: {
	/** «hoy», «mañana» o la fecha. */
	when: string;
	kind: string;
	avg: number;
	cheapHour: number;
	cheapKwh: number;
	cheapest?: number[];
}): Omit<ShareInfo, 'url'> {
	const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
	const more = o.cheapest?.length ? ` Horas más baratas: ${o.cheapest.map(hh).join(' · ')}.` : '';
	return {
		title: `Precio de la luz ${o.when}`,
		text:
			`${o.kind} ${o.when}: media ${nf(o.avg, 3)} €/kWh. ` +
			`La hora más barata, a las ${hh(o.cheapHour)} (${nf(o.cheapKwh, 3)} €/kWh).${more}`
	};
}

/** Ficha de un valor: símbolo y nombre (la cotización llega de TradingView, no hay cifras propias). */
export function stockShare(code: string, name: string): Omit<ShareInfo, 'url'> {
	return {
		title: name ? `${code} · ${name}` : code,
		text: `Ficha de ${name ? `${name} (${code})` : code}: cotización, gráfico y datos en directo.`
	};
}

/** «hoy», «mañana» o la fecha larga, comparando días de Madrid «2026-10-14». */
export function relativeDay(day: string, today: string, long: string): string {
	if (day === today) return 'hoy';
	const next = new Date(`${today}T12:00:00Z`);
	next.setUTCDate(next.getUTCDate() + 1);
	return day === next.toISOString().slice(0, 10) ? 'mañana' : `del ${long}`;
}
