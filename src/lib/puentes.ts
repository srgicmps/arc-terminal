// PUENTES (F6): próximos festivos y puentes de España (con los de tu comunidad) y de tu país. Los festivos los
// descarga `holidays-world` (Nager.Date); aquí, lógica pura: qué días son fiesta en tu región y qué puentes salen.

export interface WorldHoliday {
	/** «2026-12-08» */
	date: string;
	name: string;
	/** Regiones (ISO 3166-2, «ES-MD») si no es fiesta en todo el país. */
	counties?: string[];
}

export interface WorldHolidaysData {
	/** Por código ISO del país. */
	countries: Record<string, WorldHoliday[]>;
}

/** Comunidades autónomas: código de Nager.Date y cómo puede llamarlas el buscador de Tu sitio (sin tildes). */
export const ES_REGIONS: { code: string; name: string; match: string[] }[] = [
	{ code: 'ES-AN', name: 'Andalucía', match: ['andalucia'] },
	{ code: 'ES-AR', name: 'Aragón', match: ['aragon'] },
	{ code: 'ES-AS', name: 'Asturias', match: ['asturias'] },
	{ code: 'ES-IB', name: 'Baleares', match: ['balear', 'illes balears'] },
	{ code: 'ES-CN', name: 'Canarias', match: ['canarias'] },
	{ code: 'ES-CB', name: 'Cantabria', match: ['cantabria'] },
	{ code: 'ES-CL', name: 'Castilla y León', match: ['castilla y leon', 'castile and leon'] },
	{ code: 'ES-CM', name: 'Castilla-La Mancha', match: ['castilla-la mancha', 'castilla la mancha', 'castile-la mancha'] },
	{ code: 'ES-CT', name: 'Cataluña', match: ['cataluna', 'catalunya', 'catalonia'] },
	{ code: 'ES-EX', name: 'Extremadura', match: ['extremadura'] },
	{ code: 'ES-GA', name: 'Galicia', match: ['galicia'] },
	{ code: 'ES-RI', name: 'La Rioja', match: ['rioja'] },
	{ code: 'ES-MD', name: 'Madrid', match: ['madrid'] },
	{ code: 'ES-MC', name: 'Murcia', match: ['murcia'] },
	{ code: 'ES-NC', name: 'Navarra', match: ['navarra', 'nafarroa'] },
	{ code: 'ES-PV', name: 'País Vasco', match: ['pais vasco', 'euskadi', 'basque'] },
	{ code: 'ES-VC', name: 'Comunidad Valenciana', match: ['valencia', 'valenciana'] },
	{ code: 'ES-CE', name: 'Ceuta', match: ['ceuta'] },
	{ code: 'ES-ML', name: 'Melilla', match: ['melilla'] }
];

const fold = (s: string) =>
	s
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase();

/** La comunidad de un sitio de España por su región («Comunidad de Madrid» → ES-MD), o null. */
export function esRegion(admin1: string | undefined): string | null {
	const a = fold(admin1 ?? '');
	if (!a) return null;
	return ES_REGIONS.find((r) => r.match.some((m) => a.includes(m)))?.code ?? null;
}

/** Los festivos de un país que son fiesta en `region` (o en todo el país, si region es null), sin repetir día. */
export function holidaysFor(items: WorldHoliday[], region: string | null): Map<string, string[]> {
	const out = new Map<string, string[]>();
	for (const h of items) {
		if (h.counties?.length && (!region || !h.counties.includes(region))) continue;
		const names = out.get(h.date) ?? [];
		if (!names.includes(h.name)) names.push(h.name);
		out.set(h.date, names);
	}
	return out;
}

export interface Break {
	/** Primer y último día libre (fin de semana incluido). */
	from: string;
	to: string;
	/** Días libres seguidos. */
	days: number;
	/** Días de trabajo que hay que pedir para el puente (vacío si no hace falta). */
	take: string[];
	/** Los festivos que caen dentro. */
	holidays: { date: string; names: string[] }[];
}

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const at = (d: string) => Date.parse(`${d}T12:00:00Z`);
const weekend = (t: number) => [0, 6].includes(new Date(t).getUTCDay());

/**
 * Los próximos descansos que da cada festivo entre semana, de hoy a `horizon` días: el bloque libre en el que cae
 * (con el fin de semana) y, si con 1 o 2 días de vacaciones se junta con otro fin de semana, el puente. Los
 * festivos en sábado o domingo no dan nada y no salen. Un bloque con varios festivos sale una vez.
 */
export function upcomingBreaks(holidays: Map<string, string[]>, today: string, horizon = 365): Break[] {
	const off = (t: number) => weekend(t) || holidays.has(iso(t));
	const start = at(today);
	const end = start + horizon * DAY;
	const out: Break[] = [];
	let covered = -Infinity;
	for (const date of [...holidays.keys()].sort()) {
		const t = at(date);
		if (t < start || t > end || weekend(t) || t <= covered) continue;
		// Bloque libre que contiene el festivo.
		let a = t;
		let b = t;
		while (off(a - DAY)) a -= DAY;
		while (off(b + DAY)) b += DAY;
		// ¿Con 1 o 2 días pedidos se junta con el bloque libre de al lado? Primero el que menos días pide.
		let best: { a: number; b: number; take: number[] } | null = null;
		for (const k of [1, 2]) {
			for (const side of [-1, 1]) {
				const edge = side < 0 ? a : b;
				const take = Array.from({ length: k }, (_, i) => edge + side * (i + 1) * DAY);
				const next = edge + side * (k + 1) * DAY;
				if (take.some(off) || !off(next)) continue;
				let far = next;
				while (off(far + side * DAY)) far += side * DAY;
				const cand = side < 0 ? { a: far, b, take } : { a, b: far, take };
				if (!best || cand.b - cand.a > best.b - best.a) best = cand;
			}
			if (best) break;
		}
		const from = best?.a ?? a;
		const to = best?.b ?? b;
		const inside: Break['holidays'] = [];
		for (let x = from; x <= to; x += DAY) {
			const names = holidays.get(iso(x));
			if (names) inside.push({ date: iso(x), names });
		}
		out.push({
			from: iso(from),
			to: iso(to),
			days: Math.round((to - from) / DAY) + 1,
			take: (best?.take ?? []).sort((x, y) => x - y).map(iso),
			holidays: inside
		});
		covered = to;
	}
	return out;
}
