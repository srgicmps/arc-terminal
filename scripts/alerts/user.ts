// Reglas de las órdenes de cada uno (barra o AVISOS, guardadas en su cuenta: src/lib/alertconfig.ts):
// alertas de precio propias y palabras vigiladas. Archivo aparte de rules.ts para no mezclarlo con las reglas
// fijas; notify.ts las añade a RULES para Sergi y users.ts, a las de cada usuario.
// - Alerta propia (P1, siempre llega): una sola vez (id user-alert:<id de la alerta>). Al enviarla, notify.ts
//   pide a la web que la borre (/api/alerts?fired=1).
// - Palabras vigiladas (P3): titulares y BOE del índice de búsqueda (search.json) que las nombran. Un aviso
//   por pasada con todo lo nuevo; cada titular, una sola vez (vigila:<hash del enlace>). Una palabra recién
//   añadida no avisa de lo que ya había: eso se da por visto.
import { createHash } from 'node:crypto';
import type { SearchEntry } from '../../src/lib/types.ts';
import { alertHit, alertText, type UserAlert } from '../../src/lib/useralerts.ts';
import { matches } from '../../src/lib/watchwords.ts';
import { minute } from '../history.ts';
import type { AlertConfig } from '../../src/lib/alertconfig.ts';
import { dieselSeries, num, signed, SITE, type Draft, type Inputs, type NotifyLog, type Rule, type RuleContext } from './rules.ts';

/** Lo que leen estas reglas además de Inputs: el índice de búsqueda. */
export type UserInputs = Inputs & { search?: SearchEntry[] };

const list = <T>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);
const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Precio y variación del día de un activo con los datos de esta pasada. */
export function readUserAsset(a: UserAlert, d: UserInputs): { price: number | null; change: number | null; zone: boolean } | null {
	if (a.asset.startsWith('coin:')) {
		const id = a.asset.slice(5);
		const c = list(d.crypto?.coins).find((x) => x?.id === id);
		return c && ok(c.usd) ? { price: c.usd, change: ok(c.change24h) ? c.change24h : null, zone: false } : null;
	}
	if (a.asset === 'diesel') {
		// La zona de Sergi si está configurada (secreto); si no, la media de España.
		const last = dieselSeries(d, d.zone ? 'zona' : 'es').at(-1);
		return last ? { price: last.v, change: null, zone: !!d.zone } : null;
	}
	const q = [...list(d.alertQuotes), ...list(d.finnhub?.quotes)].find((x) => x?.symbol === a.asset);
	return q && ok(q.price) ? { price: q.price, change: ok(q.changePct) ? q.changePct : null, zone: false } : null;
}

export const alertId = (id: string) => `user-alert:${id}`;

/** Lo que leen estas reglas: las alertas (con su id) y las palabras de una cuenta. */
export interface Orders {
	alerts: { id: string; alert: UserAlert }[];
	words: string[] | null;
}

/** Las órdenes de una configuración de AVISOS. */
export const ordersOf = (c: AlertConfig): Orders => ({
	alerts: c.prices.map((p) => ({ id: p.id, alert: p })),
	words: c.words
});

/** Alertas propias que se cumplen ahora. */
export function userAlertRule(req: Orders): Rule {
	return {
		type: 'user-alert',
		level: 1,
		run: (d: UserInputs, { now }: RuleContext): Draft[] =>
			req.alerts.flatMap(({ id, alert }) => {
				const r = readUserAsset(alert, d);
				if (!r || !alertHit(alert, r.price, r.change)) return [];
				const digits = alert.asset === 'diesel' ? 3 : 2;
				const price = r.price === null ? '' : `Ahora: ${num(r.price, digits)}${alert.unit === '$' ? '' : ` ${alert.unit}`}`;
				const change = r.change === null ? '' : ` (${signed(r.change)} % en el día)`;
				const where = alert.asset === 'diesel' && r.zone ? ' · tu zona' : '';
				return [
					{
						id: alertId(id),
						title: `Alerta: ${alertText(alert)}${where}`,
						body: `${price}${change}. La alerta se borra.`,
						tags: 'bell',
						click: alert.asset === 'diesel' ? `${SITE}/fuel` : alert.asset.startsWith('coin:') ? `${SITE}/ws` : `${SITE}/s?sym=${encodeURIComponent(alert.asset)}`,
						time: now
					}
				];
			})
	};
}

const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const WORDS_KEY = 'vigila:palabras';
/** Como mucho, tantos titulares en el cuerpo del aviso. */
const SHOW = 5;

/** Titulares y BOE nuevos que nombran alguna palabra vigilada. */
export function watchRule(req: Orders): Rule {
	return {
		type: 'vigila',
		level: 3,
		run: (d: UserInputs, { now, log, update }: RuleContext): Draft[] => {
			const words = req.words ?? [];
			if (!words.length) return [];
			const known: string[] = (() => {
				try {
					const v = JSON.parse(log.last[WORDS_KEY] ?? '[]');
					return Array.isArray(v) ? v : [];
				} catch {
					return [];
				}
			})();
			const fresh = new Set(words.filter((w) => !known.includes(w.toLowerCase())));
			const seen = new Set(log.entries.map((e) => e.k));
			const hits = list(d.search)
				.filter((e) => (e?.s === 'NEWS' || e?.s === 'BOE') && typeof e.t === 'string' && typeof e.u === 'string')
				.map((e) => ({ e, id: `vigila:${hash(e.u)}`, w: matches(e.t, words) }))
				.filter((h) => h.w.length && !seen.has(h.id));
			const mark = (items: typeof hits) => (l: NotifyLog) => {
				for (const h of items) l.entries.push({ k: h.id, t: minute(now), s: 'baseline' });
			};
			// Palabras nuevas: lo que ya había se da por visto, sin avisar.
			const old = hits.filter((h) => h.w.every((w) => fresh.has(w)));
			const news = hits.filter((h) => !h.w.every((w) => fresh.has(w)));
			update((l) => {
				mark(old)(l);
				l.last[WORDS_KEY] = JSON.stringify(words.map((w) => w.toLowerCase()));
			});
			if (!news.length) return [];
			const lines = news.slice(0, SHOW).map((h) => `«${h.w.join('», «')}» · ${h.e.s === 'BOE' ? 'BOE: ' : ''}${h.e.t}`);
			const more = news.length > SHOW ? `\n… y ${news.length - SHOW} más` : '';
			return [
				{
					id: `vigila:aviso:${minute(now)}`,
					title: news.length === 1 ? 'Palabra vigilada' : `Palabras vigiladas · ${news.length}`,
					body: lines.join('\n') + more,
					tags: 'mag',
					click: news.length === 1 && /^https:\/\//.test(news[0].e.u) ? news[0].e.u : `${SITE}/news`,
					time: now,
					commit: mark(news)
				}
			];
		}
	};
}

/** Las reglas de las órdenes de una cuenta. */
export const userRules = (req: Orders): Rule[] => [userAlertRule(req), watchRule(req)];

/** Las alertas que ya han avisado (o fallado: no se reintentan) según un historial: sus ids. */
export const firedIds = (req: Orders, log: NotifyLog): string[] => {
	const tried = new Set(log.entries.filter((e) => e.s !== 'baseline').map((e) => e.k));
	return req.alerts.filter((a) => tried.has(alertId(a.id))).map((a) => a.id);
};
