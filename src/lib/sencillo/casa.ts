// «Tu casa» en la app Sencilla: luz, gasolina y tiempo de tu sitio, contados como tarjetas (facts.ts). Lógica pura:
// se calcula en el navegador porque depende de la hora y de «Tu sitio».
import { inMenorca } from '../place.ts';
import { hourLabel, hourly, madridNow, cheapestWindow, dayStats } from '../power.ts';
import { powerPhrase } from '../plain.ts';
import type { PricePoint, WeatherDay } from '../types.ts';
import { sky } from '../weather.ts';
import type { Fact } from './facts.ts';

const nf = (v: number, d: number) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });

/** La luz de hoy (PVPC): la media, la franja de 2 horas más barata que queda y el precio de cada hora. */
export function luzFact(pvpc: PricePoint[], now: number): Fact | null {
	const prices = hourly(pvpc);
	const { day, hour } = madridNow(now);
	const today = prices.filter((p) => p.day === day);
	if (today.length < 12) return null;
	const { avg } = dayStats(today);
	// La franja más barata que aún no ha pasado (si ya han pasado todas, la del día entero).
	const win = cheapestWindow(prices, day, 2, hour) ?? cheapestWindow(prices, day, 2);
	const slot = win ? `de ${hourLabel(win.first)} a ${hourLabel({ hour: win.after.hour })}` : '';
	return {
		id: 'luz',
		title: 'Luz más barata hoy',
		value: slot || `${nf(avg, 3)} €/kWh`,
		delta: null,
		change: win ? `${nf(win.avg, 3)} €/kWh en esa franja; la media del día, ${nf(avg, 3)} €/kWh` : '',
		phrase: win ? `${powerPhrase(avg)} Pon la lavadora o el lavavajillas ${slot}.` : powerPhrase(avg),
		spark: today.map((p) => p.kwh),
		explain: 'pvpc',
		when: 'hoy',
		source: 'Red Eléctrica (tarifa regulada PVPC)'
	};
}

export interface FuelProvinceLite {
	id: string;
	name: string;
	avg: number | null;
	min: number | null;
}

/** La gasolina 95 de tu sitio: en Menorca, la gasolinera más barata; en el resto de España, la media y el mínimo de tu provincia. */
export function fuelFact(
	place: { name: string; cc: string; lat: number; lon: number; admin1?: string; admin2?: string },
	zone: string | null,
	provinces: FuelProvinceLite[],
	cheapest: { name: string; town: string; price: number }[],
	spain: number | null
): Fact | null {
	if (inMenorca(place) && cheapest[0]) {
		const c = cheapest[0];
		return {
			id: 'gasolina',
			title: 'Gasolina más barata en Menorca',
			value: `${nf(c.price, 3)} €/l`,
			delta: null,
			change: `${c.name}, ${c.town}`,
			phrase: spain != null ? `La media de España es de ${nf(spain, 3)} €/l: ahí ahorras ${nf(Math.max(0, (spain - c.price) * 50), 2)} € en un depósito de 50 litros.` : null,
			spark: [],
			explain: 'gasolina',
			when: 'hoy',
			source: 'Ministerio para la Transición Ecológica'
		};
	}
	const p = zone ? provinces.find((x) => x.id === zone) : undefined;
	if (p?.avg != null) {
		return {
			id: 'gasolina',
			title: `Gasolina 95 en ${p.name}`,
			value: `${nf(p.avg, 3)} €/l`,
			delta: null,
			change: p.min != null ? `La más barata, a ${nf(p.min, 3)} €/l` : '',
			phrase:
				p.min != null ? `Entre la media y la más barata de tu provincia hay ${nf((p.avg - p.min) * 50, 2)} € de diferencia en un depósito de 50 litros.` : null,
			spark: [],
			explain: 'gasolina',
			when: 'hoy',
			source: 'Ministerio para la Transición Ecológica'
		};
	}
	if (spain == null) return null;
	return {
		id: 'gasolina',
		title: 'Gasolina 95 en España',
		value: `${nf(spain, 3)} €/l`,
		delta: null,
		change: 'Media de todas las gasolineras',
		phrase: `La gasolina 95 cuesta de media ${nf(spain, 3)} € el litro en España.`,
		spark: [],
		explain: 'gasolina',
		when: 'hoy',
		source: 'Ministerio para la Transición Ecológica'
	};
}

export interface WeatherLite {
	name: string;
	current: { temp: number; code: number; wind: number; humidity: number };
	daily: WeatherDay[];
}

/** «Hoy, 24° y despejado. Mañana, máxima de 22° y lluvia.» */
export function weatherPhrase(w: WeatherLite): string {
	const [today, tomorrow] = w.daily;
	const now = `Ahora, ${Math.round(w.current.temp)}° y ${sky(w.current.code).label.toLowerCase()}`;
	const t = today ? `. Hoy, entre ${Math.round(today.min)}° y ${Math.round(today.max)}°` : '';
	const rain = today && today.rain >= 1 ? `, con lluvia (${nf(today.rain, 0)} mm)` : '';
	const m = tomorrow ? `. Mañana, ${sky(tomorrow.code).label.toLowerCase()}, máxima de ${Math.round(tomorrow.max)}°` : '';
	return `${now}${t}${rain}${m}.`;
}
