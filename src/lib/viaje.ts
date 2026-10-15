// VIAJE <ciudad> (F5): lo útil antes de un viaje con datos que ya tiene la terminal. El tiempo lo pide el navegador
// a Open-Meteo (como Tu sitio); la moneda sale de los tipos del BCE, el aviso del Departamento de Estado de EE. UU.
// y los festivos de holidays-world. Aquí, lógica pura.
import type { WorldHoliday } from './puentes.ts';

/** Minutos de diferencia de la zona `tz` con Madrid en el instante `now` (positivo: van por delante). */
export function offsetFromMadrid(tz: string, now: number): number | null {
	const minutes = (zone: string) => {
		try {
			const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
				.formatToParts(new Date(now))
				.find((p) => p.type === 'timeZoneName')?.value;
			const m = parts?.match(/GMT(?:([+-])(\d\d):(\d\d))?/);
			if (!m) return null;
			return m[1] ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
		} catch {
			return null;
		}
	};
	const a = minutes(tz);
	const b = minutes('Europe/Madrid');
	return a === null || b === null ? null : a - b;
}

/** «2 h más que en Madrid», «5 h 30 min menos», «la misma hora que en Madrid». */
export function offsetLabel(min: number | null): string {
	if (min === null) return '';
	if (min === 0) return 'la misma hora que en Madrid';
	const a = Math.abs(min);
	const h = Math.floor(a / 60);
	const m = a % 60;
	const span = [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
	return `${span} ${min > 0 ? 'más' : 'menos'} que en Madrid`;
}

/** Festivos del país entre `from` y `from + days` (ambos «AAAA-MM-DD»), un día por fila; `regional` si no es de todo el país. */
export function tripHolidays(items: WorldHoliday[], from: string, days = 60): { date: string; names: string[]; regional: boolean }[] {
	const to = new Date(Date.parse(`${from}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
	const out = new Map<string, { date: string; names: string[]; regional: boolean }>();
	for (const h of items) {
		if (h.date < from || h.date > to) continue;
		const row = out.get(h.date) ?? { date: h.date, names: [], regional: true };
		if (!row.names.includes(h.name)) row.names.push(h.name);
		if (!h.counties?.length) row.regional = false;
		out.set(h.date, row);
	}
	return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}
