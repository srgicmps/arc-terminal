<!--
	Panel «Tu cuenta» de HELP: con qué cuenta has entrado, «Cerrar sesión» y «Borrar mi cuenta». Solo sale con cuenta
	(cloud.user: en arcterminal.dev, detrás de Cloudflare Access), como AVISOS. La lógica está en src/lib/cloud.svelte.ts.
	Borrar va en dos pasos, sin ventana encima: el botón abre la confirmación y hay que escribir BORRAR. Igual para todos,
	también para el admin.
-->
<script lang="ts">
	import Panel from './Panel.svelte';
	import ButtonRow from './ui/ButtonRow.svelte';
	import { cloud, deleteAccount, signOut, type Blocked } from '#lib/cloud.svelte.ts';

	const WORD = 'BORRAR';
	let confirming = $state(false);
	let busy = $state(false);
	let typed = $state('');
	let blocked = $state<Blocked | null>(null);
	let input = $state<HTMLInputElement>();
	const ready = $derived(typed.trim().toUpperCase() === WORD);

	// Al abrir la confirmación, el cursor va al campo (en el móvil sale el teclado: hay que escribir).
	$effect(() => {
		if (confirming) input?.focus();
	});

	async function out() {
		busy = true;
		blocked = await signOut(blocked?.force);
		// Si sale bien, la página se va a la salida de Access: no hay nada más que hacer aquí.
		if (blocked) busy = false;
	}

	function toggle() {
		confirming = !confirming;
		typed = '';
		blocked = null;
	}

	async function remove() {
		if (!ready || busy) return;
		busy = true;
		blocked = await deleteAccount();
		if (blocked) busy = false;
	}
</script>

{#if cloud.user}
	<Panel title="Tu cuenta" meta={cloud.user}>
		<ButtonRow>
			<button type="button" class:warn={blocked?.force} disabled={busy} onclick={out}
				>{blocked?.force ? 'Salir igual' : 'Cerrar sesión'}</button
			>
			<button
				type="button"
				disabled={busy}
				aria-expanded={confirming}
				aria-controls="account-delete"
				onclick={toggle}>{confirming ? 'Cancelar' : 'Borrar mi cuenta'}</button
			>
		</ButtonRow>
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
					dispositivo. No se puede deshacer: podrás volver a entrar, pero desde cero.
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
				<button type="submit" disabled={!ready || busy}>Borrar para siempre</button>
			</form>
		{/if}
		{#if blocked}<p class="msg" role="alert">{blocked.text}</p>{/if}
		{#snippet note()}
			«Cerrar sesión» sale de tu cuenta en este dispositivo y borra de él lo tuyo, que vuelve al entrar: útil en uno
			compartido.
		{/snippet}
	</Panel>
{/if}

<style>
	.confirm {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
		font-size: var(--fs-s);
		color: var(--muted);
	}

	.confirm p {
		flex: 1 1 100%;
		margin: 0;
		font-family: var(--sans);
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

	.confirm button {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: var(--amber-soft);
		color: var(--amber);
		border: var(--hair) solid var(--amber-edge);
		font: inherit;
		cursor: pointer;
	}

	.confirm button:disabled {
		background: none;
		color: var(--faint);
		border-color: var(--line);
		cursor: default;
	}

	.msg {
		margin: 0;
		padding: var(--row-y) var(--pad-x);
		font-size: var(--fs-s);
		color: var(--amber);
	}
</style>
