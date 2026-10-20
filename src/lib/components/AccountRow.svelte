<!--
	Fila «Tu cuenta» de HELP («A tu gusto»): con qué cuenta has entrado, «Cerrar sesión» y «Borrar mi cuenta». HELP solo
	la pone con cuenta (cloud.user: en arcterminal.dev, detrás de Cloudflare Access).
	«Cerrar sesión» es la salida de Access (el service worker deja pasar /cdn-cgi/) y no borra nada de aquí: si entra
	otra persona, la sincronización cambia lo de este navegador por lo de su cuenta (startPlan en cloud.ts).
	«Borrar mi cuenta» va en dos pasos, sin ventana encima: el botón abre la confirmación debajo y hay que escribir
	BORRAR. Igual para todos, también para el admin. La lógica, en src/lib/account.svelte.ts.
-->
<script lang="ts">
	import { LOGOUT } from '#lib/account.ts';
	import { deleteAccount } from '#lib/account.svelte.ts';
	import { cloud, flushNow } from '#lib/cloud.svelte.ts';

	const WORD = 'BORRAR';
	let confirming = $state(false);
	let busy = $state(false);
	let typed = $state('');
	let msg = $state('');
	let input = $state<HTMLInputElement>();
	const ready = $derived(typed.trim().toUpperCase() === WORD);

	// Al abrir la confirmación, el cursor va al campo (en el móvil sale el teclado: hay que escribir).
	$effect(() => {
		if (confirming) input?.focus();
	});

	function toggle() {
		confirming = !confirming;
		typed = '';
		msg = '';
	}

	async function remove() {
		if (!ready || busy) return;
		busy = true;
		msg = '';
		// Si sale bien, la página se va a la salida de Access: no hay nada más que hacer aquí.
		msg = (await deleteAccount()) ?? '';
		if (msg) busy = false;
	}
</script>

<div class="row">
	<span class="acts">
		<a
			href={LOGOUT}
			data-sveltekit-reload
			aria-disabled={busy}
			onclick={(e) => {
				if (busy) e.preventDefault();
				else flushNow();
			}}>Cerrar sesión</a
		>
		·
		<button
			class="link"
			type="button"
			disabled={busy}
			aria-expanded={confirming}
			aria-controls={confirming ? 'account-delete' : undefined}
			onclick={toggle}>{confirming ? 'Cancelar' : 'Borrar mi cuenta'}</button
		>
	</span>
	<span class="what">Todo esto se guarda en tu cuenta ({cloud.user}) y llega solo a tus otros dispositivos.</span>
</div>
{#if confirming}
	<form
		id="account-delete"
		class="confirm"
		onsubmit={(e) => {
			e.preventDefault();
			void remove();
		}}
	>
		<p>
			Se borra todo lo tuyo de la cuenta (ajustes, avisos, familia, Mis RSS, predicciones y sugerencias) y de este
			dispositivo, y se cierra la sesión. No se puede deshacer: podrás volver a entrar, pero desde cero.
		</p>
		<label for="account-word">Escribe {WORD}</label>
		<input
			id="account-word"
			bind:this={input}
			bind:value={typed}
			disabled={busy}
			autocomplete="off"
			autocapitalize="characters"
			spellcheck="false"
		/>
		<button class="go" type="submit" disabled={!ready || busy}>{busy ? 'Borrando…' : 'Borrar para siempre'}</button>
	</form>
{/if}
{#if msg}<p class="msg" role="alert">{msg}</p>{/if}

<style>
	/* Un email largo baja de línea en vez de salirse del panel; «Cerrar sesión» y «Borrar mi cuenta» no se parten. */
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--sp-4) var(--sp-8);
		color: var(--faint);
		font-size: var(--fs-s);
		overflow-wrap: anywhere;
	}

	.acts {
		flex: 0 1 auto;
	}

	.acts > * {
		white-space: nowrap;
	}

	.what {
		flex: 1 1 16em;
		min-width: 0;
	}

	.link {
		padding: 0;
		font: inherit;
		color: var(--amber-dim);
		background: none;
		border: 0;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: var(--sp-2);
	}

	.link:disabled,
	a[aria-disabled='true'] {
		color: var(--faint);
		cursor: default;
	}

	.confirm {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8);
		margin-top: var(--sp-8);
		font-size: var(--fs-s);
		color: var(--muted);
	}

	.confirm p {
		flex: 1 1 100%;
		margin: 0;
	}

	input {
		flex: 1 1 8em;
		min-width: 0;
		height: var(--control-h);
		padding: 0 var(--sp-6);
		background: var(--bg);
		color: var(--fg);
		border: var(--border);
		font: inherit;
		font-family: var(--mono);
		letter-spacing: var(--track-code);
	}

	.go {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: var(--amber-soft);
		color: var(--amber);
		border: var(--hair) solid var(--amber-edge);
		font: inherit;
		cursor: pointer;
	}

	.go:disabled {
		background: none;
		color: var(--faint);
		border-color: var(--line);
		cursor: default;
	}

	.msg {
		margin: var(--sp-8) 0 0;
		font-size: var(--fs-s);
		color: var(--amber);
	}
</style>
