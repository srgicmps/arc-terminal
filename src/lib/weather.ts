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
