// Avisos de guerra (P1) y su relación con los de conflictos (P2).
import { describe, expect, it } from 'vitest';
import { WAR } from '../alerts/config.ts';
import { conflictRule, emptyLog, madrid, warKind, warRule, type Inputs, type NotifyLog, type Rule, type RuleContext } from '../alerts/rules.ts';

const NOW = Date.parse('2026-10-14T10:00:00Z');
const HOUR = 3_600_000;

function run(rule: Rule['run'], d: Inputs, log: NotifyLog = emptyLog(), now = NOW) {
	const ctx: RuleContext = { now, today: madrid(now).date, log, update: () => {} };
	const alerts = rule(d, ctx);
	return { alerts, ids: alerts.map((a) => a.id) };
}

// Tema de IMP (current[]) con la forma de ImpCurrent; los medios, con nombres reales de las fuentes.
const topic = (k: string, title: string, sources: string[]) => ({
	k,
	title,
	url: `https://example.org/${k}`,
	sources,
	sections: ['geo'],
	score: 20
});
const three = ['BBC', 'El País', 'DW'];
const kind = (title: string) => (warKind(title) < 0 ? null : WAR.kinds[warKind(title)].key);

describe('Guerras (P1)', () => {
	it('reconoce cada clase, en español e inglés, y no salta con noticias parecidas', () => {
		expect(kind('Rusia declara la guerra a Moldavia')).toBe('war');
		expect(kind('Russia declares war on Moldova')).toBe('war');
		expect(kind('China invade Taiwán')).toBe('invasion');
		expect(kind('Drones rusos atacan Polonia')).toBe('nato');
		expect(kind('Russian missiles hit Kyiv power grid')).toBe('missiles');
		expect(kind('Putin amenaza con un ataque nuclear')).toBe('nuclear');
		expect(kind('Ucrania decreta la movilización general')).toBe('mobilization');
		expect(kind('Israel y Hamás firman un alto el fuego')).toBe('ceasefire');
		expect(kind('Ceasefire in Gaza collapses')).toBe('ceasefire');
		// Lo que no es: huelgas, negociaciones o titulares sin hecho grave.
		expect(kind('Germany rail strike halts trains')).toBeNull();
		expect(kind('USA and Iran resume nuclear talks')).toBeNull();
		expect(kind('Ceasefire talks continue in Doha')).toBeNull();
		expect(kind('El BCE baja los tipos')).toBeNull();
	});

	it('P1 con 3 medios fiables; con menos, o con medios que no cuentan, nada', () => {
		const d: Inputs = {
			imp: {
				current: [
					topic('a', 'Rusia declara la guerra a Moldavia', three),
					topic('b', 'China invade Taiwán', ['BBC', 'El País']),
					topic('c', 'China invade Taiwán', ['BBC', 'Blog', 'Foro', 'Otro'])
				]
			}
		};
		const { alerts } = run(warRule, d);
		expect(alerts.map((a) => a.id)).toEqual(['war:a:2026-10-14T10:00Z']);
		expect(alerts[0].title).toBe('🚨 Declaración de guerra');
		expect(alerts[0].body).toBe('Rusia declara la guerra a Moldavia · 3 medios (3 fiables)\nhttps://example.org/a');
	});

	it('un aviso por tema cada 4 h, salvo escalada (clase más grave o el doble de medios fiables)', () => {
		const first = run(warRule, { imp: { current: [topic('a', 'Drones rusos atacan Polonia', three)] } });
		const log = emptyLog();
		first.alerts[0].commit!(log);
		const same = { imp: { current: [topic('a', 'Drones rusos atacan Polonia', [...three, 'RTVE'])] } };
		expect(run(warRule, same, log, NOW + 3 * HOUR).ids).toEqual([]);
		expect(run(warRule, same, log, NOW + 4 * HOUR).ids).toHaveLength(1);
		const worse = { imp: { current: [topic('a', 'Rusia invade Polonia', three)] } };
		expect(run(warRule, worse, log, NOW + HOUR).alerts[0].title).toBe('🚨 Invasión');
		const wider = { imp: { current: [topic('a', 'Drones rusos atacan Polonia', [...three, 'RTVE', 'WSJ', 'France 24'])] } };
		expect(run(warRule, wider, log, NOW + HOUR).ids).toHaveLength(1);
	});

	it('lo que avisa como guerra no sale además como conflicto; el resto de conflictos, sí', () => {
		const d: Inputs = {
			imp: {
				current: [
					topic('a', 'Rusia declara la guerra a Moldavia', [...three, 'RTVE', 'WSJ', 'France 24']),
					topic('b', 'Nueva ofensiva en el Donbás', ['BBC', 'DW', 'El País', 'RTVE', 'WSJ'])
				]
			}
		};
		expect(run(conflictRule, d).ids).toEqual(['conflict:b:2026-10-14T10:00Z']);
	});
});
