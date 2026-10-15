// Varios comandos a la vez (lote 27-A): «ECO; WS CURVA; NVDA 1a». Se abre el primero y los demás quedan en
// cola: con la barra vacía, Intro abre el siguiente; atrás y adelante del navegador van entre ellos.
// Funciona igual en el móvil, donde abrir pestañas molesta y los navegadores bloquean las ventanas nuevas.

export const MULTI_MAX = 8;

/** «ECO; WS CURVA» → ['ECO', 'WS CURVA']. null si no hay al menos dos. */
export function parseMulti(raw: string): string[] | null {
	if (!raw.includes(';')) return null;
	const parts = raw
		.split(';')
		.map((x) => x.trim())
		.filter(Boolean)
		.slice(0, MULTI_MAX);
	return parts.length >= 2 ? parts : null;
}
