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
	return Number.isFinite(deg) ? DIRS[Math.round(deg / 45) % 8] : '';
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
