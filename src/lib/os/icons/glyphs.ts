// Iconos de Arc OS: un azulejo con degradado (hue: color de arriba y de abajo) y un dibujo blanco en trazos SVG
// sobre una rejilla de 24 × 24 (d: trazo; f: partes rellenas, como puntos). Todo dibujo propio, sin marcas.
// `bare`: sin azulejo; d es la parte de atrás (color oscuro) y f la de delante (degradado), como una carpeta.
// Son la única excepción a «nada de colores fijos» (CLAUDE.md): los colores de los iconos viven solo aquí.
// Una app nueva añade aquí su icono (id de apps.ts). Las vistas y las experiencias lo exigen en el test; una herramienta
// sin icono sale con el genérico hasta que lo tenga.

export interface Glyph {
	hue: [string, string];
	d: string;
	f?: string;
	bare?: boolean;
}

/** Color del dibujo y del brillo de arriba. */
export const INK = '#ffffff';

// Formas que se repiten: círculo y rectángulo redondeado como path.
const c = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const rr = (x: number, y: number, w: number, h: number, r: number) =>
	`M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
const dots = (r: number, ...pts: [number, number][]) => pts.map(([x, y]) => c(x, y, r)).join('');

// Familias de color (saturación moderada): mercados verdes y azulados, bonos petróleo, macro ámbar, mundo azul,
// España rojo y amarillo sobrios, tecnología índigo, herramientas grises.
const FOLDER: [string, string] = ['#e3c27a', '#c99a45'];
const BIN: [string, string] = ['#7c838c', '#4d535b'];

const FOLDER_BACK = 'M2 6a2 2 0 0 1 2-2h5.2a1.5 1.5 0 0 1 1.1.45L12 6.2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z';
const TRASH = 'M9.5 7V5h5v2M6.2 7.5l.9 12.5h9.8l.9-12.5M10 10.5v6.5M14 10.5v6.5';

export const GLYPHS: Record<string, Glyph> = {
	// ---------- Mercados ----------
	ws: { hue: ['#3f9a7c', '#22604f'], d: 'M6 3v4M6 14v7M12 5v4M12 15v4M18 2.5v3M18 13v6' + rr(4.5, 7, 3, 7, 0.6) + rr(10.5, 9, 3, 6, 0.6) + rr(16.5, 5.5, 3, 7.5, 0.6) },
	most: { hue: ['#4a9a6e', '#2a6044'], d: 'M8 20V4M4.5 7.5 8 4l3.5 3.5M16 4v16M12.5 16.5 16 20l3.5-3.5' },
	eqs: { hue: ['#3d8f8a', '#225a5a'], d: 'M3.5 4.5h17l-6.5 7.5v6l-4 2.5V12z' },
	imap: { hue: ['#57996a', '#2f5f3f'], d: rr(3, 3, 18, 18, 2) + 'M12 3v18M3 12.5h9M12 9h9M16.5 9v12M7.5 12.5V21' },
	mis: { hue: ['#3d9184', '#1f5b55'], d: 'M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z' },
	cartera: { hue: ['#3f8a76', '#21564a'], d: rr(3, 7, 18, 13, 2) + 'M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7M3 12.5h18M12 11v3' },
	cmp: { hue: ['#4b9387', '#2b5c56'], d: 'M3.5 3.5V20.5h17M6.5 14.5l4-4.5 3 2.5 6-6.5M6.5 18l4-2.5 3 1 6-4' },
	rv: { hue: ['#4d8f7a', '#2b584c'], d: 'M12 4v16M8 20.5h8M4.5 7h15M4.5 7 2 13a2.5 2.5 0 0 0 5 0zM19.5 7 17 13a2.5 2.5 0 0 0 5 0z', f: c(12, 4, 1.3) },
	sig: { hue: ['#3b9478', '#1f5a49'], d: 'M2.5 12.5h4l2-6.5 4 13 2.5-8 1.5 1.5h5' },
	fondos: { hue: ['#4a8f9a', '#28586a'], d: 'M11 4a8.5 8.5 0 1 0 8.5 8.5H11zM14 2.5v7.5h7.5A7.5 7.5 0 0 0 14 2.5z' },
	hds: { hue: ['#43889a', '#255466'], d: c(10, 10, 6.5) + 'M10 3.5V10h6.5M15 15l5.5 5.5' },
	g: { hue: ['#3c8e8f', '#1f5859'], d: 'M3.5 3.5V20.5h17M6.5 16l4-5 3 3 6-7.5', f: dots(1.2, [10.5, 11], [13.5, 14], [19.5, 6.5]) },
	seas: { hue: ['#5a957f', '#33604f'], d: c(12, 12, 9) + 'M5.5 12.5c1.6-3.6 3-3.6 4.4 0s2.8 3.6 4.2 0 2.8-3.6 4.4 0' },
	wb: { hue: ['#3f7f9c', '#234f68'], d: 'M3.5 3.5V20.5h17M5 17.5C9 11 13 8.5 20 7.5', f: dots(1.3, [7.5, 14], [12.5, 10], [18, 7.9]) },
	btmm: { hue: ['#46829a', '#264e63'], d: 'M4 8h15M15.5 4.5 19 8l-3.5 3.5M20 16H5M8.5 12.5 5 16l3.5 3.5' },

	// ---------- Economía ----------
	eco: { hue: ['#c9973f', '#8a5f22'], d: 'M3 20.5h18M5 20V14M9.5 20V9.5M14 20V12.5M19 4l-4.5 6', f: dots(1.25, [14.6, 4.6], [18.6, 9.6]) },
	ecst: { hue: ['#c08c45', '#7f5a28'], d: 'M3.5 6h11M3.5 12h11M3.5 18h11M18.5 5v14M15.5 16l3 3 3-3' },
	semana: { hue: ['#c4934a', '#86602c'], d: rr(3, 4.5, 18, 16, 2) + 'M3 9.5h18M8 2.5v4M16 2.5v4' + rr(6, 12.5, 12, 4, 1) },
	cal: { hue: ['#c27a55', '#84492f'], d: rr(3, 4.5, 18, 16, 2) + 'M3 9.5h18M8 2.5v4M16 2.5v4', f: dots(1.1, [7.5, 13], [12, 13], [16.5, 13], [7.5, 17], [12, 17]) },
	ahorro: { hue: ['#c79b4b', '#86662a'], d: 'M5 7a7 2.5 0 1 0 14 0a7 2.5 0 1 0-14 0M5 7v4.5a7 2.5 0 0 0 14 0V7M5 11.5V16a7 2.5 0 0 0 14 0v-4.5' },
	hipoteca: { hue: ['#b98a4e', '#7a5a30'], d: 'M3 11.5 12 4l9 7.5M5.5 9.5V20.5h13v-11M10 17.5l4-5', f: dots(1, [10, 12.8], [14, 17.2]) },
	imp: { hue: ['#d0a043', '#93682a'], d: 'M4 5.5h16M4 10.5h12M4 15.5h8M4 20.5h4' },
	top: { hue: ['#5d636c', '#33373e'], d: rr(3, 3, 18, 18, 2) + 'M3 9h18M10 9v12M10 15h11' },

	// ---------- Mundo ----------
	geo: { hue: ['#4a7fb5', '#294f80'], d: c(12, 12, 9) + 'M12 3a4.5 9 0 0 0 0 18a4.5 9 0 0 0 0-18M3 12h18M4.6 7.5h14.8M4.6 16.5h14.8' },
	globo: { hue: ['#4778b0', '#243f73'], d: c(12, 12, 6.5) + 'M12 5.5a3 6.5 0 0 0 0 13a3 6.5 0 0 0 0-13M5.6 10.4C3.1 10.9 2 11.7 2 12.5a10 3.4 0 0 0 20 0c0-.8-1.1-1.6-3.6-2.1' },
	pais: { hue: ['#5585b0', '#30557c'], d: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z' + c(12, 10, 2.3) },
	lider: { hue: ['#5a7aa8', '#344b76'], d: c(12, 8, 3.8) + 'M4.5 20.5c1-4.2 4-6.5 7.5-6.5s6.5 2.3 7.5 6.5' },
	port: { hue: ['#3f76a0', '#22486b'], d: c(12, 5, 2) + 'M12 7v14M8 10.5h8M4 14c0 4 3.6 7 8 7s8-3 8-7M2.5 15.5 4 14l1.5 1.5M18.5 15.5 20 14l1.5 1.5' },
	viaje: { hue: ['#5b8fc4', '#33608f'], d: 'M10.5 4.5a1.5 1.5 0 0 1 3 0V10l7.5 4.5v2L13.5 14v4.5l2 1.5v1.5L12 20.5l-3.5 1v-1.5l2-1.5V14L3 16.5v-2L10.5 10z' },
	wx: { hue: ['#5f9bc9', '#346c9a'], d: c(9, 8.5, 3.3) + 'M9 2v1.4M2.5 8.5h1.4M4.4 3.9l1 1M13.6 3.9l-1 1M8.5 20.5h8.5a3.8 3.8 0 0 0 .5-7.6 5.2 5.2 0 0 0-9.9 1.5A3.1 3.1 0 0 0 8.5 20.5z' },
	agua: { hue: ['#4a90b8', '#245f85'], d: 'M12 3c3.6 4.6 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 2.4-6.4 6-11zM9 14.5a3 3 0 0 0 3 3' },
	usgov: { hue: ['#4a5f8f', '#2a3a5f'], d: 'M3 9 12 4l9 5M5.5 9.5v8.5M10 9.5v8.5M14 9.5v8.5M18.5 9.5v8.5M3 20.5h18' },
	news: { hue: ['#6a7280', '#3d434d'], d: 'M3 6h8M3 11h4.5M3 16h4.5' + c(15, 12.5, 4.5) + 'M18.3 15.8 21 18.5' },
	quien: { hue: ['#8a7a9a', '#544a66'], d: 'M3 4.5h11v8H8.5l-3 3v-3H3zM17 9.5h4v8h-2v3l-3-3h-6v-2' },
	rss: { hue: ['#cf8a4a', '#8f5728'], d: 'M4.5 11a8.5 8.5 0 0 1 8.5 8.5M4.5 4.5a15 15 0 0 1 15 15', f: c(5.5, 18.5, 1.6) },
	wiki: { hue: ['#7d8590', '#4a5059'], d: 'M12 6.5C10 5 7 4.5 3 5v14c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5zM12 6.5v14' },
	tech: { hue: ['#6a6fb0', '#40447c'], d: rr(6, 6, 12, 12, 1.5) + rr(9.5, 9.5, 5, 5, 0.6) + 'M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3' },
	ai: { hue: ['#7d68b3', '#4b3d7d'], d: 'M10.5 3.5c.6 4.4 2.3 6.1 6.5 6.7-4.2.6-5.9 2.3-6.5 6.7-.6-4.4-2.3-6.1-6.5-6.7 4.2-.6 5.9-2.3 6.5-6.7zM18 14.5c.25 1.7.9 2.35 2.5 2.6-1.6.25-2.25.9-2.5 2.6-.25-1.7-.9-2.35-2.5-2.6 1.6-.25 2.25-.9 2.5-2.6z' },

	// ---------- España y casa ----------
	es: { hue: ['#b8504a', '#7c2f2c'], d: 'M5.5 21V3M5.5 4h13l-2.5 4.5 2.5 4.5h-13M5.5 7h10.4M5.5 10h10.4' },
	boe: { hue: ['#a8564a', '#6e322b'], d: 'M6 3h8.5L19 7.5V21H6zM14.5 3v4.5H19M9 9.5h5M9 12.5h7' + c(14.5, 16.8, 2.4) },
	luz: { hue: ['#d1a83f', '#94722a'], d: 'M13.5 2.5 5.5 13.5h6l-1 8 8-11h-6z' },
	fuel: { hue: ['#b55a45', '#7a3628'], d: 'M4.5 21V5a2 2 0 0 1 2-2h4.5a2 2 0 0 1 2 2v16M3 21h11.5M7 6.5h3.5V10H7zM13 9h1.8a1.7 1.7 0 0 1 1.7 1.7v5a1.5 1.5 0 0 0 3 0V8l-2.5-3' },

	// ---------- Herramientas y ocio ----------
	chess: { hue: ['#6f665c', '#3b3530'], d: 'M6.5 21h11M7.8 18h8.7M8.6 18c0-2.8 1.2-4.6 3.4-6.2-1.3.3-2.4.6-3.3 1.1L6.6 14 5.3 12.3l1.6-3.6L9.5 6l.4-2.5 1.8 1.8c3.8.5 5.8 3.8 5.3 8.2l-.6 4.5', f: c(9.4, 8.8, 0.95) },
	test: { hue: ['#8b6fa8', '#57436e'], d: 'M4 6l1.6 1.6L8.5 4.7M4 12l1.6 1.6 2.9-2.9M4 18l1.6 1.6 2.9-2.9M11.5 6.5H20M11.5 12.5H20M11.5 18.5H20' },
	status: { hue: ['#6b7a74', '#3f4a46'], d: 'M10 6h10M10 12h10M10 18h10', f: dots(1.6, [5.5, 6], [5.5, 12], [5.5, 18]) },
	avisos: { hue: ['#b9744a', '#7d4a2c'], d: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0' },
	novedades: { hue: ['#8a7fa5', '#564d70'], d: 'M4 9.5v5h3l7 4.5v-14L7 9.5zM17 9.5a3.5 3.5 0 0 1 0 5M19.5 7a7 7 0 0 1 0 10' },
	doc: { hue: ['#6c7480', '#3f4550'], d: 'M8 7l-5 5 5 5M16 7l5 5-5 5M13.8 4l-3.6 16' },
	estilo: { hue: ['#a0708f', '#664559'], d: 'M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9 0-1.4-1-2 0-3.1h3a4 4 0 0 0 4-4C21 6.8 17 3 12 3z', f: dots(1.25, [7.5, 11.5], [9.5, 7.3], [14.5, 7.3]) },
	help: { hue: ['#707884', '#424852'], d: c(12, 12, 9) + c(12, 12, 4) + 'M5.6 5.6 9.2 9.2M18.4 5.6l-3.6 3.6M5.6 18.4l3.6-3.6M18.4 18.4l-3.6-3.6' },
	manual: { hue: ['#76706a', '#47423d'], d: 'M5 19.5V4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5 1.5 1.5 0 0 0 6.5 21H19M9 7h6M9 10h4' },

	// ---------- Experiencias ----------
	'x:periodico': { hue: ['#7a7368', '#48433b'], d: 'M4 5h13v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM17 9h3v10a2 2 0 0 1-2 2M7 8.5h7M7 12h7M7 15.5h4' },
	'x:zen': { hue: ['#7f9a8a', '#4c6355'], d: 'M19.2 9.5A8 8 0 1 1 14.5 4.4M6.5 15.5h11', f: c(12, 11, 1.4) },
	'x:cabina': { hue: ['#9a6e4a', '#5f412a'], d: 'M3.5 17.5a9 9 0 1 1 17 0M12 15l4-5M6 11.2l1.1.6M12 6.5v1.3M18 11.2l-1.1.6', f: c(12, 15, 1.4) },
	'x:feed': { hue: ['#5c7d9a', '#37506a'], d: 'M6 3v18M10 7h10M10 12h7M10 17h9', f: dots(1.6, [6, 7], [6, 12], [6, 17]) },
	'x:sala': { hue: ['#3c6e74', '#1f4247'], d: c(12, 12, 9) + c(12, 12, 5) + 'M12 12l6-6M12 3v2.5', f: c(15.5, 15, 1.1) },
	'x:bitacora': { hue: ['#8f7b5a', '#5a4b33'], d: 'M16 8V5a2 2 0 0 0-2-2H5v18h8M8 7.5h5M8 11h3M19.5 10.5l2 2-7 7-3 1 1-3z' },
	'x:muro': { hue: ['#5d6478', '#343a4a'], d: rr(2, 4, 20, 13, 1.5) + 'M8 21h8M12 17v4' + c(12, 10.5, 3.6) + 'M12 8.5v2l1.5 1' },
	'x:radio': { hue: ['#a0644e', '#653b2c'], d: rr(3, 8, 18, 12, 2) + 'M7 8l10-5' + c(9, 14, 3) + 'M15 12h3M15 15h3M15 18h3' },
	'x:predicciones': { hue: ['#7c6aa3', '#4b3f6c'], d: c(11, 13, 8) + c(11, 13, 4) + 'M11 13l8.5-8.5M16 4.5h3.5V8', f: c(11, 13, 1.2) },
	'x:constelacion': { hue: ['#4f5a96', '#2c3463'], d: 'M6.5 7.3l4.2 4.6M16.8 6.3l-3.6 5.3M10.7 14.4 7.3 17.6M13.5 14l4.2 2.6', f: dots(1.9, [5.5, 6], [18, 4.8], [12, 13], [6, 19], [19, 17.5]) },

	// ---------- Sistema ----------
	launchpad: { hue: ['#6c737d', '#40464f'], d: '', f: dots(1.7, [6.5, 6.5], [12, 6.5], [17.5, 6.5], [6.5, 12], [12, 12], [17.5, 12], [6.5, 17.5], [12, 17.5], [17.5, 17.5]) },
	terminal: { hue: ['#3a3f46', '#1d2025'], d: rr(2.5, 4, 19, 16, 2) + 'M6.5 9.5l3 2.5-3 2.5M12 15h5' },
	folder: { hue: FOLDER, bare: true, d: FOLDER_BACK, f: 'M2 9.6A1.6 1.6 0 0 1 3.6 8h16.8A1.6 1.6 0 0 1 22 9.6V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z' },
	'folder-open': { hue: FOLDER, bare: true, d: FOLDER_BACK, f: 'M4.6 9.1A1.6 1.6 0 0 1 6.1 8h15.4a1 1 0 0 1 .95 1.3l-2.6 9.3A2 2 0 0 1 17.9 20H4a2 2 0 0 1-2-2z' },
	file: { hue: ['#8b939e', '#5a626d'], d: 'M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 16.5h5' },
	trash: { hue: BIN, d: 'M4 7h16' + TRASH },
	'trash-full': { hue: BIN, d: 'M4 7.5h16' + TRASH.replace('M9.5 7V5h5v2', 'M7.5 7.5 9 4.2l3 1.3M12.5 7.5l3.2-3.8 2.1 2.2') },
	settings: { hue: ['#727b86', '#454c55'], d: 'M4 6h9.5M17.5 6H20M4 12h2.5M10.5 12H20M4 18h9.5M17.5 18H20' + c(15.5, 6, 2) + c(8.5, 12, 2) + c(15.5, 18, 2) },
	wallpaper: { hue: ['#6f8fa6', '#46647a'], d: rr(3, 4, 18, 16, 2) + 'M3 17l5-5 4 4 3-3 6 6', f: c(16, 9, 1.7) },
	search: { hue: ['#6f7782', '#434a54'], d: c(10.5, 10.5, 6.5) + 'M15.3 15.3 20.5 20.5' },
	calculadora: { hue: ['#6b7079', '#3c4048'], d: rr(5, 2.5, 14, 19, 2) + rr(7.5, 5, 9, 4, 0.6), f: dots(0.95, [8.5, 12.5], [12, 12.5], [15.5, 12.5], [8.5, 15.5], [12, 15.5], [15.5, 15.5], [8.5, 18.5], [12, 18.5], [15.5, 18.5]) },
	reloj: { hue: ['#5f6873', '#363c45'], d: c(12, 12, 9) + 'M12 7v5l3.5 2' },
	notas: { hue: ['#cdb35e', '#93792f'], d: 'M5 3h14v12l-6 6H5zM13 21v-6h6M8 8h8M8 11.5h6' },
	ajustes: { hue: ['#727b86', '#454c55'], d: 'M4 6h9.5M17.5 6H20M4 12h2.5M10.5 12H20M4 18h9.5M17.5 18H20' + c(15.5, 6, 2) + c(8.5, 12, 2) + c(15.5, 18, 2) },
	calendario: { hue: ['#c76b5e', '#8a3f35'], d: rr(3.5, 5, 17, 15.5, 2) + 'M3.5 9.5h17M8 3v4M16 3v4', f: dots(1, [8, 13], [12, 13], [16, 13], [8, 16.5], [12, 16.5]) },
	vigilancia: { hue: ['#4f7f99', '#2c4f63'], d: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z' + c(12, 12, 3), f: c(12, 12, 1.2) },
	visor: { hue: ['#7a6fa6', '#4a4170'], d: rr(3, 4, 18, 16, 2) + 'M3 16.5l5-4.5 4 3.5 3-2.5 6 5', f: c(15.5, 8.5, 1.6) },
	archivos: { hue: ['#e3c27a', '#c99a45'], d: rr(3, 5, 18, 14, 2) + 'M3 9h18M7 13h6M7 16h4' },
	'mapa-op': { hue: ['#4f7f99', '#2c4f63'], d: rr(3, 4, 18, 16, 1.5) + 'M3 10h18M3 15h18M9 4v16M15 4v16', f: c(12, 12.5, 1.6) },
	cronologia: { hue: ['#5f7f9a', '#36506a'], d: 'M3 12h18M7 12V7M12 12v6M17 12V8', f: dots(1.4, [7, 6], [12, 19], [17, 7]) },
	paquetes: { hue: ['#9a7b52', '#664d2c'], d: 'M12 2.8 20.5 7.3v9.4L12 21.2 3.5 16.7V7.3zM3.5 7.3 12 11.8l8.5-4.5M12 11.8v9.4M7.8 5l8.4 4.6' },
	registros: { hue: ['#6b7079', '#3c4048'], d: rr(4, 3, 16, 18, 2) + 'M7.5 7.5h9M7.5 11h9M7.5 14.5h6M7.5 18h4' },
	monitor: { hue: ['#5a7a6a', '#344c40'], d: rr(2.5, 4, 19, 13, 1.5) + 'M8.5 21h7M12 17v4M5.5 11.5H8l1.5-3 2.5 5 1.5-2h5' },
	explorador: { hue: ['#5e7f9e', '#37536e'], d: c(12, 12, 9) + 'M15.5 8.5l-2 5-5 2 2-5z' }
};

/** Dibujo genérico (cuadrícula de app) para un id sin icono propio. */
const FALLBACK_D = rr(4.5, 4.5, 6.5, 6.5, 1.5) + rr(13, 4.5, 6.5, 6.5, 1.5) + rr(4.5, 13, 6.5, 6.5, 1.5) + rr(13, 13, 6.5, 6.5, 1.5);

function hash(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
}

/** HSL (0–360, 0–1, 0–1) → #rrggbb. */
function hex(h: number, s: number, l: number): string {
	const k = (n: number) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const ch = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
	return '#' + [ch(0), ch(8), ch(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** El icono de un id; si no tiene uno propio, color sacado del id y cuadrícula de app. */
export function iconOf(id: string): Glyph {
	const own = GLYPHS[id] ?? GLYPHS[id.toLowerCase()];
	if (own) return own;
	const h = hash(id) % 360;
	return { hue: [hex(h, 0.32, 0.5), hex(h, 0.36, 0.32)], d: FALLBACK_D };
}

/** ¿Tiene icono propio (no el genérico)? */
export const hasIcon = (id: string) => !!(GLYPHS[id] ?? GLYPHS[id.toLowerCase()]);
