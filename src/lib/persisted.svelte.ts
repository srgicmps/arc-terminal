// Un $state que se recuerda en este navegador (como un ref() de Vue con useLocalStorage). Para los Seg que
// conviene que sigan igual en la próxima visita (periodo de los gráficos…). Si el navegador no deja guardar
// (modo privado), vale para esta visita. Hay que llamarlo al crear el componente (usa $effect).
//
// Uso:  const months = persisted('arc-chart-period', '0', (v) => /^\d+$/.test(v));
//       months.value = '12';  →  se guarda
export function persisted<T extends string>(key: string, fallback: T, isValid: (v: string) => boolean) {
	let value = $state<T>(fallback);
	// Lo guardado se lee al arrancar en el navegador (al prerenderizar no hay localStorage).
	$effect(() => {
		value = readSaved(key, isValid) ?? fallback;
	});
	return {
		get value() {
			return value;
		},
		set value(next: T) {
			value = next;
			save(key, next);
		}
	};
}

/** Lo guardado en `key`, si vale; si no (o no se puede leer), null. */
export function readSaved<T extends string>(key: string, isValid: (v: string) => boolean): T | null {
	try {
		const saved = localStorage.getItem(key);
		return saved !== null && isValid(saved) ? (saved as T) : null;
	} catch {
		return null;
	}
}

export function save(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {}
}
