import { describe, expect, it } from 'vitest';
import { saveQueue } from './savequeue.ts';

/** Un servidor lento: cada envío espera a que el test lo suelte. */
function slow() {
	const sent: { value: string[]; flag: boolean }[] = [];
	const release: (() => void)[] = [];
	const send = (value: string[], flag: boolean) =>
		new Promise<string[]>((ok) => {
			sent.push({ value, flag });
			release.push(() => ok(value));
		});
	return { sent, release, send };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('saveQueue (AVISOS)', () => {
	it('dos cambios seguidos: no se pierde el primero ni salen dos a la vez', async () => {
		const s = slow();
		const seen: { r: string[]; more: boolean }[] = [];
		const q = saveQueue(s.send, { ok: (r, more) => seen.push({ r, more }), fail: () => {} });
		// Como en la vista: cada cambio parte del anterior (lo que ya se ve), no de lo guardado.
		void q.save(['a']);
		void q.save(['a', 'b']);
		void q.save(['a', 'b', 'c'], true);
		expect(s.sent).toHaveLength(1);
		expect(q.busy).toBe(true);
		s.release[0]();
		await tick();
		expect(seen[0].more).toBe(true);
		// El segundo envío es el último valor, con la marca acumulada; el intermedio no sale.
		expect(s.sent[1]).toEqual({ value: ['a', 'b', 'c'], flag: true });
		s.release[1]();
		await tick();
		expect(seen.at(-1)).toEqual({ r: ['a', 'b', 'c'], more: false });
		expect(s.sent).toHaveLength(2);
		expect(q.busy).toBe(false);
		// Y vuelve a funcionar después.
		void q.save(['d']);
		expect(s.sent).toHaveLength(3);
	});

	it('si falla, avisa y descarta lo que esperaba', async () => {
		let fails = 0;
		let calls = 0;
		const q = saveQueue(
			async () => {
				calls++;
				throw new Error('500');
			},
			{ ok: () => {}, fail: () => fails++ }
		);
		await q.save(1);
		expect([calls, fails, q.busy]).toEqual([1, 1, false]);
	});
});
