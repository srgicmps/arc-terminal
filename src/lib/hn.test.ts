import { describe, expect, it } from 'vitest';
import { hnByTopic } from './hn.ts';
import type { HnItem } from './types.ts';

const item = (title: string): HnItem => ({ id: title, title, url: 'https://x.y', domain: 'x.y', points: 1, comments: 0, time: '' });

describe('hnByTopic', () => {
	const items = ['Claude 5 is out', 'Rust 2.0 compiler released', 'NASA finds water on Mars', 'Nvidia raises guidance', 'A love letter'].map(item);

	it('filtra por tema y deja todo con «all»', () => {
		expect(hnByTopic(items, 'all')).toHaveLength(5);
		expect(hnByTopic(items, 'ai').map((i) => i.title)).toEqual(['Claude 5 is out']);
		expect(hnByTopic(items, 'dev').map((i) => i.title)).toEqual(['Rust 2.0 compiler released']);
		expect(hnByTopic(items, 'science').map((i) => i.title)).toEqual(['NASA finds water on Mars']);
		expect(hnByTopic(items, 'business').map((i) => i.title)).toEqual(['Nvidia raises guidance']);
	});

	it('detecta C++ como programación', () => {
		expect(hnByTopic(['Why C++ is hard', 'C++26 ships', 'Ac++ess'].map(item), 'dev').map((i) => i.title)).toEqual(['Why C++ is hard', 'C++26 ships']);
	});
});
