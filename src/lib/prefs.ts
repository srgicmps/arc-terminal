// Registro de todo lo que Arc Terminal guarda en el navegador: preferencias, datos tuyos y cachés.
// Es solo documentación (lo enseña el MANUAL): cada módulo sigue usando su propia clave. Un test de
// src/lib/manual.test.ts busca las claves en el código y falla si alguna no está aquí.

export interface Pref {
	/** La clave tal y como se guarda. Las que llevan una parte variable, con <…>: «arc-layout-<vista>». */
	key: string;
	/** local: localStorage · session: sessionStorage (solo esta pestaña) · cache: Cache Storage del service worker. */
	storage: 'local' | 'session' | 'cache';
	what: string;
	/** Dónde se usa o se cambia. */
	where: string;
	/** ajuste: una preferencia · dato: algo que has escrito o elegido · caché: una copia para ir más rápido o sin conexión. */
	kind: 'ajuste' | 'dato' | 'caché';
	/** Para las claves con parte variable: el principio fijo («arc-layout-»). */
	prefix?: string;
}

export const PREFS: Pref[] = [
	{ key: 'arc-theme', storage: 'local', what: 'Tema: automático, de día o de noche', where: 'Botón ◐ de la cabecera', kind: 'ajuste' },
	{ key: 'arc-fit', storage: 'local', what: 'Encajar en la pantalla (cada panel con su scroll)', where: 'Botón ⤢ de la cabecera', kind: 'ajuste' },
	{ key: 'arc-mode', storage: 'local', what: 'Portada general o modular', where: 'Botón ▦ de la cabecera, en TOP', kind: 'ajuste' },
	{ key: 'arc-layout-<vista>', prefix: 'arc-layout-', storage: 'local', what: 'Paneles ocultos, orden y ancho de la vista modular', where: 'TOP en modo modular', kind: 'ajuste' },
	{ key: 'arc-titles', storage: 'local', what: 'Idioma de los titulares (ES traducido o EN original)', where: 'Selector ES / EN de IMP', kind: 'ajuste' },
	{ key: 'arc-news-prefs', storage: 'local', what: 'Medios silenciados e idioma original de los titulares', where: 'NEWS, «Tus medios»', kind: 'ajuste' },
	{ key: 'arc-ref-country', storage: 'local', what: 'País de referencia para paro, inflación y deuda', where: 'TOP, panel «Macro»', kind: 'ajuste' },
	{ key: 'arc-chart-period', storage: 'local', what: 'Último periodo elegido en los gráficos de línea', where: 'Botones 1M · 6M · 1A · 5A · Máx', kind: 'ajuste' },
	{ key: 'arc-accent', storage: 'local', what: 'Color de acento: ámbar, cian o azul', where: 'HELP, «A tu gusto»', kind: 'ajuste' },
	{ key: 'arc-keys', storage: 'local', what: 'Secciones de la fila de arriba', where: 'HELP, «A tu gusto»', kind: 'ajuste' },
	{ key: 'arc-thumb', storage: 'local', what: 'Las 4 secciones de la barra inferior del móvil', where: 'HELP, «A tu gusto»', kind: 'ajuste' },
	{ key: 'arc-ws-heatmap', storage: 'local', what: 'Último mapa de calor elegido', where: 'WS', kind: 'ajuste' },
	{ key: 'arc-tv', storage: 'local', what: 'Vistas y segundos del modo TV', where: 'TV', kind: 'ajuste' },
	{ key: 'arc-cal', storage: 'local', what: 'Países e importancia del calendario económico', where: 'CAL', kind: 'ajuste' },
	{ key: 'fuel-zone', storage: 'local', what: 'Última provincia elegida', where: 'FUEL', kind: 'ajuste' },
	{ key: 'arc-place', storage: 'local', what: 'Tu sitio y hasta 5 favoritos', where: 'Chip «Tu sitio» de la cabecera, WX', kind: 'dato' },
	{ key: 'arc-watchlist', storage: 'local', what: 'Tu lista de valores', where: 'MIS', kind: 'dato' },
	{ key: 'arc-tape', storage: 'local', what: 'Cinta de arriba con tus valores o con los índices', where: 'MIS, «Cinta de arriba»', kind: 'ajuste' },
	{ key: 'arc-watchwords', storage: 'local', what: 'Palabras vigiladas', where: 'BOE', kind: 'dato' },
	{ key: 'arc-cmd-history', storage: 'local', what: 'Tus 5 últimos comandos', where: 'Barra de comandos vacía', kind: 'dato' },
	{ key: 'arc-mortgage', storage: 'local', what: 'Lo que escribes en la calculadora de hipoteca', where: 'ECO, «Tu hipoteca»', kind: 'dato' },
	{ key: 'arc-fx', storage: 'local', what: 'Cantidad y divisas del conversor', where: 'WS, «Conversor»', kind: 'dato' },
	{ key: 'arc-chess', storage: 'local', what: 'La partida de ajedrez en curso', where: 'CHESS', kind: 'dato' },
	{ key: 'arc-puzzle', storage: 'local', what: 'El último problema del día resuelto', where: 'CHESS', kind: 'dato' },
	{ key: 'arc-last-visit', storage: 'local', what: 'Hora de tu última visita, para marcar lo nuevo', where: 'TOP y titulares', kind: 'dato' },
	{ key: 'arc-last-visit-session', storage: 'session', what: 'La referencia de esta pestaña: recargar no borra lo marcado como nuevo', where: 'TOP y titulares', kind: 'dato' },
	{ key: 'arc-localwx:<lat>,<lon>', prefix: 'arc-localwx:', storage: 'local', what: 'El tiempo de tu sitio, para no volver a pedirlo enseguida', where: 'WX', kind: 'caché' },
	{ key: 'arc-<versión>', storage: 'cache', what: 'Los archivos de la web publicada; se renueva en cada publicación', where: 'Sin conexión', kind: 'caché' },
	{ key: 'arc-pages', storage: 'cache', what: 'Las vistas que has abierto y sus datos (hasta 40)', where: 'Sin conexión', kind: 'caché' },
	{ key: 'arc-fonts', storage: 'cache', what: 'Las tipografías', where: 'Sin conexión', kind: 'caché' },
	{ key: 'arc-engine', storage: 'cache', what: 'El motor de ajedrez (unos 7 MB), desde la primera partida', where: 'CHESS sin conexión', kind: 'caché' }
];

/** ¿Está documentada esta clave? Por clave exacta o por el principio fijo de una con parte variable. */
export const isDocumented = (key: string) => PREFS.some((p) => p.key === key || (p.prefix !== undefined && key.startsWith(p.prefix)));
