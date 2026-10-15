// Ejecuta un resultado del buscador universal (search.ts): abre la app o la ruta en una ventana, o hace la
// acción del sistema. Lo usan el Spotlight del escritorio («OS 2») y el del móvil («OS 3»).
import { navigate, open, showDesktop, leave } from '../shell/bridge.ts';
import { shell } from '../shell/shell.svelte.ts';
import type { Hit } from './search.ts';
import { lock } from './system.svelte.ts';

export function runHit(hit: Hit): void {
	const a = hit.action;
	if ('app' in a) return open(a.app);
	if ('path' in a) return navigate(a.path);
	if (a.sys === 'lock') lock();
	else if (a.sys === 'leave') leave();
	else if (a.sys === 'desktop') showDesktop();
	else shell.open = a.sys;
}
