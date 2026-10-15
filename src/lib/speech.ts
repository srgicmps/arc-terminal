// Cola de lectura en voz alta de «Escuchar» (ui/Listen.svelte), sin Svelte, para probarla con Vitest.
// Las frases se guardan mientras suenan: si nadie las guarda, Chrome puede tirarlas a la basura antes de
// leerlas y su `onend` no llega nunca (el botón se quedaría en «Parar»).

export interface SpeechLine {
	text: string;
	lang?: 'es' | 'en';
}

type Synth = Pick<SpeechSynthesis, 'speak' | 'cancel'>;
type Utterance = Pick<SpeechSynthesisUtterance, 'lang' | 'rate' | 'onend' | 'onerror'>;

/** Un lector: `play` lee las líneas (cancela lo anterior) y avisa con `onDone` al acabar, fallar o pararlo. */
export function speaker(synth: Synth, make: (text: string) => Utterance, onDone: () => void, later: (f: () => void) => void = (f) => void setTimeout(f, 0)) {
	let queue: Utterance[] = [];
	// Cada lectura tiene su número: los avisos de una anterior, que llegan tarde al cancelarla, no cuentan.
	let run = 0;

	function finish() {
		run++;
		queue = [];
		onDone();
	}

	function stop() {
		finish();
		synth.cancel();
	}

	/** Devuelve false si no hay nada que leer. */
	function play(lines: SpeechLine[]): boolean {
		const all = lines.filter((l) => l.text.trim());
		if (!all.length) return false;
		run++;
		synth.cancel();
		const mine = run;
		let left = all.length;
		const done = () => {
			// Al acabar no se cancela nada: podría cortar lo que lee otro «Escuchar» de la página.
			if (mine === run && --left <= 0) finish();
		};
		queue = all.map((line) => {
			const u = make(line.text);
			u.lang = line.lang === 'en' ? 'en-GB' : 'es-ES';
			u.rate = 1.05;
			u.onend = u.onerror = done;
			return u;
		});
		// Safari (iOS) a veces se come la primera frase si speak() va justo detrás de cancel().
		later(() => {
			if (mine === run) for (const u of queue) synth.speak(u as SpeechSynthesisUtterance);
		});
		return true;
	}

	return { play, stop };
}
