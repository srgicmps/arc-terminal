// «Borrar mi cuenta»: DELETE /api/account. Lo usa HELP (panel «Tu cuenta», src/lib/cloud.svelte.ts → deleteAccount).
// Solo una persona (JWT de Access con email, verificado: access.ts → person) y solo lo suyo: borra sus filas de
// todas las tablas de USER_TABLES con el mismo forget() que «Quitar» de /admin. El email sale del JWT, nunca del
// cuerpo. No la saca de la política de Access (eso es cosa del admin): si vuelve a entrar, empieza de cero.
// Para que no se borre nada sin querer, el cuerpo tiene que traer { confirm: '<su email>' }, el que ve en HELP.
// El admin también puede borrarse, con la misma confirmación.
import { person } from './access.ts';
import type { AdminStore } from './admin.ts';
import { readJson } from './feedback.ts';
import { json, type Env } from './prefs.ts';

export async function handleAccount(
	request: Request,
	env: Env,
	store: Pick<AdminStore, 'forget'> | null,
	fetcher?: (url: string) => Promise<Response>
): Promise<Response> {
	if (!store) return json(503, { error: 'sin configurar' });
	const who = await person(request, env, fetcher);
	if (who instanceof Response) return who;
	if (request.method !== 'DELETE') return json(405, { error: 'método' });
	const body = await readJson(request, 500);
	if (body instanceof Response) return body;
	const confirm = typeof body.confirm === 'string' ? body.confirm.trim().toLowerCase() : '';
	if (confirm !== who.email) return json(400, { error: 'confirmación' });
	await store.forget(who.email);
	return json(200, { ok: true });
}
