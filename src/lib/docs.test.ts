// CLAUDE.md al día con los comandos: la tabla de «Comandos y fuentes» tiene una fila por cada comando de
// src/lib/commands/ (COMMANDS). Si una sesión añade un comando y no su fila, o se queda la fila de uno que ya
// no existe, o la misma fila sale dos veces, este test lo avisa.
// Solo mira los códigos (la primera columna). Qué abre y sus fuentes se escriben a mano en CLAUDE.md: son más
// ricos que `desc` y `sources` de cada archivo, y es un texto que lee Sergi. Por eso no hay generador.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMANDS } from './commands.ts';

/** Códigos de la tabla que no son comandos: «`NVDA`…» es la ficha de un valor (vale cualquier código de bolsa). */
const NOT_COMMANDS = new Set(['NVDA']);

/**
 * Comandos que no van en la tabla a propósito, con su porqué (código → motivo). Hoy no hay ninguno: si alguno no
 * debe salir, se apunta aquí en lugar de quitar el test.
 */
const UNLISTED: Record<string, string> = {};

/** Los códigos de la primera columna de cada fila de la tabla de «## Comandos y fuentes» («`TECH` / `AI`» da dos). */
function tableRows(markdown: string): string[][] {
	const section = markdown.split(/^## /m).find((s) => s.startsWith('Comandos y fuentes'));
	if (!section) return [];
	return section
		.split('\n')
		.filter((line) => line.startsWith('| `'))
		.map((line) => [...line.split('|')[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]));
}

const rows = tableRows(readFileSync(join(process.cwd(), 'CLAUDE.md'), 'utf8'));
const listed = rows.flat();
const codes = new Set(COMMANDS.map((c) => c.code));

describe('CLAUDE.md: tabla de comandos', () => {
	it('existe y tiene filas', () => {
		expect(rows.length).toBeGreaterThan(0);
	});

	it('cada comando tiene su fila', () => {
		const missing = [...codes].filter((code) => !listed.includes(code) && !(code in UNLISTED));
		expect(missing, 'añade su fila a «Comandos y fuentes» de CLAUDE.md').toEqual([]);
	});

	it('ningún comando sale dos veces', () => {
		const repeated = listed.filter((code, i) => listed.indexOf(code) !== i);
		expect(repeated).toEqual([]);
	});

	it('no sobra ninguna fila', () => {
		const extra = listed.filter((code) => !codes.has(code) && !NOT_COMMANDS.has(code));
		expect(extra, 'ese comando ya no existe en src/lib/commands/').toEqual([]);
	});

	it('los que no se listan a propósito son comandos y no están en la tabla', () => {
		for (const code of Object.keys(UNLISTED)) {
			expect(codes.has(code), code).toBe(true);
			expect(listed.includes(code), code).toBe(false);
		}
	});
});
