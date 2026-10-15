// Abrir lo que apunta un archivo de Arc OS («note:<id>», «tick:NVDA», «desk:d1», «fav:ECO TIPOS», «app:eco»).
// Lo usan el explorador y el escritorio (openNode de fs.svelte.ts), así un archivo se abre igual desde los dos.
import { resolveInput, targetPath } from '../../../cmdline.ts';
import { goDesk, openApp, openPath } from '../../os.svelte.ts';
import { openNote } from '../notes/notes.svelte.ts';
import { parseRef } from './explorer.ts';

/** Una ruta de la web en una ventana; la ficha de un valor (/s) no es una app: va en una ventana de MIS. */
const openRoute = (path: string) => openPath(path) ?? openApp('mis', path, true);

export function openRef(ref: string) {
	const r = parseRef(ref);
	if (!r) return;
	if (r.kind === 'app') openApp(r.id);
	else if (r.kind === 'note') openNote(r.id);
	else if (r.kind === 'desk') goDesk(r.id);
	else if (r.kind === 'tick') openRoute(`/s?sym=${encodeURIComponent(r.id)}`);
	else if (r.kind === 'fav') {
		const target = resolveInput(r.id, []);
		if (!target) return;
		const { route, search } = targetPath(target);
		openRoute(route + search);
	}
}
