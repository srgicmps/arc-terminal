// Ejecuta las acciones de la barra (src/lib/actions.ts) en el navegador: cambia MIS o las palabras
// vigiladas, abre el issue para la Action o comparte. Devuelve el aviso corto que enseña la barra.
// window.open va sin esperas: si hubiera un await antes, el navegador lo bloquearía como ventana emergente.
import { parseAction, nextMis, shareInfo, shareTarget } from './actions.ts';
import type { Option } from './cmdline.ts';
import { routeHref } from './routes.ts';
import { legacyCopy, shareOrCopy } from './share.ts';
import { issuesUrl, issueUrl, LIMITS } from './useralerts.ts';
import { initWatchlist, setCodes, watchlist } from './watchlist.svelte.ts';
import { addWatchword, initWatchwords, watchwords } from './watchwords.svelte.ts';

const open = (url: string) => void window.open(url, '_blank', 'noopener');

/** Ejecuta lo escrito si es una acción. `flash` enseña el resultado en la barra. False si no lo era. */
export function runAction(raw: string, all: Option[], flash: (text: string) => void): boolean {
	const action = parseAction(raw);
	if (!action) return false;
	switch (action.kind) {
		case 'share':
			void share(action, all, flash);
			break;
		case 'mis': {
			initWatchlist();
			const codes = nextMis(watchlist.codes, action);
			setCodes(codes);
			open(issueUrl('mis', codes.slice(0, LIMITS.mis).join(' ') || '(vacía)'));
			flash(`${action.code} ${action.add ? 'añadido a' : 'quitado de'} MIS`);
			break;
		}
		case 'watch': {
			if (!action.word) return true;
			initWatchwords();
			addWatchword(action.word);
			open(issueUrl('vigila', watchwords.words.slice(0, LIMITS.words).join(', ')));
			flash(`Vigilando «${action.word}»`);
			break;
		}
		case 'alert':
			// El título lleva lo escrito tal cual («NVDA > 150»): la Action lo vuelve a leer con parseAlert.
			if (action.alert) {
				open(issueUrl('alerta', action.raw.replace(/\s+/g, ' ').trim()));
				flash('Pulsa «Submit» en GitHub para guardar la alerta');
			}
			else if (!action.raw) open(issuesUrl('alerta'));
			break;
	}
	return true;
}

/** «compartir WS»: el menú del sistema en el móvil; si no, copia el enlace al portapapeles. */
async function share(action: { arg: string }, all: Option[], flash: (text: string) => void) {
	const target = shareTarget(action, all);
	const info = target ? shareInfo(target) : null;
	const url = info ? new URL(routeHref(info.route) + info.search, location.href).href : location.href;
	const data = info ? { title: info.title, text: info.text, url } : { title: document.title, url };
	const result = await shareOrCopy(data, navigator, (t) => legacyCopy(t, document));
	if (result === 'copied') flash('Enlace copiado');
	else if (result === 'failed') flash('No se ha podido copiar el enlace');
}
