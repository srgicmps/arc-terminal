// Guardar «lo último, en orden y de uno en uno» (AVISOS). Si se cambian dos cosas seguidas mientras la primera
// aún se está guardando, no salen dos peticiones a la vez ni la segunda parte de la configuración vieja: se
// espera a la primera y luego se manda el valor más reciente. Lógica pura, sin el navegador.

export interface SaveQueue<T> {
	/** Pide guardar `value` (con `flag`, p. ej. «canal nuevo»: se acumula hasta el siguiente envío). */
	save(value: T, flag?: boolean): Promise<void>;
	readonly busy: boolean;
}

export function saveQueue<T, R>(
	send: (value: T, flag: boolean) => Promise<R>,
	on: {
		/** Respuesta buena. `more`: hay otro cambio esperando (no pises lo que ve el usuario). */
		ok(result: R, more: boolean): void;
		/** Ha fallado: se descarta lo que esperaba. */
		fail(error: unknown): void;
	}
): SaveQueue<T> {
	let queued: { value: T; flag: boolean } | null = null;
	let running: Promise<void> | null = null;

	async function loop() {
		while (queued) {
			const job = queued;
			queued = null;
			try {
				const r = await send(job.value, job.flag);
				on.ok(r, queued !== null);
			} catch (e) {
				queued = null;
				on.fail(e);
			}
		}
		// Sin ningún await entre el bucle y esto: un save() que llegue ahora arranca otra vuelta.
		running = null;
	}

	return {
		save(value, flag = false) {
			queued = { value, flag: flag || !!queued?.flag };
			running ??= loop();
			return running;
		},
		get busy() {
			return running !== null;
		}
	};
}
