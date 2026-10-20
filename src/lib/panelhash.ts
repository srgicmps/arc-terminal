// Saltar a un panel desde la barra (M47): «ECO TIPOS» abre /eco#panel=Bancos%20centrales, y el panel con
// ese título se desplaza a la vista y se resalta un momento (lo hace Panel.svelte). Va aparte de cmdline.ts
// para que Panel no cargue los comandos.

export const PANEL_HASH = '#panel=';

/** El hash de la URL que lleva a un panel: «#panel=Curvas%20de%20tipos». */
export const panelHash = (title: string) => PANEL_HASH + encodeURIComponent(title);

/** El título del panel que pide un hash, o null si el hash no es de un panel. */
export function hashPanel(hash: string): string | null {
	if (!hash.startsWith(PANEL_HASH)) return null;
	try {
		return decodeURIComponent(hash.slice(PANEL_HASH.length)) || null;
	} catch {
		return null;
	}
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

/**
 * ¿Es el panel que se pide? Sin tildes ni mayúsculas, con el título entero o con su principio hasta « · »,
 * como en el modo Sencillo (simple.ts): «WX Mar» pide «Mar» y el panel se llama «Mar · Menorca».
 */
export function samePanel(want: string, title: string): boolean {
	const [w, t] = [fold(want), fold(title)];
	return w === t || t.startsWith(`${w} · `);
}
