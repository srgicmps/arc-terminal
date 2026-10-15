// Secciones de «Ajustes» de Arc OS, como el Panel de control de un NAS: categorías con iconos en la portada,
// lista lateral al entrar y un buscador que encuentra secciones y ajustes sueltos. Lógica pura (con tests).
// Abrir una sección directamente: openApp('ajustes', '<id>') (también vale '/<id>').
// Sin importar #lib/search.ts (arrastra el índice de la barra): este archivo va en el registro de apps.

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const queryWords = (q: string) => fold(q).split(/\s+/).filter(Boolean);
/** Cada palabra buscada empieza alguna palabra del texto («tema» no encaja en «sistema»). */
const hasWords = (text: string, words: string[]) => {
	const t = fold(text).split(/[^\p{L}\p{N}]+/u);
	return words.every((w) => t.some((x) => x.startsWith(w)));
};

export const CATEGORIES = [
	{ id: 'personal', label: 'Personal' },
	{ id: 'sistema', label: 'Sistema' },
	{ id: 'datos', label: 'Datos' },
	{ id: 'avisos', label: 'Avisos' },
	{ id: 'info', label: 'Información' }
] as const;
export type CategoryId = (typeof CATEGORIES)[number]['id'];

export interface SectionDef {
	id: string;
	label: string;
	/** Un glifo, como el resto de iconos de Arc OS. */
	icon: string;
	cat: CategoryId;
	/** Qué hay dentro, en una línea (portada y buscador). */
	desc: string;
	/** Ajustes sueltos que se pueden buscar. */
	items: string[];
}

export const SECTIONS = [
	{ id: 'cuenta', label: 'Cuenta', icon: '◉', cat: 'personal', desc: 'Tu cuenta y volver a la web clásica', items: ['Cuenta', 'Volver a la web clásica', 'Salir de Arc OS'] },
	{ id: 'apariencia', label: 'Apariencia del contenido', icon: '◐', cat: 'personal', desc: 'Tema, acento, densidad y estética de las vistas', items: ['Tema día noche', 'Color de acento', 'Densidad', 'Estética'] },
	{ id: 'modo', label: 'Modo', icon: '◑', cat: 'personal', desc: 'Sencillo o Terminal', items: ['Modo Sencillo', 'Modo Terminal'] },
	{ id: 'region', label: 'Idioma y región', icon: '◍', cat: 'personal', desc: 'Tu sitio e idioma de los titulares', items: ['Tu sitio ciudad', 'Idioma de los titulares', 'Traducir'] },
	{ id: 'sistema', label: 'Arranque y bloqueo', icon: '⏻', cat: 'sistema', desc: 'Pantalla de inicio y bloqueo', items: ['Pantalla de inicio', 'Bloquear la pantalla'] },
	{ id: 'sonidos', label: 'Sonidos', icon: '♪', cat: 'sistema', desc: 'Sonidos del sistema', items: ['Sonidos del sistema', 'Probar sonido'] },
	{ id: 'barra', label: 'Barra de tareas', icon: '▁', cat: 'sistema', desc: 'Dónde va la barra', items: ['Barra de tareas arriba abajo'] },
	{ id: 'escritorio', label: 'Escritorio y fondo', icon: '▦', cat: 'sistema', desc: 'Fondo de pantalla y escritorios virtuales', items: ['Fondo de pantalla', 'Escritorios virtuales', 'Añadir escritorio'] },
	{ id: 'widgets', label: 'Widgets', icon: '▣', cat: 'sistema', desc: 'Qué widgets salen en el escritorio', items: ['Widgets del escritorio'] },
	{ id: 'sync', label: 'Sincronización', icon: '⇅', cat: 'datos', desc: 'Tus ajustes en tu cuenta, en todos tus dispositivos', items: ['Sincronizar dispositivos'] },
	{ id: 'copia', label: 'Copia de ajustes', icon: '⇪', cat: 'datos', desc: 'Llevarte los ajustes con un enlace o un archivo', items: ['Exportar ajustes', 'Enlace a otro dispositivo', 'Descargar copia'] },
	{ id: 'almacenamiento', label: 'Almacenamiento local', icon: '▤', cat: 'datos', desc: 'Lo que Arc guarda en este navegador', items: ['Almacenamiento', 'localStorage', 'Caché'] },
	{ id: 'avisos', label: 'Avisos', icon: '◬', cat: 'avisos', desc: 'Al móvil y notificaciones del sistema', items: ['Avisos al móvil', 'Notificaciones del sistema', 'Tu mañana'] },
	{ id: 'acerca', label: 'Acerca de', icon: 'ⓘ', cat: 'info', desc: 'Versión, novedades y ayuda', items: ['Versión', 'Novedades', 'Ayuda'] },
	{ id: 'fuentes', label: 'Fuentes', icon: '◎', cat: 'info', desc: 'De dónde salen los datos y su estado', items: ['Estado de las fuentes', 'Manual'] },
	{ id: 'atajos', label: 'Atajos de teclado', icon: '⌨', cat: 'info', desc: 'Todas las teclas', items: ['Atajos de teclado', 'Teclas'] }
] as const satisfies readonly SectionDef[];

export type SectionId = (typeof SECTIONS)[number]['id'];
/** Los ids de sección, para openApp('ajustes', id). */
export const SECTION_IDS = SECTIONS.map((s) => s.id) as SectionId[];

export const findSection = (id: string): SectionDef | undefined => SECTIONS.find((s) => s.id === id);

/** La sección de la ruta de la ventana: «apariencia», «/apariencia», «?s=apariencia» o «#apariencia». */
export function parseSection(path: string | undefined | null): SectionId | null {
	if (!path) return null;
	const m = /[?&]s=([\w-]+)/.exec(path);
	const id = (m ? m[1] : path.replace(/^[/#]+/, '').split(/[/?#]/)[0]).toLowerCase();
	return (SECTION_IDS as string[]).includes(id) ? (id as SectionId) : null;
}

export interface Hit {
	section: SectionDef;
	/** El ajuste suelto que ha encajado (si no, la sección entera). */
	item?: string;
}

/** Busca en secciones (nombre, categoría, descripción) y en sus ajustes sueltos. Sin texto, nada. */
export function searchSettings(q: string): Hit[] {
	const words = queryWords(q);
	if (!words.length) return [];
	const cat = (s: SectionDef) => CATEGORIES.find((c) => c.id === s.cat)?.label ?? '';
	const out: Hit[] = [];
	for (const s of SECTIONS as readonly SectionDef[]) {
		if (hasWords(`${s.label} ${cat(s)} ${s.desc}`, words)) out.push({ section: s });
		for (const item of s.items) if (hasWords(item, words) && !hasWords(s.label, words)) out.push({ section: s, item });
	}
	return out;
}
