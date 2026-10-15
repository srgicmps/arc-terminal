// F22: boletines de zonas de conflicto (CZIB) de la EASA, la agencia europea de seguridad aérea. Cada CZIB avisa
// a las aerolíneas de un espacio aéreo con riesgo (misiles, drones, guerra) y recomienda no volar o hacerlo por
// encima de cierta altura. Tipos y nombres en español; la descarga está en scripts/sources/czib.ts.

export interface Czib {
	/** «CZIB-2022-01R14». */
	id: string;
	/** Zona en español: «Ucrania», «Golfo Pérsico y golfo de Omán». */
	area: string;
	/** La zona tal cual la escribe la EASA, sin «Airspace of». */
	areaEn: string;
	/** Fechas ISO (AAAA-MM-DD); sin revisión o sin fecha de fin, null. */
	issued: string;
	revised: string | null;
	validUntil: string | null;
	url: string;
}

export interface CzibData {
	items: Czib[];
}

/** Zonas que no son un país (o que se escriben distinto), en español y con su centro para el mapa. */
export const AREAS: Record<string, { name: string; at?: [number, number] }> = {
	'the persian gulf and gulf of oman': { name: 'Golfo Pérsico y golfo de Omán', at: [26.2, 54.5] },
	'saudi arabia': { name: 'Arabia Saudí' },
	jordan: { name: 'Jordania' },
	lebanon: { name: 'Líbano' },
	iraq: { name: 'Irak' },
	iran: { name: 'Irán' },
	israel: { name: 'Israel' },
	sudan: { name: 'Sudán' },
	'south sudan': { name: 'Sudán del Sur' },
	ukraine: { name: 'Ucrania' },
	russia: { name: 'Rusia' },
	'russian federation': { name: 'Rusia' },
	belarus: { name: 'Bielorrusia' },
	afghanistan: { name: 'Afganistán' },
	mali: { name: 'Malí' },
	libya: { name: 'Libia' },
	syria: { name: 'Siria' },
	somalia: { name: 'Somalia' },
	egypt: { name: 'Egipto' },
	ethiopia: { name: 'Etiopía' },
	venezuela: { name: 'Venezuela' },
	'north korea': { name: 'Corea del Norte' },
	kenya: { name: 'Kenia' },
	niger: { name: 'Níger' },
	'burkina faso': { name: 'Burkina Faso' },
	pakistan: { name: 'Pakistán' },
	yemen: { name: 'Yemen' }
};

/** «Yemen – Sana’a Flight Information Region» → «Yemen (región de vuelo de Saná)». */
export function areaName(en: string): string {
	const [head, ...rest] = en.split(/\s+[–-]\s+/);
	const base = AREAS[head.trim().toLowerCase()]?.name ?? head.trim();
	if (!rest.length) return base;
	const detail = rest
		.join(' – ')
		.replace(/Sana[’']a/i, 'Saná')
		.replace(/^(.+?) Flight Information Region$/i, 'región de vuelo de $1')
		.replace(/ and /g, ' y ')
		.replace(/ provinces?/i, '');
	return `${base} (${detail})`;
}

/** Fecha del CZIB en español corto: «31 ene 2027». */
export const czibDate = (iso: string | null) =>
	iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

/** Frase para el modo Sencillo. */
export function czibSentence(items: Czib[]): string {
	if (!items.length) return '';
	const names = items.slice(0, 4).map((c) => c.area.replace(/ \(.*\)$/, ''));
	const more = items.length > 4 ? ` y ${items.length - 4} más` : '';
	return `La agencia europea de aviación pide precaución o no volar sobre ${items.length === 1 ? 'una zona' : `${items.length} zonas`}: ${names.join(', ')}${more}.`;
}
