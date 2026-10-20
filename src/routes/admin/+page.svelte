<!--
	/admin: panel del administrador (Sergi). Usuarios (último acceso, avisos), invitar o quitar (política de
	Access, cloud/admin.ts), las sugerencias recibidas (cloud/feedback.ts) y los errores que ven los usuarios en su
	navegador (cloud/errors.ts, sin quién). La página la puede abrir cualquiera con cuenta, pero los datos solo los
	da la API al email de ADMIN_EMAIL: a los demás, «Solo para el administrador».
	Comando ADMIN (src/lib/commands/admin.ts).
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { asset } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import ButtonRow from '#lib/components/ui/ButtonRow.svelte';
	import ChipInput from '#lib/components/ui/ChipInput.svelte';
	import Disclosure from '#lib/components/ui/Disclosure.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import Table from '#lib/components/ui/Table.svelte';

	interface User {
		email: string;
		seen: number | null;
		alerts: boolean;
		invited: boolean;
	}
	interface Item {
		id: number;
		user: string;
		view: string;
		text: string;
		at: number;
	}
	/** Un error de los navegadores, agrupado por firma (cloud/errors.ts). Sin quién. */
	interface BrowserError {
		sig: string;
		msg: string;
		stack: string;
		path: string;
		ver: string;
		ua: string;
		style: string;
		modo: string;
		embed: boolean;
		first: number;
		last: number;
		n: number;
	}

	const api = (p: string) => asset(p as Parameters<typeof asset>[0]);
	let phase = $state<'loading' | 'none' | 'denied' | 'ready' | 'error'>('loading');
	let users = $state<User[]>([]);
	let access = $state('');
	/** Tu email (el del administrador): a ti no te puedes quitar, así que no sale el botón. */
	let me = $state('');
	let items = $state<Item[]>([]);
	let errors = $state<BrowserError[]>([]);
	let message = $state('');
	let confirm = $state('');
	let busy = $state(false);

	async function load() {
		const res = await fetch(api('api/admin'), { cache: 'no-store', redirect: 'manual' });
		if (res.status === 403) return void (phase = 'denied');
		if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(String(res.status));
		const body = (await res.json()) as { users: User[]; access: string; admin?: string };
		users = body.users;
		access = body.access;
		me = body.admin ?? '';
		const fb = await fetch(api('api/feedback'), { cache: 'no-store', redirect: 'manual' });
		items = fb.ok ? ((await fb.json()) as { items: Item[] }).items : [];
		// Si los errores no cargan, el resto del panel sale igual.
		const er = await fetch(api('api/errors'), { cache: 'no-store', redirect: 'manual' }).catch(() => null);
		errors = er?.ok ? (((await er.json().catch(() => null)) as { items?: BrowserError[] } | null)?.items ?? []) : [];
		phase = 'ready';
	}

	$effect(() => {
		if (new URL(api('api/admin'), location.href).pathname !== '/api/admin') return void (phase = 'none');
		load().catch(() => (phase = 'error'));
	});

	async function act(action: 'invite' | 'remove', email: string) {
		busy = true;
		message = '';
		try {
			const res = await fetch(api('api/admin'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action, email }),
				redirect: 'manual'
			});
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			message = res.ok
				? action === 'invite'
					? `${email} ya puede entrar (código a su email).`
					: `${email} quitado y sus datos borrados.`
				: `No se ha podido: ${body.error ?? res.status}`;
			confirm = '';
			if (res.ok) await load();
		} catch {
			// Sin red: antes no salía nada (y el error quedaba suelto en la consola).
			message = 'No se ha podido: sin conexión. Prueba otra vez.';
			confirm = '';
		} finally {
			busy = false;
		}
	}

	let fbMessage = $state('');
	async function dismiss(id: number) {
		fbMessage = '';
		const res = await fetch(api(`api/feedback?id=${id}`), { method: 'DELETE', redirect: 'manual' }).catch(() => null);
		if (res?.ok) items = items.filter((i) => i.id !== id);
		else fbMessage = 'No se ha podido borrar. Prueba otra vez.';
	}

	const when = (ms: number | null) =>
		ms ? new Date(ms).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }) : '—';

	// Errores de los navegadores: los nuevos (de las últimas 24 h) arriba; luego, los que más se repiten.
	const DAY = 86_400_000;
	const isNew = (e: BrowserError) => Date.now() - e.first < DAY;
	let errMessage = $state('');
	/** La lista (para devolver el foco al borrar) y el «Ninguno», si ya no queda ninguno. */
	let errList = $state<HTMLElement>();
	let errEmpty = $state<HTMLElement>();
	const sortedErrors = $derived(
		[...errors].sort((a, b) => Number(isNew(b)) - Number(isNew(a)) || b.n - a.n || b.last - a.last)
	);
	const errTotal = $derived(errors.reduce((sum, e) => sum + e.n, 0));
	/** Los que han vuelto a salir en las últimas 24 h: se dice en el meta, no solo con el ámbar. */
	const errRecent = $derived(errors.filter((e) => Date.now() - e.last < DAY).length);
	const errMeta = $derived(
		errors.length
			? `${errors.length} · ${errTotal} ${errTotal === 1 ? 'vez' : 'veces'}${errRecent ? ` · ${errRecent} en 24 h` : ''}`
			: '0'
	);
	/** La versión es la hora de la publicación (en ms): se lee mejor como fecha. */
	const build = (ver: string) => (/^\d{13}$/.test(ver) ? when(Number(ver)) : ver || '—');

	async function fixed(sig: string) {
		errMessage = '';
		const at = sortedErrors.findIndex((e) => e.sig === sig);
		const res = await fetch(api(`api/errors?sig=${sig}`), { method: 'DELETE', redirect: 'manual' }).catch(() => null);
		if (!res?.ok) {
			errMessage = 'No se ha podido borrar. Prueba otra vez.';
			return;
		}
		errors = errors.filter((e) => e.sig !== sig);
		// El botón desaparece con el foco dentro, que caería al principio de la página: pasa al del siguiente error
		// (o al «Ninguno»). Solo si nadie lo ha movido mientras tanto.
		await tick();
		if (document.activeElement && document.activeElement !== document.body) return;
		const next = errList?.querySelectorAll<HTMLElement>('[data-fix]');
		(next?.[Math.min(at, next.length - 1)] ?? errEmpty)?.focus();
	}
</script>

<ViewHeader code="ADMIN" title="Administración" sub="Usuarios, invitaciones, sugerencias y errores" />

{#if phase !== 'ready'}
	<div class="grid">
		<Panel title="Administración">
			<p class="empty">
				{#if phase === 'loading'}Cargando…
				{:else if phase === 'none'}Solo en arcterminal.dev, con cuenta.
				{:else if phase === 'denied'}Solo para el administrador.
				{:else}No se ha podido cargar. Prueba más tarde.{/if}
			</p>
		</Panel>
	</div>
{:else}
	<div class="grid grid-2">
		<div class="col">
			<Panel title="Usuarios" meta="{users.filter((u) => u.invited).length} con acceso">
				<Table>
					<thead>
						<tr><th class="l">Email</th><th>Último acceso</th><th>Avisos</th><th></th></tr>
					</thead>
					<tbody>
						{#each users as u (u.email)}
							<tr>
								<td class="l name mail">{u.email}{#if !u.invited}<span class="sub"> sin acceso</span>{/if}</td>
								<td class="mut">{when(u.seen)}</td>
								<td>{u.alerts ? 'Sí' : '—'}</td>
								<td>
									{#if u.invited && access === 'ok' && u.email !== me}
										<button
											type="button"
											class="quit"
											class:warn={confirm === u.email}
											disabled={busy}
											onclick={() => (confirm === u.email ? act('remove', u.email) : (confirm = u.email))}
											>{confirm === u.email ? '¿Seguro?' : 'Quitar'}</button
										>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</Table>
				{#snippet note()}Quitar le cierra la sesión, le saca de la política de Access y borra sus ajustes y avisos.{/snippet}
			</Panel>
			<Panel title="Invitar" meta={access === 'ok' ? 'Access listo' : access} accent={access !== 'ok'}>
				{#if access === 'ok'}
					<ChipInput label="Email a invitar" placeholder="nombre@correo.es" onadd={(v) => act('invite', v.toLowerCase())} />
				{:else}
					<p class="empty">Para invitar desde aquí falta el token de Access en Cloudflare Pages.</p>
				{/if}
				{#if message}<p class="msg" role="status">{message}</p>{/if}
				{#snippet note()}Le llegará un código a ese email la primera vez que abra arcterminal.dev.{/snippet}
			</Panel>
		</div>
		<div class="col">
			<Panel title="Sugerencias" meta={String(items.length)} accent={items.length > 0}>
				{#if !items.length}
					<p class="empty">Ninguna por ahora.</p>
				{:else}
					<ul class="fb">
						{#each items as i (i.id)}
							<li>
								<div class="head"><span>{i.user}</span><span>{i.view}</span><span>{when(i.at)}</span></div>
								<p>{i.text}</p>
								<ButtonRow><button type="button" onclick={() => dismiss(i.id)}>Hecho, borrar</button></ButtonRow>
							</li>
						{/each}
					</ul>
				{/if}
				{#if fbMessage}<p class="msg" role="status">{fbMessage}</p>{/if}
			</Panel>
			<Panel title="Errores" meta={errMeta} accent={errRecent > 0}>
				{#if !errors.length}
					<p class="empty" tabindex="-1" bind:this={errEmpty}>Ninguno por ahora.</p>
				{:else}
					<!-- Una lista como la de Sugerencias (y no una tabla): en el móvil, el mensaje y la pila se leen enteros. -->
					<ul class="fb" bind:this={errList}>
						{#each sortedErrors as e (e.sig)}
							<li>
								<div class="head">
									{#if isNew(e)}<span class="new">nuevo</span>{/if}
									<span class="times">{e.n} {e.n === 1 ? 'vez' : 'veces'}</span>
									<span>{when(e.last)}</span>
									<span>{e.path}{e.embed ? ' en Arc OS' : ''}</span>
									<span>{e.ua}</span>
									<span>{e.style || '—'} · {e.modo || '—'}</span>
									<span>build {build(e.ver)}</span>
								</div>
								<p>{e.msg}</p>
								{#if e.stack}
									<div class="stack">
										<Disclosure inline>
											{#snippet summary()}Pila{/snippet}
											<pre>{e.stack}</pre>
										</Disclosure>
									</div>
								{/if}
								<ButtonRow>
									<button type="button" data-fix aria-label="Arreglado, borrar: {e.msg}" onclick={() => fixed(e.sig)}
										>Arreglado, borrar</button
									>
								</ButtonRow>
							</li>
						{/each}
					</ul>
				{/if}
				{#if errMessage}<p class="msg" role="status">{errMessage}</p>{/if}
				{#snippet note()}Sin quién: ni email ni cuenta. La ruta va sin consulta y el mensaje y la pila, recortados.
					«Arreglado» lo borra: si vuelve a salir, no lo estaba.{/snippet}
			</Panel>
		</div>
	</div>
	<Note>Esta página solo da datos al email de administrador (Secret ADMIN_EMAIL de Cloudflare Pages).</Note>
{/if}

<style>
	/* En el móvil, un email largo empujaba «Último acceso» y «Quitar» fuera de la pantalla. */
	.mail {
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.quit {
		height: var(--control-h);
		padding-inline: var(--sp-8);
		background: none;
		border: var(--border);
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		cursor: pointer;
	}

	.quit.warn {
		color: var(--amber);
		border-color: var(--amber-edge);
	}

	.msg {
		margin: 0;
		padding: var(--row-y) var(--pad-x);
		color: var(--amber-dim);
		font-size: var(--fs-s);
	}

	.fb {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Sin borde propio: cada fila acaba en ButtonRow, que ya pone la línea de 1 px. */
	.head {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-12);
		padding: var(--row-y) var(--pad-x) 0;
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	.fb p {
		margin: 0;
		padding: var(--sp-4) var(--pad-x) var(--row-y);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	/* Errores: cuántas veces, un punto más claro que el resto de la cabecera. */
	.times {
		color: var(--fg);
	}

	.new {
		color: var(--amber-dim);
	}

	.stack {
		padding: 0 var(--pad-x) var(--row-y);
		font-size: var(--fs-xs);
	}

	.stack pre {
		margin: var(--sp-4) 0 0;
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
