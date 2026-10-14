import { describe, expect, it } from 'vitest';
import { mergeSanctions } from './sanctions.ts';
import type { EuLexDoc, TradeDoc } from './types.ts';

const doc = (id: string, date: string, agency: string): TradeDoc => ({
	id, title: id, type: '', subtype: '', abstract: '', agencies: [agency], date, url: '', pdf: '', agency, topic: 'Sanciones'
});
const act = (id: string, date: string, tags: string[]): EuLexDoc => ({ id, title: id, type: 'Reglamento', tags, date, url: '' });

describe('mergeSanctions', () => {
	it('junta EE. UU., Reino Unido y los actos de sanciones de la UE, de lo más reciente a lo más antiguo', () => {
		const out = mergeSanctions(
			[doc('ofac', '2026-10-12', 'OFAC')],
			[doc('ofsi', '2026-10-14', 'OFSI')],
			[act('32026R1', '2026-10-13', ['Sanciones']), act('32026R2', '2026-10-14', ['Energía'])]
		);
		expect(out.map((d) => `${d.agency}:${d.id}`)).toEqual(['OFSI:ofsi', 'UE:eu:32026R1', 'OFAC:ofac']);
		expect(out[1]).toMatchObject({ topic: 'Sanciones', type: 'Reglamento' });
	});

	it('sin datos, vacía', () => {
		expect(mergeSanctions(null, undefined, null)).toEqual([]);
	});
});
