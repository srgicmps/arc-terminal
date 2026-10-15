// Frases en español claro para el modo Sencillo: los datos clave contados como se contarían en la calle
// («La inflación en España es del 2,4 %: las cosas cuestan un 2,4 % más que hace un año»). Plantillas fijas a
// partir de los datos, sin IA. Si falta el dato, la frase no sale (null). ViewHeader las pinta con `plain`.
import type { Point } from './types.ts';

const nf = (v: number, d = 1) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const abs = (v: number, d = 1) => nf(Math.abs(v), d);

/** El punto de hace un año (mismo mes o día del año anterior, o el último antes), si lo hay. */
export function yearAgo(points: readonly Point[] | undefined): Point | undefined {
	const last = points?.at(-1);
	if (!last) return undefined;
	const target = `${Number(last.t.slice(0, 4)) - 1}${last.t.slice(4)}`;
	return points!.findLast((p) => p.t <= target);
}

/** «La inflación en España es del 2,4 %: las cosas cuestan un 2,4 % más que hace un año.» */
export function inflationPhrase(place: string, points: readonly Point[] | undefined): string | null {
	const v = points?.at(-1)?.v;
	if (v == null) return null;
	if (Math.abs(v) < 0.05) return `La inflación en ${place} está en el 0 %: los precios están igual que hace un año.`;
	if (v < 0) return `Los precios en ${place} han bajado un ${abs(v)} % en un año: hay deflación.`;
	const prev = points!.at(-2)?.v;
	const trend = prev == null || nf(prev) === nf(v) ? '' : v > prev ? ` Sube: el mes anterior era del ${nf(prev)} %.` : ` Baja: el mes anterior era del ${nf(prev)} %.`;
	return `La inflación en ${place} es del ${nf(v)} %: las cosas cuestan un ${nf(v)} % más que hace un año.${trend}`;
}

/** «El paro en España está en el 10,5 %: de cada 100 personas que quieren trabajar, unas 10 no encuentran empleo.» */
export function unemploymentPhrase(place: string, points: readonly Point[] | undefined): string | null {
	const v = points?.at(-1)?.v;
	if (v == null) return null;
	const n = Math.round(v);
	const people = n === 0 ? 'casi todas encuentran' : n === 1 ? 'una no encuentra' : `unas ${n} no encuentran`;
	return `El paro en ${place} está en el ${nf(v)} %: de cada 100 personas que quieren trabajar, ${people} empleo.`;
}

/** «La economía de España creció un 0,6 % en el último trimestre.» (variación trimestral) o «… en un año» (interanual). */
export function gdpPhrase(place: string, points: readonly Point[] | undefined, span: 'trimestre' | 'año' = 'trimestre'): string | null {
	const v = points?.at(-1)?.v;
	if (v == null) return null;
	const when = span === 'trimestre' ? 'en el último trimestre' : 'en el último año';
	if (Math.abs(v) < 0.05) return `La economía de ${place} se ha quedado igual ${when}.`;
	return v > 0 ? `La economía de ${place} creció un ${nf(v)} % ${when}.` : `La economía de ${place} se encogió un ${abs(v)} % ${when}.`;
}

/** «El euríbor está en el 2,2 %, 0,4 puntos menos que hace un año: las hipotecas variables bajarán en su próxima revisión.» */
export function euriborPhrase(points: readonly Point[] | undefined): string | null {
	const last = points?.at(-1);
	if (!last) return null;
	const before = yearAgo(points);
	const head = `El euríbor está en el ${nf(last.v, 2)} %`;
	if (!before) return `${head}: es la referencia de casi todas las hipotecas variables.`;
	const d = Math.round((last.v - before.v) * 10) / 10;
	if (!d) return `${head}, como hace un año: las hipotecas variables pagarán más o menos lo mismo en su próxima revisión.`;
	return `${head}, ${abs(d)} puntos ${d > 0 ? 'más' : 'menos'} que hace un año: las hipotecas variables ${d > 0 ? 'subirán' : 'bajarán'} en su próxima revisión.`;
}

/** «El Banco Central Europeo tiene los tipos en el 2,00 % (los bajó la última vez).» */
export function policyPhrase(bank: string, points: readonly Point[] | undefined): string | null {
	const last = points?.at(-1);
	if (!last) return null;
	// Un cambio de verdad es de al menos 0,10 puntos: el tipo efectivo de la Fed (DFF) baila ±0,01 cada día
	// sin que haya reunión, y eso no es «los subió».
	const prev = points!.findLast((p) => Math.abs(p.v - last.v) >= 0.1);
	const move = !prev ? '' : last.v < prev.v ? ': la última vez los bajó, para animar la economía' : ': la última vez los subió, para frenar los precios';
	return `${bank} tiene los tipos de interés en el ${nf(last.v, 2)} %${move}.`;
}

/** «La prima de riesgo de España está en 65 puntos: tranquilidad.» */
export function premiumPhrase(place: string, bp: number | null | undefined): string | null {
	if (bp == null) return null;
	const mood = bp < 100 ? 'tranquilidad, los inversores se fían' : bp < 300 ? 'algo de desconfianza, conviene vigilarla' : 'alarma, como en las crisis de deuda';
	return `La prima de riesgo de ${place} está en ${Math.round(bp)} puntos: ${mood}.`;
}

/** «Un euro vale 1,08 dólares.» */
export function fxPhrase(points: readonly Point[] | undefined, currency = 'dólares'): string | null {
	const v = points?.at(-1)?.v;
	return v == null ? null : `Un euro vale ${nf(v, 2)} ${currency}.`;
}

/** «El bitcoin sube un 2,1 % en las últimas 24 horas.» */
export function movePhrase(name: string, pct: number | null | undefined, span = 'hoy'): string | null {
	if (pct == null) return null;
	if (Math.abs(pct) < 0.05) return `${name} está igual que ${span === 'hoy' ? 'ayer' : 'antes'}.`;
	return `${name} ${pct > 0 ? 'sube' : 'baja'} un ${abs(pct)} % ${span}.`;
}

/** «La luz cuesta hoy de media 0,12 €/kWh.» */
export function powerPhrase(kwh: number | null | undefined): string | null {
	return kwh == null ? null : `La luz (tarifa regulada) cuesta hoy de media ${nf(kwh, 3)} € el kWh.`;
}

/** «El sol (índice UV) llega hoy a 7, alto: protégete de 12:00 a 17:00.» */
export function uvPhrase(uv: number | null | undefined, level: string | undefined, window: { from: string; to: string } | null): string | null {
	if (uv == null || !level) return null;
	const tail = window ? `: protégete de ${window.from} a ${window.to}` : '';
	return `El sol (índice UV) llega hoy a ${nf(uv, 0)}, ${level.toLowerCase()}${tail}.`;
}

/** «Polen hoy: olivo alto y gramíneas moderado.» o «Hoy apenas hay polen.» */
export function pollenPhrase(when: 'hoy' | 'mañana', high: { name: string; level: { label: string } }[]): string {
	if (!high.length) return when === 'hoy' ? 'Hoy apenas hay polen.' : 'Mañana apenas habrá polen.';
	const list = high.map((h) => `${h.name.toLowerCase()} ${h.level.label.toLowerCase()}`);
	const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} y ${list.at(-1)}` : list[0];
	return `Polen ${when}: ${joined}.`;
}

/** «La franja de 2 horas más barata que queda hoy es de 14:00 a 16:00, a 0,052 € el kWh.» */
export function cheapPhrase(when: 'hoy' | 'mañana', hours: number, from: string, to: string, kwh: number): string {
	const span = hours === 1 ? 'La hora' : `La franja de ${hours} horas`;
	const left = when === 'hoy' ? 'que queda hoy' : 'de mañana';
	return `${span} más barata ${left} es de ${from} a ${to}, a ${nf(kwh, 3)} € el kWh.`;
}

/** «La gasolina 95 cuesta de media 1,52 € el litro en España.» */
export function fuelPhrase(place: string, eurPerLitre: number | null | undefined, fuel = 'La gasolina 95'): string | null {
	return eurPerLitre == null ? null : `${fuel} cuesta de media ${nf(eurPerLitre, 3)} € el litro en ${place}.`;
}

/** Quita las que faltan. */
export const phrases = (list: (string | null | undefined | false)[]) => list.filter((p): p is string => !!p);
