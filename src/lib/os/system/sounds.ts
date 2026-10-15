// Sonidos del sistema de Arc OS: tonos cortos y bajos, sintetizados con Web Audio (sin archivos que descargar).
// Apagados por defecto; se encienden en los ajustes del sistema (arc-os-system → sounds). Las notas son puras
// (para probarlas); playTone es la parte del navegador.

export type SoundKind = 'boot' | 'unlock' | 'lock' | 'notify';

/** Cada sonido: notas (Hz), duración de cada una (s) y volumen (0–1). Todo suave: nada de pitidos. */
export const SOUNDS: Record<SoundKind, { notes: number[]; dur: number; gain: number }> = {
	boot: { notes: [392, 523.25, 659.25], dur: 0.16, gain: 0.05 },
	unlock: { notes: [523.25, 659.25], dur: 0.09, gain: 0.04 },
	lock: { notes: [659.25, 523.25], dur: 0.09, gain: 0.04 },
	notify: { notes: [880, 1174.66], dur: 0.07, gain: 0.03 }
};

let ctx: AudioContext | null = null;

/** Suena `kind` si se puede (el navegador puede no dejarlo hasta el primer toque: entonces, nada). */
export function playTone(kind: SoundKind) {
	try {
		// Sin un toque o una tecla antes, el navegador deja el audio en pausa y las notas esperarían en cola: el
		// tono de arranque sonaría de golpe con el primer clic. Mejor no sonar.
		if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
		ctx ??= new AudioContext();
		if (ctx.state === 'suspended') void ctx.resume();
		const { notes, dur, gain } = SOUNDS[kind];
		let t = ctx.currentTime;
		for (const f of notes) {
			const osc = ctx.createOscillator();
			const g = ctx.createGain();
			osc.type = 'sine';
			osc.frequency.value = f;
			g.gain.setValueAtTime(0, t);
			g.gain.linearRampToValueAtTime(gain, t + 0.015);
			g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.6);
			osc.connect(g).connect(ctx.destination);
			osc.start(t);
			osc.stop(t + dur * 1.7);
			t += dur * 0.8;
		}
	} catch {}
}
