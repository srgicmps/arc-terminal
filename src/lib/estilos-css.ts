// Hojas de las estéticas: static/estilos/<id>.css. No van en el paquete de cada vista (pesarían en todas): se carga
// solo la elegida, con un <link> que pone src/app.html antes de pintar y que setStyle cambia. Las vistas previas
// (StylePicker) cargan las demás al abrirse. El orden da igual: van en la capa «estilos» (ver app.css).
import { asset } from '$app/paths';

/** Dirección de la hoja de una estética (null para Terminal, que no tiene). */
export const sheetHref = (id: string) => (id === 'terminal' ? null : asset(`/estilos/${id}.css` as Parameters<typeof asset>[0]));

/** Pone (o quita) el <link> con id `linkId` para la hoja de esa estética. */
export function useSheet(id: string, linkId: string) {
	const href = sheetHref(id);
	let link = document.getElementById(linkId) as HTMLLinkElement | null;
	if (!href) return link?.remove();
	if (!link) {
		link = document.createElement('link');
		link.id = linkId;
		link.rel = 'stylesheet';
		document.head.append(link);
	}
	if (link.getAttribute('href') !== href) link.href = href;
}
