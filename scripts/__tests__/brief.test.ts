import { describe, expect, it } from 'vitest';
import { parseBrief, parseConfig } from '../../src/lib/alertconfig.ts';
import { briefAlert, briefDue, briefLines, weatherLine } from '../alerts/brief.ts';
import { emptyLog, type Alert, type Inputs } from '../alerts/rules.ts';
import { runUsers, type BriefMail, type Engine } from '../alerts/users.ts';
import { baselineLog, HELLO, pickAlerts, trim } from '../notify.ts';
import { minute } from '../history.ts';

const AT_8 = Date.parse('2026-10-14T06:10:00Z'); // 08:10 en Madrid
const PLACE = { name: 'Madrid', lat: 40.42, lon: -3.7 };
const config = (brief: object, extra: object = {}) => parseConfig({ on: true, brief: { on: true, at: '08:00', ...brief }, ...extra });

const d: Inputs = {
	imp: {
		current: [
			{ k: '1', title: 'Cumbre en Bruselas', sections: ['world'], score: 9 },
			{ k: '2', title: 'Nvidia presenta un chip', sections: ['tech'], score: 8 },
			{ k: '3', title: 'El petróleo sube', sections: ['ws'], score: 7 }
		]
	},
	alertQuotes: [
		{ symbol: 'NVDA', price: 1, change: 1, changePct: 3.21, prevClose: 1, time: null },
		{ symbol: 'AAPL', price: 1, change: 1, changePct: -0.5, prevClose: 1, time: null },
		{ symbol: 'MSFT', price: 1, change: 1, changePct: 9, prevClose: 1, time: null }
	] as Inputs['alertQuotes'],
	finnhub: { earnings: [{ date: '2026-10-14', symbol: 'NVDA', hour: 'amc' }] } as unknown as Inputs['finnhub']
};

describe('Tu mañana', () => {
	it('parseBrief: horas válidas, sitio redondeado (≈1 km), lo demás por defecto', () => {
		expect(parseBrief({ on: true, at: '03:00', place: { name: ' Madrid ', lat: 40.41678, lon: -3.70379 } })).toEqual({
			on: true,
			at: '08:00',
			email: false,
			place: { name: 'Madrid', lat: 40.42, lon: -3.7 }
		});
		expect(parseBrief({ place: { name: 'X', lat: 200, lon: 0 } }).place).toBeNull();
		expect(parseConfig({}).brief.on).toBe(false);
	});

	it('toca a partir de su hora, hasta 3 h, una vez al día y solo con los avisos activados', () => {
		const c = config({ at: '08:00' });
		expect(briefDue(c, emptyLog(), AT_8)).toBe(true);
		expect(briefDue(c, emptyLog(), AT_8 - 20 * 60_000)).toBe(false);
		expect(briefDue(c, emptyLog(), AT_8 + 4 * 3600_000)).toBe(false);
		expect(briefDue(c, { ...emptyLog(), entries: [{ k: 'brief:2026-10-14', t: '', s: 'sent' }] }, AT_8)).toBe(false);
		expect(briefDue({ ...c, on: false }, emptyLog(), AT_8)).toBe(false);
	});

	it('lo 5 que importa: tiempo, sus valores, su agenda y titulares de sus temas primero', () => {
		const c = config({ place: PLACE }, { mis: ['NVDA', 'AAPL'], groups: ['tech'] });
		const lines = briefLines(c, d, '2026-10-14', new Set(['MSFT']), { min: 9.4, max: 21.2, rain: 40, code: 61 });
		expect(lines).toEqual([
			'Madrid: 9–21 °C, lluvia (40 %).',
			'Tus valores ayer: NVDA +3,2 % · AAPL −0,5 %.',
			'Hoy presentan resultados: NVDA (al cierre).',
			'Nvidia presenta un chip.',
			'Cumbre en Bruselas.'
		]);
		// MSFT no es suyo: no sale aunque se mueva más.
		expect(lines.join(' ')).not.toContain('MSFT');
	});

	it('sin nada suyo, titulares; el aviso dice el día', () => {
		const lines = briefLines(config({}), d, '2026-10-14', new Set(), null);
		expect(lines[0]).toBe('Cumbre en Bruselas.');
		const a = briefAlert(lines, AT_8);
		expect(a.id).toBe('brief:2026-10-14');
		expect(a.title).toBe('Tu mañana · miércoles, 14 de octubre');
		expect(briefAlert([], AT_8).body).toContain('nada destacado');
		expect(weatherLine('Oslo', { min: -1, max: 3, rain: 10, code: null })).toBe('Oslo: -1–3 °C.');
		expect(weatherLine('Roma', { min: 15, max: 25, rain: 50, code: 2 })).toBe('Roma: 15–25 °C, nubes y claros, 50 % de lluvia.');
	});

	it('runUsers: lo manda una vez, por su tema, con el tiempo de su sitio, y deja el email aparte (sin email)', async () => {
		const sent: { topic: string; alert: Alert }[] = [];
		const asked: string[] = [];
		const e: Engine = {
			pickAlerts,
			baselineLog,
			trim,
			hello: HELLO,
			minute,
			post: async (topic, alert) => (sent.push({ topic, alert }), { status: 200 }),
			weather: async (lat, lon) => (asked.push(`${lat},${lon}`), { min: 10, max: 20, rain: 0, code: 0 })
		};
		const ana = { uid: 'a'.repeat(16), topic: `arc-${'a'.repeat(32)}`, config: config({ place: PLACE, email: true }) };
		const luis = { uid: 'b'.repeat(16), topic: `arc-${'b'.repeat(32)}`, config: config({ place: PLACE }) };
		const logs = { [ana.uid]: emptyLog(), [luis.uid]: emptyLog() };
		const mails: BriefMail[] = [];
		const next = await runUsers([ana, luis], d, new Set(), logs, AT_8, e, () => {}, [], mails);
		const briefs = sent.filter((s) => s.alert.type === 'brief');
		expect(briefs.map((s) => s.topic)).toEqual([ana.topic, luis.topic]);
		expect(briefs[0].alert.body).toContain('Madrid: 10–20 °C, despejado.');
		// Un sitio, una consulta.
		expect(asked).toEqual(['40.42,-3.7']);
		expect(mails).toEqual([{ uid: ana.uid, subject: briefs[0].alert.title, text: briefs[0].alert.body }]);
		expect(JSON.stringify(mails)).not.toContain('@');
		// Media hora después, ya no.
		sent.length = 0;
		await runUsers([ana, luis], d, new Set(), next, AT_8 + 30 * 60_000, e, () => {}, [], []);
		expect(sent.filter((s) => s.alert.type === 'brief')).toHaveLength(0);
	});
});
