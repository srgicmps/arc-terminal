<!--
	«Actividades» del aspecto Linux (al estilo GNOME): todas las ventanas del escritorio en mosaico para elegir
	una, los escritorios virtuales a la derecha (con «+»), las apps ancladas abajo y un buscador arriba que, al
	escribir, cambia el mosaico por las apps que coinciden. Escape o tocar el fondo, vuelve.
-->
<script lang="ts">
	import OsIcon from '../icons/OsIcon.svelte';
	import { tick } from 'svelte';
	import * as os from './bridge.ts';
	import { shell } from './shell.svelte.ts';
	import { searchApps, type StartApp } from './start.ts';

	let query = $state('');
	let input = $state<HTMLInputElement>();
	const wins = $derived(os.windows());
	const desks = $derived(os.desks());
	const found = $derived(searchApps(os.installed(), query).slice(0, 12));
	const byId = new Map(os.apps.map((a) => [a.id, a]));
	const dash = $derived(shell.pinned.map((id) => byId.get(id)).filter((a): a is StartApp => !!a));

	$effect(() => {
		tick().then(() => input?.focus());
	});

	const done = () => (shell.open = null);
	function pick(uid: string) {
		os.focusWin(uid);
		done();
	}
	function launch(id: string) {
		done();
		os.open(id);
	}
	function key(e: KeyboardEvent) {
		if (e.key === 'Escape') done();
		if (e.key === 'Enter' && query.trim() && found[0]) launch(found[0].id);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="acts" role="dialog" aria-label="Actividades" tabindex="-1" onkeydown={key} onclick={(e) => e.target === e.currentTarget && done()}>
	<input bind:this={input} bind:value={query} type="search" placeholder="Escribe para buscar" aria-label="Buscar apps" />

	<div class="main">
		{#if query.trim()}
			<ul class="apps" aria-label="Apps">
				{#each found as a (a.id)}
					<li><button type="button" onclick={() => launch(a.id)}><OsIcon id={a.id} size={32} /><span>{a.title}</span></button></li>
				{:else}
					<li class="none">Nada con «{query}».</li>
				{/each}
			</ul>
		{:else if wins.length}
			<ul class="wins" aria-label="Ventanas abiertas" style:--n={Math.ceil(Math.sqrt(wins.length))}>
				{#each wins as w (w.id)}
					<li>
						<button type="button" class="card" class:min={w.minimized} onclick={() => pick(w.id)}>
							<OsIcon id={w.appId} size={64} />
						</button>
						<span class="label">
							<span>{w.title}{w.minimized ? ' · minimizada' : ''}</span>
							<button type="button" class="x" aria-label={`Cerrar ${w.title}`} onclick={() => os.winClose(w.id)}>✕</button>
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="none">No hay ventanas abiertas en este escritorio. Abre una app desde abajo o escribe para buscar.</p>
		{/if}

		<ul class="desks" aria-label="Escritorios">
			{#each desks as d, i (d.id)}
				<li><button type="button" aria-pressed={d.active} onclick={() => os.switchDesk(d.id)}><span>{i + 1}</span><small>{d.name}</small></button></li>
			{/each}
			<li><button type="button" class="add" aria-label="Escritorio nuevo" onclick={os.addDesk}>＋</button></li>
		</ul>
	</div>

	<ul class="dash" aria-label="Apps favoritas">
		{#each dash as a (a.id)}
			{@const open = wins.some((w) => w.appId === a.id)}
			<li><button type="button" title={a.title} aria-label={a.title} onclick={() => launch(a.id)}><OsIcon id={a.id} size={44} /></button>{#if open}<i class="dot"></i>{/if}</li>
		{/each}
		<li class="sep" aria-hidden="true"></li>
		<li><button type="button" title="Mostrar aplicaciones" aria-label="Mostrar aplicaciones" onclick={() => (shell.open = 'launchpad')}><OsIcon id="launchpad" size={44} /></button></li>
	</ul>
</div>

<style>
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.acts {
		position: fixed;
		inset: var(--os-bar-h) 0 0 0;
		z-index: var(--z-modal);
		display: grid;
		grid-template-rows: auto 1fr auto;
		justify-items: center;
		gap: var(--sp-16);
		padding: var(--sp-16);
		background: var(--os-topbar-bg);
		color: var(--os-topbar-fg);
	}
	input {
		width: min(320px, 80vw);
		height: var(--control-h);
		padding: 0 var(--sp-16);
		border: 0;
		border-radius: var(--os-menu-radius, var(--radius));
		background: var(--os-topbar-hover);
		color: inherit;
		font: inherit;
		text-align: center;
	}
	.main {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--sp-16);
		width: 100%;
		min-height: 0;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.wins {
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
		align-content: center;
		gap: var(--sp-24);
		padding: var(--sp-16);
		overflow: auto;
	}
	.card {
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 16 / 10;
		max-height: 32vh;
		border-radius: var(--os-win-radius);
		background: var(--os-win-bg);
		color: var(--amber);
		box-shadow: var(--os-win-shadow);
		outline-offset: var(--sp-4);
		transition: transform var(--dur-fast) var(--ease);
	}
	.card:focus-visible {
		outline: var(--sp-2) solid var(--amber);
	}
	@media (hover: hover) {
		.card:hover {
			outline: var(--sp-2) solid var(--amber);
		}
	}
	.card.min {
		opacity: 0.6;
	}
	.label {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: var(--sp-6);
		margin-top: var(--sp-8);
		font-size: var(--fs-s);
	}
	.x {
		width: var(--control-h);
		height: var(--control-h);
		border-radius: 50%;
		opacity: 0.7;
	}
	@media (hover: hover) {
		.x:hover {
			background: var(--os-topbar-hover);
			opacity: 1;
		}
	}
	.desks {
		display: grid;
		align-content: start;
		gap: var(--sp-8);
	}
	.desks button {
		display: grid;
		place-items: center;
		width: 96px;
		aspect-ratio: 16 / 10;
		border: var(--hair) solid var(--os-topbar-hover);
		border-radius: var(--radius);
		font-family: var(--mono);
	}
	.desks button[aria-pressed='true'] {
		border-color: var(--amber);
	}
	.desks small {
		font-family: var(--os-font, var(--sans));
		font-size: var(--fs-xxs);
		opacity: 0.7;
	}
	.apps {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		align-content: start;
		gap: var(--sp-12);
	}
	.apps button {
		display: grid;
		justify-items: center;
		gap: var(--sp-6);
		width: 100%;
		padding: var(--sp-8);
		border-radius: var(--radius);
		font-size: var(--fs-s);
	}
	.apps button:focus-visible {
		background: var(--os-topbar-hover);
	}
	@media (hover: hover) {
		.apps button:hover {
			background: var(--os-topbar-hover);
		}
	}
	.none {
		align-self: center;
		justify-self: center;
		opacity: 0.7;
	}
	.dash {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		padding: var(--sp-6);
		border-radius: var(--os-menu-radius, var(--radius));
		background: var(--os-topbar-hover);
	}
	.dash li {
		position: relative;
		display: grid;
		justify-items: center;
	}
	.dot {
		position: absolute;
		bottom: calc(-1 * var(--sp-4));
		width: var(--sp-4);
		height: var(--sp-4);
		border-radius: 50%;
		background: currentColor;
	}
	.sep {
		align-self: stretch;
		width: var(--hair);
		background: currentColor;
		opacity: 0.3;
	}
	/* iPhone e iPad: con menos de 16 px, Safari amplía la página al escribir (--fs-field vale 16 px en táctil). */
	@media (pointer: coarse) {
		input {
			font-size: var(--fs-field);
		}
	}
</style>
