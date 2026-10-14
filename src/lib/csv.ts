// Exportar una tabla a CSV (botón «⤓ CSV» de ui/Table). Parte sin navegador, con tests.
// Separador «;» y BOM al principio: así lo abre bien Excel en español, con la coma decimal de las cifras.

/**
 * Una celda tal y como se ve, sin los adornos de la interfaz (ⓘ del glosario, flechas de orden). Para que
 * Excel lea los números: el menos tipográfico (−) pasa a guion y la raya de «sin dato» (—) queda vacía.
 */
export function cellText(text: string): string {
	const clean = text
		.replace(/[ⓘ▲▼⤢]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^−(?=\d)/, '-')
		.replace(/(\s)−(?=\d)/g, '$1-');
	return clean === '—' ? '' : clean;
}

/** Comillas solo cuando hacen falta (separador, comillas o salto de línea dentro). */
function field(value: string): string {
	return /[;"\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
	return '﻿' + rows.map((r) => r.map(field).join(';')).join('\r\n') + '\r\n';
}

/** «G20 en cifras» + fecha → «g20-en-cifras-2026-10-14.csv». */
export function csvName(title: string, date: string): string {
	const slug = title
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return `${slug || 'tabla'}-${date}.csv`;
}
