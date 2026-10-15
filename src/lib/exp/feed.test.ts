import { describe, expect, it } from 'vitest';
import { dayLabel, filterFeed, isMine, mergeFeed, type FeedItem } from './feed.ts';

const item = (id: string, t: string, topic: FeedItem['topic'], title = id, url?: string): FeedItem => ({ id, t, topic, kind: 'news', title, source: 'X', url });

describe('Feed', () => {
	it('ordena del más reciente al más antiguo y no repite enlaces', () => {
		const out = mergeFeed([[item('imp', '2026-10-15T09:00:00Z', 'eco', 'a', 'u1')], [item('n1', '2026-10-15T10:00:00Z', 'eco', 'a', 'u1'), item('n2', '2026-10-15T11:00:00Z', 'es')]]);
		expect(out.map((i) => i.id)).toEqual(['n2', 'imp']);
	});

	it('filtra por tema y por lo tuyo', () => {
		const items = [item('a', '1', 'eco', 'Nvidia sube un 5 %'), item('b', '1', 'mundo', 'Cumbre en Japón'), item('c', '1', 'eco', 'El BCE')];
		expect(filterFeed(items, ['eco'], false, []).map((i) => i.id)).toEqual(['a', 'c']);
		expect(filterFeed(items, [], true, ['nvidia', 'japon']).map((i) => i.id)).toEqual(['a', 'b']);
		expect(isMine(items[0], [])).toBe(false);
	});

	it('pone Hoy y Ayer en hora de Madrid', () => {
		const now = Date.parse('2026-10-15T10:00:00+02:00');
		expect(dayLabel('2026-10-15T00:30:00+02:00', now)).toBe('Hoy');
		expect(dayLabel('2026-10-14T23:30:00+02:00', now)).toBe('Ayer');
		expect(dayLabel('2026-10-12T12:00:00+02:00', now)).toBe('lunes, 12 de octubre');
	});
});
