// Avisos de la cuenta en Arc OS: si se pierde la conexión con ella, caduca la sesión o algo no cabe, sale un aviso
// en el centro de notificaciones (una vez por cada cosa y sesión, no en cada reintento). Lo arranca SystemLayer.
import { cloud } from '../../cloud.svelte.ts';
import { notify } from '../shell/shell.svelte.ts';
import { accountLine } from './account.ts';

export function startAccount(): () => void {
	const told = new Set<string>();
	return $effect.root(() => {
		$effect(() => {
			const { state, user } = cloud;
			const frozen = cloud.frozen;
			// Un aviso por estado; si vuelve a ir bien, se puede volver a avisar la próxima vez que falle.
			if (state === 'ok') for (const k of told) if (!k.startsWith('big:')) told.delete(k);
			const line = accountLine(state, user, frozen);
			const id = state === 'ok' ? `big:${frozen.join()}` : state;
			if (!line.warn || told.has(id)) return;
			told.add(id);
			notify({ title: state === 'ok' ? 'No todo cabe en tu cuenta' : 'Tu cuenta', detail: line.text, kind: 'aviso' });
		});
	});
}
