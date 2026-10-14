// Teclado de terminal en listas y tablas (lote 22.2): con el foco en una fila (se entra con Tab o con el
// ratón), j/k o ↓/↑ pasan a la siguiente o a la anterior, Intro abre su enlace y «o» abre la fuente en otra
// pestaña. Fuera de una fila, las letras siguen yendo a la barra de comandos («o empieza a escribir»).
import { isShortcut } from './shortcuts.ts';

/** Filas que se recorren: titulares, tablas y listas de los paneles. */
export const ROW_SELECTOR = 'main .news > li, main table tbody tr, main .mini > li';

/** Índice de la fila a la que se pasa, sin salirse de la lista (sin dar la vuelta). */
export function stepRow(count: number, current: number, dir: 1 | -1): number {
	if (count === 0) return -1;
	if (current < 0) return dir === 1 ? 0 : count - 1;
	return Math.min(count - 1, Math.max(0, current + dir));
}

const visible = (el: Element) => (el as HTMLElement).offsetParent !== null;

/** Lo que recibe el foco en una fila: su primer enlace o botón; si no tiene, la fila misma. */
function focusRow(row: HTMLElement) {
	const target = row.querySelector<HTMLElement>('a[href], button') ?? row;
	if (target === row && !row.hasAttribute('tabindex')) row.tabIndex = -1;
	target.focus();
	target.scrollIntoView({ block: 'nearest' });
}

/** Atiende la tecla si el foco está en una fila. Devuelve true si la ha usado (para no pasarla a la barra). */
export function onRowKey(e: KeyboardEvent): boolean {
	if (e.ctrlKey || e.metaKey || e.altKey) return false;
	const active = document.activeElement as HTMLElement | null;
	const row = active?.closest<HTMLElement>(ROW_SELECTOR);
	if (!row) return false;
	if (isShortcut(e, 'row-open-source')) {
		const link = row.querySelector<HTMLAnchorElement>('a[target="_blank"][href]');
		if (!link) return false;
		window.open(link.href, '_blank', 'noopener');
		return true;
	}
	const dir = isShortcut(e, 'row-next') || e.key === 'ArrowDown' ? 1 : isShortcut(e, 'row-prev') || e.key === 'ArrowUp' ? -1 : 0;
	if (!dir) return false;
	const rows = [...document.querySelectorAll<HTMLElement>(ROW_SELECTOR)].filter(visible);
	const next = rows[stepRow(rows.length, rows.indexOf(row), dir)];
	if (next && next !== row) focusRow(next);
	return true;
}
