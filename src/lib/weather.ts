// Códigos del tiempo de la OMM (los usa Open-Meteo) en español, con un símbolo discreto.

const CODES: [number[], string, string][] = [
	[[0], 'Despejado', '☀'],
	[[1], 'Casi despejado', '☀'],
	[[2], 'Intervalos nubosos', '⛅'],
	[[3], 'Nublado', '☁'],
	[[45, 48], 'Niebla', '≡'],
	[[51, 53, 55, 56, 57], 'Llovizna', '☂'],
	[[61, 63, 65, 66, 67], 'Lluvia', '☂'],
	[[71, 73, 75, 77], 'Nieve', '❄'],
	[[80, 81, 82], 'Chubascos', '☂'],
	[[85, 86], 'Chubascos de nieve', '❄'],
	[[95, 96, 99], 'Tormenta', 'ϟ']
];

export function sky(code: number): { label: string; icon: string } {
	const found = CODES.find(([codes]) => codes.includes(code));
	return found ? { label: found[1], icon: found[2] } : { label: '—', icon: '·' };
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/** 340 → «N» (de dónde sopla el viento). */
export function compass(deg: number): string {
	// El resto de JS puede ser negativo (-90 % 360 = -90): se suma 8 para dejarlo entre 0 y 7.
	return Number.isFinite(deg) ? DIRS[((Math.round(deg / 45) % 8) + 8) % 8] : '';
}

// ---------- Calidad del aire, UV y polen (CAMS vía Open-Meteo) ----------

/** Tono del nivel: discreto (normal), ámbar (atención) o rojo (malo). */
export type Tone = 'ok' | 'mid' | 'bad';

export interface Level {
	label: string;
	tone: Tone;
}

export const POLLEN_KEYS = ['olive', 'grass', 'birch', 'alder', 'mugwort', 'ragweed'] as const;
export type PollenKey = (typeof POLLEN_KEYS)[number];

export const POLLEN_NAMES: Record<PollenKey, string> = {
	olive: 'Olivo',
	grass: 'Gramíneas',
	birch: 'Abedul',
	alder: 'Aliso',
	mugwort: 'Artemisa',
	ragweed: 'Ambrosía'
};

export type Pollen = Partial<Record<PollenKey, number | null>>;

export interface AirNow {
	/** Hora local de Menorca, «2026-10-14T13:00». */
	time: string;
	/** Índice europeo de calidad del aire (0–100 y más). */
	aqi: number | null;
	pm25: number | null;
	pm10: number | null;
	o3: number | null;
	no2: number | null;
	uv: number | null;
	pollen: Pollen;
}

export interface AirHour {
	time: string;
	aqi: number | null;
	uv: number | null;
}

/** Máximos de cada día. */
export interface AirDay {
	date: string;
	aqi: number | null;
	uv: number | null;
	pollen: Pollen;
}

export interface AirData {
	place: string;
	now: AirNow;
	hours: AirHour[];
	days: AirDay[];
}

const known = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** Índice europeo con los tramos que documenta Open-Meteo: 0–20 bueno … más de 100 extremo. */
export function aqiLevel(v: number | null | undefined): Level | null {
	if (!known(v)) return null;
	if (v <= 20) return { label: 'Bueno', tone: 'ok' };
	if (v <= 40) return { label: 'Razonable', tone: 'ok' };
	if (v <= 60) return { label: 'Moderado', tone: 'mid' };
	if (v <= 80) return { label: 'Malo', tone: 'bad' };
	if (v <= 100) return { label: 'Muy malo', tone: 'bad' };
	return { label: 'Extremo', tone: 'bad' };
}

/** Índice UV con los tramos de la OMS. */
export function uvLevel(v: number | null | undefined): Level | null {
	if (!known(v)) return null;
	if (v < 2.5) return { label: 'Bajo', tone: 'ok' };
	if (v < 5.5) return { label: 'Moderado', tone: 'mid' };
	if (v < 7.5) return { label: 'Alto', tone: 'mid' };
	if (v < 10.5) return { label: 'Muy alto', tone: 'bad' };
	return { label: 'Extremo', tone: 'bad' };
}

// Granos/m³ desde los que el nivel es moderado y alto. Orientativos: los tramos habituales de la SEAIC
// para olivo y gramíneas; para el resto, los usuales en Europa.
const POLLEN_STEPS: Record<PollenKey, [number, number]> = {
	olive: [51, 201],
	grass: [26, 51],
	birch: [31, 101],
	alder: [31, 101],
	mugwort: [11, 31],
	ragweed: [11, 31]
};

export function pollenLevel(key: PollenKey, v: number | null | undefined): Level | null {
	if (!known(v)) return null;
	const [mid, high] = POLLEN_STEPS[key];
	if (v < 1) return { label: 'Nulo', tone: 'ok' };
	if (v < mid) return { label: 'Bajo', tone: 'ok' };
	if (v < high) return { label: 'Moderado', tone: 'mid' };
	return { label: 'Alto', tone: 'bad' };
}

export interface PollenHigh {
	key: PollenKey;
	name: string;
	value: number;
	level: Level;
}

/**
 * Los pólenes de un día que llegan a moderado o alto, del más fuerte al más flojo (para alérgicos y para los
 * avisos de casa, F16). Vacío si no hay polen que se note o si CAMS no da polen (fuera de Europa).
 */
export function pollenHigh(day: AirDay | undefined): PollenHigh[] {
	if (!day) return [];
	const rank = (l: Level) => (l.tone === 'bad' ? 2 : 1);
	return POLLEN_KEYS.flatMap((key) => {
		const value = day.pollen[key];
		const level = pollenLevel(key, value);
		return level && level.tone !== 'ok' && known(value) ? [{ key, name: POLLEN_NAMES[key], value, level }] : [];
	}).sort((a, b) => rank(b.level) - rank(a.level) || b.value / POLLEN_STEPS[b.key][1] - a.value / POLLEN_STEPS[a.key][1]);
}

/** ¿Da CAMS polen para este sitio? (fuera de Europa, todo null). */
export const hasPollen = (air: AirData | null | undefined): boolean =>
	!!air?.days.some((d) => POLLEN_KEYS.some((k) => known(d.pollen[k])));

/** Primera y última hora local de un día con UV de 3 o más (cuando conviene protegerse), o null. */
export function uvWindow(hours: AirHour[], date: string): { from: string; to: string } | null {
	const strong = hours.filter((h) => h.time.startsWith(date) && known(h.uv) && h.uv >= 2.5);
	if (!strong.length) return null;
	const end = Number(strong.at(-1)!.time.slice(11, 13)) + 1;
	return { from: strong[0].time.slice(11, 16), to: `${String(end).padStart(2, '0')}:00` };
}

// ---------- Estado del mar (Open-Meteo Marine) ----------

export interface SeaState {
	/** «Costa norte», «Costa sur». */
	name: string;
	/** Punto de referencia: «Fornells», «Son Bou». */
	spot: string;
	now: {
		/** Altura significativa de ola (m), dirección de donde viene (°) y periodo (s). */
		wave: number | null;
		waveDir: number | null;
		wavePeriod: number | null;
		/** Mar de fondo. */
		swell: number | null;
		swellDir: number | null;
		swellPeriod: number | null;
		/** Temperatura del agua (°C). */
		water: number | null;
	};
	daily: { date: string; waveMax: number | null; swellMax: number | null; dir: number | null }[];
}

/** Estado del mar según la escala Douglas, a partir de la altura de ola en metros. */
export function seaLevel(m: number | null | undefined): Level | null {
	if (!known(m)) return null;
	if (m < 0.05) return { label: 'Calma', tone: 'ok' };
	if (m <= 0.1) return { label: 'Rizada', tone: 'ok' };
	if (m <= 0.5) return { label: 'Marejadilla', tone: 'ok' };
	if (m <= 1.25) return { label: 'Marejada', tone: 'mid' };
	if (m <= 2.5) return { label: 'Fuerte marejada', tone: 'mid' };
	if (m <= 4) return { label: 'Gruesa', tone: 'bad' };
	if (m <= 6) return { label: 'Muy gruesa', tone: 'bad' };
	return { label: 'Arbolada o más', tone: 'bad' };
}

// ---------- Sol y luna ----------

export interface SunDay {
	/** Salida y puesta en ISO (UTC). */
	sunrise: string;
	sunset: string;
	/** Duración del día en segundos. */
	daylight: number;
	/** Diferencia con ayer en segundos (positiva: el día se alarga). */
	delta: number | null;
}

/** 39 900 s → «11 h 05 min». */
export function hoursMinutes(seconds: number): string {
	const mins = Math.round(seconds / 60);
	return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}

/** −130 s → «−2 min 10 s»; 92 → «+1 min 32 s». */
export function signedMinSec(seconds: number): string {
	const sign = seconds < 0 ? '−' : '+';
	const total = Math.round(Math.abs(seconds));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return m ? `${sign}${m} min ${s} s` : `${sign}${s} s`;
}

const SYNODIC = 29.530588853;
/** Luna nueva de referencia: 6 de enero de 2000, 18:14 UTC. */
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);

const PHASES = [
	'Luna nueva',
	'Creciente',
	'Cuarto creciente',
	'Gibosa creciente',
	'Luna llena',
	'Gibosa menguante',
	'Cuarto menguante',
	'Menguante'
];

export interface Moon {
	/** Días desde la luna nueva (0–29,5). */
	age: number;
	/** Fracción iluminada (0–1). */
	illumination: number;
	name: string;
	/** Si crece (de nueva a llena). */
	waxing: boolean;
}

/**
 * Fase de la luna con el mes sinódico medio. Es aproximada (la luna real se adelanta o se retrasa hasta
 * unas 14 horas), de sobra para saber en qué fase estamos.
 */
export function moon(ms: number): Moon {
	const days = (ms - NEW_MOON_REF) / 86_400_000;
	const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
	const frac = age / SYNODIC;
	return {
		age,
		illumination: (1 - Math.cos(2 * Math.PI * frac)) / 2,
		name: PHASES[Math.round(frac * 8) % 8],
		waxing: frac < 0.5
	};
}

// ---------- Avisos meteorológicos (MeteoAlarm, con los avisos de AEMET) ----------

export type AlertColor = 'yellow' | 'orange' | 'red';

export const ALERT_NAMES: Record<AlertColor, string> = {
	yellow: 'Amarillo',
	orange: 'Naranja',
	red: 'Rojo'
};

export interface WxAlert {
	id: string;
	level: AlertColor;
	/** «Tormentas», «Costeros»… */
	hazard: string;
	/** Zona tal como la nombra el aviso: «Menorca», «Costa de Menorca»… */
	area: string;
	onset: string;
	expires: string;
	url: string;
}

export interface AlertsData {
	zone: string;
	alerts: WxAlert[];
}

/** Avisos de un país europeo (MeteoAlarm), resumidos: recuento por color y zonas en naranja o rojo. */
export interface EuAlertCountry {
	/** Código ISO del país: «ES». */
	code: string;
	counts: Record<AlertColor, number>;
	/** Zonas con aviso naranja o rojo, la más grave primero: un aviso por zona con sus fenómenos. */
	zones: { area: string; level: Exclude<AlertColor, 'yellow'>; hazards: string[]; url: string }[];
}

export interface AlertsEuData {
	countries: EuAlertCountry[];
}
