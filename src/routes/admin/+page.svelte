<!--
	/admin: panel del administrador (Sergi). Usuarios (último acceso, avisos), invitar o quitar (política de
	Access, cloud/admin.ts) y las sugerencias recibidas (cloud/feedback.ts). La página la puede abrir cualquiera
	con cuenta, pero los datos solo los da la API al email de ADMIN_EMAIL: a los demás, «Solo para el administrador».
	Comando ADMIN (src/lib/commands/admin.ts).
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import ButtonRow from '#lib/components/ui/ButtonRow.svelte';
	import ChipInput from '#lib/components/ui/ChipInput.svelte';
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

	const api = (p: string) => asset(p as Parameters<typeof asset>[0]);
	let phase = $state<'loading' | 'none' | 'denied' | 'ready' | 'error'>('loading');
	let users = $state<User[]>([]);
	let access = $state('');
	let items = $state<Item[]>([]);
	let message = $state('');
	let confirm = $state('');
	let busy = $state(false);

	async function load() {
		const res = await fetch(api('api/admin'), { cache: 'no-store', redirect: 'manual' });
		if (res.status === 403) return void (phase = 'denied');
		if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(String(res.status));
		const body = (await res.json()) as { users: User[]; access: string };
		users = body.users;
		access = body.access;
		const fb = await fetch(api('api/feedback'), { cache: 'no-store', redirect: 'manual' });
		items = fb.ok ? ((await fb.json()) as { items: Item[] }).items : [];
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
		} finally {
			busy = false;
		}
	}

	async function dismiss(id: number) {
		const res = await fetch(api(`api/feedback?id=${id}`), { method: 'DELETE', redirect: 'manual' });
		if (res.ok) items = items.filter((i) => i.id !== id);
	}

	const when = (ms: number | null) =>
		ms ? new Date(ms).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }) : '—';
</script>

<ViewHeader code="ADMIN" title="Administración" sub="Usuarios, invitaciones y sugerencias" />

{#if phase === 'loading'}
	<p class="empty">Cargando…</p>
{:else if phase === 'none'}
	<p class="empty">Solo en arcterminal.dev, con cuenta.</p>
{:else if phase === 'denied'}
	<p class="empty">Solo para el administrador.</p>
{:else if phase === 'error'}
	<p class="empty">No se ha podido cargar. Prueba más tarde.</p>
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
								<td class="l name">{u.email}{#if !u.invited}<span class="sub"> sin acceso</span>{/if}</td>
								<td class="mut">{when(u.seen)}</td>
								<td>{u.alerts ? 'Sí' : '—'}</td>
								<td>
									{#if u.invited && access === 'ok'}
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
			</Panel>
		</div>
	</div>
	<Note>Esta página solo da datos al email de administrador (Secret ADMIN_EMAIL de Cloudflare Pages).</Note>
{/if}

<style>
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

	.fb li {
		border-bottom: var(--border);
	}

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
</style>
