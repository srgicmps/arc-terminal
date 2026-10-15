// Acciones de la barra (lote 27-B): órdenes que no abren una vista, sino que hacen algo con ella.
// «compartir WS» copia (o comparte, en el móvil) el enlace de la vista WS; «compartir» solo, el de la
// vista abierta. Lógica pura, sin Svelte, para poder probarla con Vitest.
import { canonical, norm, resolveInput, splitInput, suggest, targetPath, type Option, type Target } from './cmdline.ts';
import type { ShareInfo } from './share.ts';

/** Palabras que lanzan «compartir» (en mayúsculas y sin tildes, como las compara `norm`). */
const SHARE_WORDS = ['COMPARTIR', 'SHARE'];

export type Action = { kind: 'share'; arg: string };

/** ¿Es una acción? «compartir WS» → { share, «WS» }. Null si es un comando normal. */
export function parseAction(raw: string): Action | null {
	const { head, arg } = splitInput(raw);
	if (SHARE_WORDS.includes(norm(head))) return { kind: 'share', arg };
	return null;
}

/** La vista que se comparte: la de lo escrito tras «compartir» (null si no hay nada: la vista abierta). */
export function shareTarget(action: Action, all: Option[]): Target | null {
	if (!action.arg) return null;
	return resolveInput(action.arg, suggest(action.arg, all));
}

/** Título y ruta (sin la base) de lo que se comparte: «Arc Terminal · WS», «/ws». */
export function shareInfo(target: Target): ShareInfo & ReturnType<typeof targetPath> {
	const { route, search } = targetPath(target);
	const name = target.kind === 'symbol' ? target.sym : target.command.desc;
	return { title: `Arc Terminal · ${canonical(target)}`, text: name, route, search };
}

/** La sugerencia de la barra: «COMPARTIR WS · Copia el enlace de la vista». */
export function actionOption(action: Action, raw: string, all: Option[]): Option {
	const target = shareTarget(action, all);
	const what = target ? canonical(target) : 'esta vista';
	return {
		code: target ? `COMPARTIR ${what}` : 'COMPARTIR',
		desc: `Copia el enlace de ${target ? what : 'esta vista'} (en el móvil, abre el menú de compartir)`,
		kind: 'Acción',
		run: raw.trim()
	};
}
