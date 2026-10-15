import { describe, expect, it } from 'vitest';
import { cellText, csvName, toCsv } from './csv.ts';

describe('exportar a CSV', () => {
	it('limpia la celda de adornos y espacios', () => {
		expect(cellText('  PIB ▼ ')).toBe('PIB');
		expect(cellText('Prima de España ⓘ\n 57 pb')).toBe('Prima de España 57 pb');
		expect(cellText('−6,5')).toBe('-6,5');
		expect(cellText('12 oct · −0,02')).toBe('12 oct · -0,02');
		expect(cellText('—')).toBe('');
	});

	it('usa «;», BOM y comillas solo cuando hacen falta', () => {
		const csv = toCsv([
			['País', 'PIB'],
			['España', '2,4'],
			['Dicho "así"; raro', '1']
		]);
		expect(csv.startsWith('﻿')).toBe(true);
		expect(csv.slice(1)).toBe('País;PIB\r\nEspaña;2,4\r\n"Dicho ""así""; raro";1\r\n');
	});

	it('da un nombre de archivo sin acentos ni signos', () => {
		expect(csvName('G20 en cifras', '2026-10-14')).toBe('g20-en-cifras-2026-10-14.csv');
		expect(csvName('España frente a Europa', '2026-10-14')).toBe('espana-frente-a-europa-2026-10-14.csv');
		expect(csvName('', '2026-10-14')).toBe('tabla-2026-10-14.csv');
	});
});
