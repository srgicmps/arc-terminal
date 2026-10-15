import { describe, expect, it } from 'vitest';
import { COMMANDS } from './commands.ts';

const files = import.meta.glob('./commands/*.ts', { eager: true, import: 'default' });

describe('registro de comandos', () => {
	it('junta un archivo por comando, cada uno con el nombre de su código', () => {
		expect(COMMANDS).toHaveLength(Object.keys(files).length);
		for (const [path, command] of Object.entries(files)) {
			expect(path).toBe(`./commands/${(command as { code: string }).code.toLowerCase()}.ts`);
		}
	});

	it('mantiene el orden de las teclas (de 10 en 10), sin códigos ni posiciones repetidos', () => {
		// El orden de antes de partir commands.ts en un archivo por comando.
		expect(COMMANDS.map((c) => c.code)).toEqual(
			'TOP IMP SEMANA ECO ECST GEO ES WS WB BTMM G MOST IMAP SEAS TECH AI BOE USGOV LIDER LUZ AGUA WX PORT MIS FUEL CMP EQS RV SIG FONDOS HDS NEWS RSS PAIS WIKI CAL CHESS TV MODO STATUS AVISOS NOVEDADES DOC HELP MANUAL ADMIN'.split(' ')
		);
		expect(new Set(COMMANDS.map((c) => c.code)).size).toBe(COMMANDS.length);
		expect(new Set(COMMANDS.map((c) => c.order)).size).toBe(COMMANDS.length);
	});
});
