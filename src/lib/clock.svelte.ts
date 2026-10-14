// Hora actual compartida por toda la web, para los «hace 5 min». Vale 0 hasta que la página arranca
// en el navegador (ver format.ts → when). El layout la pone en marcha.

export const clock = $state({ now: 0 });

export function startClock() {
	clock.now = Date.now();
	const id = setInterval(() => (clock.now = Date.now()), 30_000);
	return () => clearInterval(id);
}
