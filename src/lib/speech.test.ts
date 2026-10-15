import { describe, expect, it, vi } from 'vitest';
import { speaker } from './speech.ts';

function setup() {
	const spoken: { text: string; lang: string; onend: (() => void) | null; onerror: (() => void) | null }[] = [];
	const synth = { speak: vi.fn((u) => spoken.push(u)), cancel: vi.fn() };
	const onDone = vi.fn();
	const s = speaker(synth, (text) => ({ text, lang: '', rate: 1, onend: null, onerror: null }) as never, onDone, (f) => f());
	return { spoken, synth, onDone, s };
}

describe('speaker (Escuchar)', () => {
	it('lee cada línea en su idioma y avisa solo al acabar la última', () => {
		const { spoken, onDone, s } = setup();
		expect(s.play([{ text: 'Hola' }, { text: '  ' }, { text: 'Hello', lang: 'en' }])).toBe(true);
		expect(spoken.map((u) => [u.text, u.lang])).toEqual([
			['Hola', 'es-ES'],
			['Hello', 'en-GB']
		]);
		spoken[0].onend!();
		expect(onDone).not.toHaveBeenCalled();
		spoken[1].onend!();
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it('sin texto no lee nada', () => {
		const { synth, s } = setup();
		expect(s.play([{ text: ' ' }])).toBe(false);
		expect(synth.speak).not.toHaveBeenCalled();
	});

	it('los avisos tardíos de una lectura cancelada no paran la nueva', () => {
		const { spoken, onDone, s } = setup();
		s.play([{ text: 'Uno' }]);
		s.play([{ text: 'Dos' }, { text: 'Tres' }]);
		spoken[0].onerror!();
		expect(onDone).not.toHaveBeenCalled();
		spoken[1].onend!();
		spoken[2].onend!();
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it('parar cancela y avisa', () => {
		const { synth, onDone, s } = setup();
		s.play([{ text: 'Uno' }]);
		s.stop();
		expect(synth.cancel).toHaveBeenCalled();
		expect(onDone).toHaveBeenCalledTimes(1);
	});
});
