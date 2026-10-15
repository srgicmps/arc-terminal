// Comandos de la barra: cada uno abre una vista. Hay un archivo por comando en src/lib/commands/
// (top.ts, eco.ts…), que exporta su Command. Aquí se juntan solos con import.meta.glob, como un
// registro: un comando nuevo es un archivo nuevo y no toca ningún archivo compartido.
// import.meta.glob es de Vite: este archivo no se puede importar desde los scripts de Node.
import type { RouteId } from '$app/types';

export interface Command {
	/** Posición en la barra, la ayuda y las teclas de función (de 10 en 10, para poder meter otros entre medias). */
	order: number;
	code: string;
	/** Ruta de SvelteKit. */
	route: RouteId;
	/** Nombre corto para la tecla. */
	key: string;
	/** Qué abre, para las sugerencias y la ayuda. */
	desc: string;
	sources: string;
	/** Si sale en la fila de teclas de función. */
	pinned?: boolean;
	/** Otras formas de pedirlo, en español (se comparan sin tildes ni mayúsculas). */
	aliases?: string[];
	/**
	 * Si acepta un texto detrás («NEWS inflación»): el parámetro de la URL que lo recibe
	 * (/news?q=inflación), qué hace con él y un ejemplo para la ayuda.
	 */
	arg?: { param: string; label: string; example: string };
	/** Su ficha en el MANUAL (src/routes/manual): un test falla si falta. */
	manual?: Manual;
}

/** Secciones del MANUAL, en el orden en que salen. */
export const MANUAL_SECTIONS = ['Portada y resumen', 'Economía y mercados', 'Mundo', 'España', 'Tecnología', 'Utilidades', 'Sistema'] as const;
export type ManualSection = (typeof MANUAL_SECTIONS)[number];

/** Ficha de un comando en el MANUAL. */
export interface Manual {
	section: ManualSection;
	/** Qué es y para qué sirve, en una o dos frases. */
	what: string;
	/** Qué acepta detrás. Cada ejemplo es una entrada completa de la barra («FUEL Madrid»). */
	args?: { label: string; examples: string[]; options?: string[] }[];
	tips?: string[];
	/** Sus paneles: el título tal y como sale y qué enseña. */
	panels?: { name: string; what: string }[];
}

const modules = import.meta.glob<Command>('./commands/*.ts', { eager: true, import: 'default' });

export const COMMANDS: Command[] = Object.values(modules).sort((a, b) => a.order - b.order);
