import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withLang } from '../sources/news.ts';
import { mergeDay, mergeSections } from '../sources/imp.ts';
import {
	LIMITS,
	loadCache,
	pickTitles,
	redact,
	titleKey,
	translateHeadlines,
	translateTitles,
	type TranslationCache
} from '../translate.ts';
import type { ImpData, NewsItem } from '../../src/lib/types.ts';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const EMAIL = 'alguien.secundario@example.com';

/** MyMemory de mentira: «Hello» → «[es] Hello». */
function fakeApi(reply?: (q: string) => Response | object) {
	return vi.fn(async (input: string | URL | Request) => {
		const q = new URL(String(input)).searchParams.get('q') ?? '';
		const r = reply?.(q) ?? { responseStatus: 200, responseData: { translatedText: `[es] ${q}` } };
		return r instanceof Response ? r : Response.json(r);
	}) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const empty = (): TranslationCache => ({ day: '2026-10-14', chars: 0, entries: {} });
const item = (title: string, lang?: 'en'): NewsItem => ({
	title,
	url: `https://x.example/${encodeURIComponent(title)}`,
	source: 'BBC',
	time: null,
	summary: '',
	...(lang && { lang })
});

describe('translateTitles', () => {
	it('traduce y guarda por hash; lo ya traducido no se vuelve a pedir', async () => {
		const api = fakeApi();
		const first = await translateTitles(['Oil prices rise', 'Peace talks resume'], empty(), {
			email: EMAIL,
			fetchFn: api,
			now: NOW
		});
		expect(first.done).toBe(2);
		expect(first.cache.entries[titleKey('Oil prices rise')].es).toBe('[es] Oil prices rise');
		expect(first.cache.chars).toBe('Oil prices rise'.length + 'Peace talks resume'.length);

		// Mismo titular con otras mayúsculas o espacios: cuenta como el mismo.
		const again = await translateTitles(['Oil prices rise', 'oil  prices rise', 'New one'], first.cache, {
			email: EMAIL,
			fetchFn: api,
			now: NOW
		});
		expect(again.done).toBe(1);
		expect(api).toHaveBeenCalledTimes(3);
	});

	it('no pasa del tope diario ni del de la pasada', async () => {
		const api = fakeApi();
		const nearlyFull = { ...empty(), chars: LIMITS.dailyChars - 10 };
		const r = await translateTitles(['Twelve chars', 'short'], nearlyFull, { email: EMAIL, fetchFn: api, now: NOW });
		expect(r.done).toBe(1); // solo cabe «short»
		expect(r.cache.chars).toBeLessThanOrEqual(LIMITS.dailyChars);

		const many = Array.from({ length: 200 }, (_, i) => `Headline number ${i} about something long enough`);
		const run = await translateTitles(many, empty(), { email: EMAIL, fetchFn: fakeApi(), now: NOW });
		expect(run.sent).toBeLessThanOrEqual(LIMITS.runChars);
		expect(run.done).toBeLessThan(200);
	});

	it('el contador vuelve a cero cada día', () => {
		const ayer = { day: '2026-10-13', chars: 39_000, full: true as const, entries: {} };
		expect(loadCache(ayer, NOW)).toEqual({ day: '2026-10-14', chars: 0, entries: {} });
	});

	it('con 429 o cupo agotado, para y se queda en inglés hasta mañana', async () => {
		const api = fakeApi(() => new Response('', { status: 429 }));
		const r = await translateTitles(['A', 'B', 'C', 'D'], empty(), { email: EMAIL, fetchFn: api, now: NOW });
		expect(r.done).toBe(0);
		expect(r.cache.full).toBe(true);
		const later = await translateTitles(['E'], r.cache, { email: EMAIL, fetchFn: api, now: NOW });
		expect(later.done).toBe(0);
		expect(api.mock.calls.length).toBeLessThanOrEqual(LIMITS.concurrency);

		// MyMemory a veces responde 200 con el aviso dentro del texto.
		const warn = fakeApi(() => ({
			responseStatus: 200,
			responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY' }
		}));
		const w = await translateTitles(['A'], empty(), { email: EMAIL, fetchFn: warn, now: NOW });
		expect(w.cache.entries).toEqual({});
		expect(w.cache.full).toBe(true);
	});

	it('si la red falla, no lanza y deja de insistir', async () => {
		const api = vi.fn(async () => {
			throw new TypeError('fetch failed');
		}) as unknown as typeof fetch;
		const r = await translateTitles(['A', 'B', 'C', 'D', 'E', 'F', 'G'], empty(), {
			email: EMAIL,
			fetchFn: api,
			now: NOW
		});
		expect(r.done).toBe(0);
		expect(r.stopped).toMatch(/MyMemory no responde/);
	});

	it('manda el correo en de= y el par en|es', async () => {
		const api = fakeApi();
		await translateTitles(['Hello'], empty(), { email: EMAIL, fetchFn: api, now: NOW });
		const url = new URL(String(api.mock.calls[0][0]));
		expect(url.searchParams.get('de')).toBe(EMAIL);
		expect(url.searchParams.get('langpair')).toBe('en|es');
	});
});

describe('pickTitles', () => {
	it('solo inglés; primero IMP, luego TOP (3 por sección), luego GEO y ECO', () => {
		const news = {
			es: [item('Titular en español')],
			tech: [item('T1', 'en'), item('T2', 'en'), item('T3', 'en'), item('T4', 'en')],
			geo: [item('G1', 'en')]
		};
		const imp = {
			date: '2026-10-14',
			current: [{ k: 'a', title: 'I1', lang: 'en', url: '', sources: [], score: 1 }],
			days: [],
			seen: []
		} as unknown as ImpData;
		expect(pickTitles(news, imp)).toEqual(['I1', 'G1', 'T1', 'T2', 'T3', 'G1']);
	});
});

it('redact quita el correo, también codificado', () => {
	expect(redact(`https://api?de=${encodeURIComponent(EMAIL)}&x=${EMAIL}`, EMAIL)).toBe(
		'https://api?de=[correo]&x=[correo]'
	);
});

it('withLang marca los medios en inglés', () => {
	expect(withLang([item('x')], 'BBC')[0].lang).toBe('en');
	expect(withLang([item('x')], 'El País')[0].lang).toBeUndefined();
});

it('IMP conserva la traducción del día si el titular no cambia', () => {
	const before = [
		{ k: 'a', title: 'Oil', lang: 'en' as const, titleEs: 'Petróleo', url: '', sources: ['BBC'], score: 1 }
	];
	const now = [{ k: 'a', title: 'Oil', url: '', sources: ['DW'], score: 5 }];
	expect(mergeDay(before, now)[0]).toMatchObject({ titleEs: 'Petróleo', score: 5 });
});

describe('translateHeadlines (la fuente translations)', () => {
	let dir: string;
	const logs: string[] = [];
	const log = (l: string) => logs.push(l);

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'arc-translate-'));
		logs.length = 0;
		const geo = {
			name: 'news-geo',
			fetchedAt: '',
			data: { items: [item('Ceasefire holds', 'en'), item('Alto el fuego')], feeds: [] }
		};
		await writeFile(join(dir, 'news-geo.json'), JSON.stringify(geo));
		const imp = {
			name: 'imp',
			fetchedAt: '',
			data: {
				date: '2026-10-14',
				current: [{ k: 'a', title: 'Ceasefire holds', lang: 'en', url: '', sources: [], score: 3 }],
				days: [],
				seen: []
			}
		};
		await writeFile(join(dir, 'imp.json'), JSON.stringify(imp));
	});
	afterEach(() => rm(dir, { recursive: true, force: true }));

	const read = async (name: string) => JSON.parse(await readFile(join(dir, `${name}.json`), 'utf8'));
	const everything = async () =>
		(await Promise.all((await readdir(dir)).map((f) => readFile(join(dir, f), 'utf8')))).join('\n');

	it('sin el Secret no llama a nadie, no toca los archivos y todo sigue en inglés', async () => {
		const api = fakeApi();
		const before = await everything();
		const cache = await translateHeadlines({ dir, email: undefined, previous: undefined, fetchFn: api, now: NOW, log });
		expect(api).not.toHaveBeenCalled();
		expect(cache.entries).toEqual({});
		expect(await everything()).toBe(before);
		expect(logs.join('\n')).toMatch(/sin MYMEMORY_EMAIL/);
		expect(logs.join('\n')).not.toMatch(/warning/);
	});

	it('con el Secret pone titleEs en las secciones y en IMP, y devuelve la caché', async () => {
		const cache = await translateHeadlines({
			dir,
			email: EMAIL,
			previous: undefined,
			fetchFn: fakeApi(),
			now: NOW,
			log
		});
		const geo = (await read('news-geo')).data.items;
		expect(geo[0].titleEs).toBe('[es] Ceasefire holds');
		expect(geo[1].titleEs).toBeUndefined();
		expect((await read('imp')).data.current[0]).toMatchObject({ lang: 'en', titleEs: '[es] Ceasefire holds' });
		expect(Object.keys(cache.entries)).toHaveLength(1);
	});

	it('el correo no sale en el registro ni en los archivos, ni siquiera si un error lo lleva dentro', async () => {
		const leaky = vi.fn(async (input: string | URL | Request) => {
			throw new Error(`fallo al pedir ${String(input)} para ${EMAIL}`);
		}) as unknown as typeof fetch;
		const a = await translateHeadlines({ dir, email: EMAIL, previous: undefined, fetchFn: leaky, now: NOW, log });
		const b = await translateHeadlines({ dir, email: EMAIL, previous: a, fetchFn: fakeApi(), now: NOW, log });
		const all = `${logs.join('\n')}\n${await everything()}\n${JSON.stringify([a, b])}`;
		expect(all).not.toContain(EMAIL);
		expect(all).not.toContain(encodeURIComponent(EMAIL));
		expect(all).not.toContain('alguien.secundario');
	});
});

it('IMP marca en inglés los temas cuyo titular principal lo está', () => {
	const groups = mergeSections(
		{ geo: [{ ...item('Ceasefire holds', 'en'), time: new Date(NOW - 3_600_000).toISOString() }] },
		NOW
	);
	expect(groups[0].lang).toBe('en');
});

it('la fuente translations va en una oleada posterior a IMP', async () => {
	const { waves } = await import('../lib.ts');
	const { imp } = await import('../sources/imp.ts');
	const { translations } = await import('../sources/translate.ts');
	const order = waves([translations, imp]).map((w) => w.map((s) => s.name));
	expect(order).toEqual([['imp'], ['translations']]);
});
