// Alarmas del Reloj de Arc OS: qué son y cuándo suenan. Lógica pura (con tests); el sonido y el aviso van en
// alarms.svelte.ts. Se guardan en la cuenta (clave arc-os-alarms, en prefs.ts).

export interface Alarm {
	id: string;
	/** «07:30», hora local. */
	time: string;
	label: string;
	on: boolean;
	/** Días en que suena (0 = domingo … 6 = sábado). Vacío: una vez, y se apaga sola al sonar. */
	days: number[];
}

export const ALARMS_KEY = 'arc-os-alarms';
export const MAX_ALARMS = 20;

export const isAlarms = (v: unknown): v is Alarm[] =>
	Array.isArray(v) &&
	v.every((a) => a && typeof a.id === 'string' && /^\d{2}:\d{2}$/.test(a.time) && typeof a.label === 'string' && typeof a.on === 'boolean' && Array.isArray(a.days));

const minuteOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const minuteOfTime = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Las alarmas que tocan en el minuto de `now` (se mira una vez por minuto). */
export function due(alarms: Alarm[], now: Date): Alarm[] {
	const m = minuteOf(now);
	return alarms.filter((a) => a.on && minuteOfTime(a.time) === m && (!a.days.length || a.days.includes(now.getDay())));
}

/** Cuánto falta para que suene, en minutos (para «Suena dentro de 7 h 12 min»); null si está apagada. */
export function minutesUntil(a: Alarm, now: Date): number | null {
	if (!a.on) return null;
	const target = minuteOfTime(a.time);
	const m = minuteOf(now);
	for (let add = 0; add <= 7; add++) {
		const day = (now.getDay() + add) % 7;
		const diff = target - m + add * 1440;
		if (diff > 0 && (!a.days.length || a.days.includes(day))) return diff;
	}
	return null;
}

export const DAY_NAMES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/** «En 7 h 12 min», «En 3 min». */
export function untilText(min: number): string {
	const h = Math.floor(min / 60);
	const d = Math.floor(h / 24);
	if (d) return `En ${d} d ${h % 24} h`;
	return h ? `En ${h} h ${min % 60} min` : `En ${min} min`;
}

/** «01:02:03,4» para el cronómetro y el temporizador. */
export function stopwatchText(ms: number, tenths = true): string {
	const t = Math.max(0, Math.floor(ms / 100));
	const s = Math.floor(t / 10);
	const pad = (n: number) => String(n).padStart(2, '0');
	const base = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
	return tenths ? `${base},${t % 10}` : base;
}
