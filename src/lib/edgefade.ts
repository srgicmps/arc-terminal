/**
 * Filas que se deslizan en horizontal (pestañas de arriba, índice de paneles): pone `data-fade` en el elemento
 * según por dónde queda contenido escondido («start», «end», «both» o nada). El fundido lo pinta app.css.
 * Así se ve que la fila sigue, también por la izquierda después de deslizarla.
 */
export function fadeSide(left: number, width: number, total: number): 'start' | 'end' | 'both' | '' {
	const start = left > 1;
	const end = left + width < total - 1;
	return start && end ? 'both' : start ? 'start' : end ? 'end' : '';
}

export function edgeFade(node: HTMLElement) {
	const update = () => {
		const side = fadeSide(node.scrollLeft, node.clientWidth, node.scrollWidth);
		if (side) node.dataset.fade = side;
		else delete node.dataset.fade;
	};
	update();
	node.addEventListener('scroll', update, { passive: true });
	const resize = new ResizeObserver(update);
	resize.observe(node);
	// Los hijos cambian (pestañas propias, paneles que aparecen): se recalcula.
	const mutate = new MutationObserver(update);
	mutate.observe(node, { childList: true, subtree: true });
	return {
		destroy() {
			node.removeEventListener('scroll', update);
			resize.disconnect();
			mutate.disconnect();
		}
	};
}
