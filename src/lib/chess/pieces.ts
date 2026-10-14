// Piezas de ajedrez propias, geométricas y sobrias, dibujadas en una casilla de 45 × 45 unidades.
// `body` es la silueta (relleno del bando y contorno fino); `detail`, líneas interiores con el color del
// contorno (el ojo del caballo, la muesca del alfil). Sin dependencias ni fuentes de iconos.
import type { PieceSymbol } from './game.ts';

export const PIECES: Record<PieceSymbol, { body: string; detail?: string }> = {
	p: {
		body:
			'M12 37.5h21v-3.5H12z' +
			'M15.5 34c.8-5.2 3.3-8.6 5-10.3h4c1.7 1.7 4.2 5.1 5 10.3z' +
			'M18 23.7h9v-2.2h-9z' +
			'M22.5 21.5a5 5 0 1 0 0-10a5 5 0 1 0 0 10z'
	},
	r: {
		body: 'M10.5 37.5h24v-3.5h-24z' + 'M14 34l1.2-15h14.6l1.2 15z' + 'M12.5 19h20v-9h-4v3.5h-3.5V10h-5v3.5h-3.5V10h-4z'
	},
	b: {
		body:
			'M11 37.5h23v-3.5H11z' +
			'M15 34c.6-4.4 1.8-7.4 3-9h9c1.2 1.6 2.4 4.6 3 9z' +
			'M17.5 25h10v-2.6h-10z' +
			'M18 22.4c-2.6-4.4-.9-9 4.5-13.4c5.4 4.4 7.1 9 4.5 13.4z' +
			'M22.5 8.6a2 2 0 1 0 0-4a2 2 0 1 0 0 4z',
		detail: 'M25.2 12.4l-4.4 5.4'
	},
	n: {
		body:
			'M11 37.5h23v-3.5H11z' +
			'M14.5 34c.6-3.4 2.6-6 5-8.2c1.5-1.3 2-2.6 1.6-3.8c-1.2 1.1-2.8 1.6-4.4 1.6l-2.6 2.6' +
			'c-1 1-2.6.6-3-.7c-.3-1 0-2 .6-2.8l3.7-5.2c1.2-1.7 2.2-3.4 2.8-5.3l1-2.7l2.3 2.2' +
			'c.4-1.6 1.2-2.8 2.4-3.6l.9 3c5.3 1.2 8.5 5.9 8.5 12.4V34z',
		detail: 'M17.6 15.8h.1'
	},
	q: {
		body:
			'M11 37.5h23v-3.5H11z' +
			'M12.5 34L10 16.5l5.2 8.3l1.3-11.3l6 10.6l6-10.6l1.3 11.3l5.2-8.3L32.5 34z' +
			'M10 16.3a1.9 1.9 0 1 0 0-3.8a1.9 1.9 0 1 0 0 3.8z' +
			'M16.5 13.3a1.9 1.9 0 1 0 0-3.8a1.9 1.9 0 1 0 0 3.8z' +
			'M22.5 12.3a1.9 1.9 0 1 0 0-3.8a1.9 1.9 0 1 0 0 3.8z' +
			'M28.5 13.3a1.9 1.9 0 1 0 0-3.8a1.9 1.9 0 1 0 0 3.8z' +
			'M35 16.3a1.9 1.9 0 1 0 0-3.8a1.9 1.9 0 1 0 0 3.8z'
	},
	k: {
		body:
			'M11 37.5h23v-3.5H11z' +
			'M13.2 34c-1.8-4.6-1.9-8.6.2-11.4c2-2.6 5.4-3 9.1-.4c3.7-2.6 7.1-2.2 9.1.4c2.1 2.8 2 6.8.2 11.4z' +
			'M21.3 21.2h2.4v-9.2h3.3V9.6h-3.3V6.2h-2.4v3.4H18v2.4h3.3z',
		detail: 'M14.5 29.2h16'
	}
};
