// El MANUAL se genera de los registros: estos tests fallan si algo queda sin documentar.
import { describe, expect, it } from 'vitest';
import { QUOTAS } from '../../scripts/alerts/config.ts';
import { resolveInput } from './cmdline.ts';
import { COMMANDS, MANUAL_SECTIONS } from './commands.ts';
import { ALERT_LEVELS, commandText, FAQ, matches } from './manual.ts';
import { isDocumented, PREFS } from './prefs.ts';
import { SHORTCUTS } from './shortcuts.ts';

/** Todo el código de src, como texto. */
const sources = import.meta.glob<string>('/src/**/*.{ts,svelte}', { query: '?raw', import: 'default', eager: true });

describe('comandos en el manual', () => {
	it('todos tienen ficha, con qué hacen y una sección válida', () => {
		for (const c of COMMANDS) {
			expect(c.manual, c.code).toBeDefined();
			expect(c.manual!.what.trim(), c.code).not.toBe('');
			expect(MANUAL_SECTIONS, c.code).toContain(c.manual!.section);
			for (const p of c.manual!.panels ?? []) expect(p.name && p.what, `${c.code}: ${p.name}`).toBeTruthy();
		}
	});

	it('cada vista tiene comando y cada comando, su vista (salvo la ficha de un valor, /s)', () => {
		const pages = Object.keys(import.meta.glob('/src/routes/**/+page.svelte')).map(
			(path) => path.replace(/^\/src\/routes/, '').replace(/\/\+page\.svelte$/, '') || '/'
		);
		const routes = COMMANDS.map((c) => c.route as string);
		for (const page of pages.filter((p) => p !== '/s')) expect(routes, `vista ${page} sin comando`).toContain(page);
		for (const route of routes) expect(pages, `comando sin vista: ${route}`).toContain(route);
	});

	it('cada ejemplo, escrito en la barra, abre su comando (y con el texto, si lo acepta)', () => {
		for (const c of COMMANDS) {
			for (const a of c.manual?.args ?? []) {
				expect(a.examples.length, c.code).toBeGreaterThan(0);
				for (const ex of a.examples) {
					const t = resolveInput(ex, []);
					expect(t?.kind, ex).toBe('command');
					if (t?.kind !== 'command') continue;
					expect(t.command.code, ex).toBe(c.code);
					if (c.arg) expect(t.arg, ex).toBeTruthy();
				}
			}
			// El ejemplo de la ayuda (arg.example) también tiene que abrir su comando.
			if (c.arg) {
				const t = resolveInput(c.arg.example, []);
				expect(t?.kind === 'command' && t.command.code, c.arg.example).toBe(c.code);
			}
		}
	});

	it('los comandos con texto detrás tienen ejemplos en el manual', () => {
		for (const c of COMMANDS.filter((c) => c.arg)) expect(c.manual?.args?.length, c.code).toBeGreaterThan(0);
	});
});

describe('atajos', () => {
	it('todos tienen teclas (o cómo se hace) y lo que hacen', () => {
		for (const s of SHORTCUTS) {
			expect(s.keys.length > 0 || ('how' in s && s.how), s.id).toBeTruthy();
			expect(s.action.trim(), s.id).not.toBe('');
		}
	});

	it('el manual los pinta desde SHORTCUTS, sin lista escrita a mano', () => {
		const page = sources['/src/routes/manual/+page.svelte'];
		expect(page).toContain('SHORTCUTS');
		expect(page).not.toMatch(/<kbd>[^{<]/);
	});
});

describe('lo que se guarda en el navegador', () => {
	it('toda clave que usa el código está en PREFS', () => {
		const found = new Set<string>();
		for (const [path, text] of Object.entries(sources)) {
			if (path.endsWith('.test.ts') || path.endsWith('/lib/prefs.ts')) continue;
			for (const m of text.matchAll(/['"`](arc-[a-z:-]+|fuel-zone)/g)) found.add(m[1]);
		}
		expect(found.size).toBeGreaterThan(10);
		const missing = [...found].filter((k) => !isDocumented(k));
		expect(missing).toEqual([]);
	});

	it('cada clave dice qué guarda y dónde, sin repetirse', () => {
		for (const p of PREFS) expect(p.what && p.where, p.key).toBeTruthy();
		expect(new Set(PREFS.map((p) => p.key)).size).toBe(PREFS.length);
	});
});

describe('avisos al móvil', () => {
	it('explica los cuatro niveles con su cupo de config.ts', () => {
		expect(ALERT_LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4]);
		for (const l of ALERT_LEVELS) {
			expect(l.what.length, `P${l.level}`).toBeGreaterThan(0);
			expect(l.quota ?? Infinity).toBe(QUOTAS[l.level]);
		}
	});
});

describe('buscador', () => {
	it('compara sin tildes ni mayúsculas y pide todas las palabras', () => {
		expect(matches('Precio de la luz', 'LUZ precio')).toBe(true);
		expect(matches('Sin conexión', 'conexion')).toBe(true);
		expect(matches('Sin conexión', 'conexion wifi')).toBe(false);
		expect(matches('lo que sea', '  ')).toBe(true);
	});

	it('encuentra un comando por un panel suyo', () => {
		const eco = COMMANDS.find((c) => c.code === 'ECO')!;
		expect(matches(commandText(eco), 'hipoteca')).toBe(true);
	});

	it('las preguntas frecuentes tienen respuesta', () => {
		expect(FAQ.length).toBeGreaterThanOrEqual(5);
		for (const f of FAQ) expect(f.a.trim(), f.q).not.toBe('');
	});
});
