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
	{ key: 'arc-modo', storage: 'local', what: 'Modo Sencillo (lo esencial, con explicaciones) o Terminal (todo, denso)', where: 'HELP, «A tu gusto», o MODO en la barra', kind: 'ajuste' },
	{ key: 'arc-layout-<vista>', prefix: 'arc-layout-', storage: 'local', what: 'Paneles ocultos, orden y ancho de la vista modular', where: 'TOP en modo modular', kind: 'ajuste' },
	{ key: 'arc-titles', storage: 'local', what: 'Idioma de los titulares (ES traducido o EN original)', where: 'Selector ES / EN de IMP', kind: 'ajuste' },
	{ key: 'arc-news-prefs', storage: 'local', what: 'Medios silenciados e idioma original de los titulares', where: 'NEWS, «Tus medios»', kind: 'ajuste' },
	{ key: 'arc-ref-country', storage: 'local', what: 'País de referencia para paro, inflación y deuda', where: 'TOP, panel «Macro»', kind: 'ajuste' },
	{ key: 'arc-leaders', storage: 'local', what: 'Los líderes que salen en LIDER y su orden', where: 'LIDER, «Tus líderes»', kind: 'ajuste' },
	{ key: 'arc-countries', storage: 'local', what: 'Tus países favoritos (hasta 8)', where: 'PAIS, botón ☆ Seguir', kind: 'dato' },
	{ key: 'arc-home', storage: 'local', what: 'Vista que se abre al entrar', where: 'HELP, «Vista de inicio»', kind: 'ajuste' },
	{ key: 'arc-home-done', storage: 'session', what: 'Esta pestaña ya ha abierto la vista de inicio (luego TOP es la portada)', where: 'Al entrar', kind: 'dato' },
	{ key: 'arc-chart-period', storage: 'local', what: 'Último periodo elegido en los gráficos de línea', where: 'Botones 1M · 6M · 1A · 5A · Máx', kind: 'ajuste' },
	{ key: 'arc-thresholds', storage: 'local', what: 'Umbrales «resáltame si pasa de X» de las tablas de series', where: 'Tocar la cifra «Último» de una serie', kind: 'ajuste' },
	{ key: 'arc-pins', storage: 'local', what: 'Paneles fijados en TOP y su ancho', where: 'Botón 📌 de cada panel', kind: 'ajuste' },
	{ key: 'arc-folded', storage: 'local', what: 'Paneles plegados de cada vista', where: 'Título de cada panel', kind: 'ajuste' },
	{ key: 'arc-accent', storage: 'local', what: 'Color de acento: ámbar, cian o azul', where: 'HELP, «A tu gusto»', kind: 'ajuste' },
	{ key: 'arc-density', storage: 'local', what: 'Densidad: compacta o cómoda', where: 'HELP, «A tu gusto»', kind: 'ajuste' },
	{ key: 'arc-keys', storage: 'local', what: 'Secciones de la fila de arriba', where: 'HELP, «A tu gusto»', kind: 'ajuste' },
	{ key: 'arc-thumb', storage: 'local', what: 'Las 4 secciones de la barra inferior del móvil', where: 'HELP, «A tu gusto»', kind: 'ajuste' },
	{ key: 'arc-ws-heatmap', storage: 'local', what: 'Último mapa de calor elegido', where: 'WS', kind: 'ajuste' },
	{ key: 'arc-tv', storage: 'local', what: 'Vistas y segundos del modo TV', where: 'TV', kind: 'ajuste' },
	{ key: 'arc-cal', storage: 'local', what: 'Países e importancia del calendario económico', where: 'CAL', kind: 'ajuste' },
	{ key: 'fuel-zone', storage: 'local', what: 'Última provincia elegida', where: 'FUEL', kind: 'ajuste' },
	{ key: 'arc-place', storage: 'local', what: 'Tu sitio y hasta 5 favoritos', where: 'Chip «Tu sitio» de la cabecera, WX', kind: 'dato' },
	{ key: 'arc-watchlists', storage: 'local', what: 'Tus listas de valores y cuál se enseña', where: 'MIS', kind: 'dato' },
	{ key: 'arc-watchlist', storage: 'local', what: 'Tu lista de antes de tener varias: se pasa sola a la primera', where: 'MIS', kind: 'dato' },
	{ key: 'arc-tape', storage: 'local', what: 'Cinta de arriba con tus valores o con los índices', where: 'MIS, «Cinta de arriba»', kind: 'ajuste' },
	{ key: 'arc-watchwords', storage: 'local', what: 'Palabras vigiladas', where: 'BOE', kind: 'dato' },
	{ key: 'arc-cmd-history', storage: 'local', what: 'Tus 50 últimos comandos (se ven 5; ↑ los recorre)', where: 'Barra de comandos vacía', kind: 'dato' },
	{ key: 'arc-cmd-favs', storage: 'local', what: 'Tus favoritos de la barra (hasta 9)', where: 'Barra: «fav ECO TIPOS», luego «1»', kind: 'dato' },
	{ key: 'arc-mortgage', storage: 'local', what: 'Lo que escribes en la calculadora de hipoteca', where: 'ECO, «Tu hipoteca»', kind: 'dato' },
	{ key: 'arc-fx', storage: 'local', what: 'Cantidad y divisas del conversor', where: 'WS, «Conversor»', kind: 'dato' },
	{ key: 'arc-chess', storage: 'local', what: 'La partida de ajedrez en curso', where: 'CHESS', kind: 'dato' },
	{ key: 'arc-puzzle', storage: 'local', what: 'El último problema del día resuelto', where: 'CHESS', kind: 'dato' },
	{ key: 'arc-last-visit', storage: 'local', what: 'Hora de tu última visita, para marcar lo nuevo', where: 'TOP y titulares', kind: 'dato' },
	{ key: 'arc-last-visit-session', storage: 'session', what: 'La referencia de esta pestaña: recargar no borra lo marcado como nuevo', where: 'TOP y titulares', kind: 'dato' },
	{ key: 'arc-sync', storage: 'local', what: 'De quién son los ajustes de aquí y cómo quedaron en tu cuenta la última vez', where: 'Ajustes en tu cuenta (arcterminal.dev)', kind: 'caché' },
	{ key: 'arc-sync-reload', storage: 'session', what: 'Esta pestaña ya ha recargado para traer los ajustes de tus otros dispositivos', where: 'Ajustes en tu cuenta', kind: 'dato' },
	{ key: 'arc-login-reload', storage: 'session', what: 'Esta pestaña ya ha recargado para volver al login de Cloudflare Access (sesión caducada)', where: 'Al entrar', kind: 'dato' },
	{ key: 'arc-localwx:<lat>,<lon>', prefix: 'arc-localwx:', storage: 'local', what: 'El tiempo de tu sitio, para no volver a pedirlo enseguida', where: 'WX', kind: 'caché' },
	{ key: 'arc-<versión>', storage: 'cache', what: 'Los archivos de la web publicada; se renueva en cada publicación', where: 'Sin conexión', kind: 'caché' },
	{ key: 'arc-pages', storage: 'cache', what: 'Las vistas que has abierto y sus datos (hasta 40)', where: 'Sin conexión', kind: 'caché' },
	{ key: 'arc-fonts', storage: 'cache', what: 'Las tipografías', where: 'Sin conexión', kind: 'caché' },
	{ key: 'arc-engine', storage: 'cache', what: 'El motor de ajedrez (unos 7 MB), desde la primera partida', where: 'CHESS sin conexión', kind: 'caché' }
];

/** ¿Está documentada esta clave? Por clave exacta o por el principio fijo de una con parte variable. */
export const isDocumented = (key: string) => PREFS.some((p) => p.key === key || (p.prefix !== undefined && key.startsWith(p.prefix)));
