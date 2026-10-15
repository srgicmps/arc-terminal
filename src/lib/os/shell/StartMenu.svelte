<!--
	Menú Inicio de Arc OS: buscador arriba, ancladas y recientes, y todas las apps por categorías (Mercados,
	Economía, Mundo, Casa, Dinero, Experiencias, Herramientas). «☆» ancla o desancla una app en la barra.
	Escape lo cierra; Intro en el buscador abre la primera que coincide.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { opened, pin, shell } from './shell.svelte.ts';
	import { byCategory, searchApps, type StartApp } from './start.ts';

	interface Props {
		apps: StartApp[];
		onopen: (id: string) => void;
		onleave: () => void;
	}
	let { apps, onopen, onleave }: Props = $props();

	let query = $state('');
	let input = $state<HTMLInputElement>();

	const found = $derived(searchApps(apps, query));
	const byId = $derived(new Map(apps.map((a) => [a.id, a])));
	const pinned = $derived(shell.pinned.map((id) => byId.get(id)).filter((a): a is StartApp => !!a));
	const recent = $derived(shell.recent.map((id) => byId.get(id)).filter((a): a is StartApp => !!a).slice(0, 6));
	const groups = $derived(byCategory(apps));

	$effect(() => {
		tick().then(() => input?.focus());
	});

	function open(id: string) {
		opened(id);
		shell.open = null;
		query = '';
		onopen(id);
	}
	function key(e: KeyboardEvent) {
		if (e.key === 'Escape') shell.open = null;
		if (e.key === 'Enter' && found[0]) open(found[0].id);
	}
</script>

{#snippet app(a: StartApp)}
	<li class="app">
		<button type="button" class="open" onclick={() => open(a.id)} title={a.desc}>
			<span class="ico" aria-hidden="true">{a.icon ?? a.code?.slice(0, 2) ?? '·'}</span>
			<span class="name">{a.title}</span>
			{#if a.code}<span class="code">{a.code}</span>{/if}
		</button>
		<button
			type="button"
			class="pin"
			class:on={shell.pinned.includes(a.id)}
			aria-pressed={shell.pinned.includes(a.id)}
			aria-label={`${shell.pinned.includes(a.id) ? 'Desanclar' : 'Anclar'} ${a.title} en la barra`}
			onclick={() => pin(a.id)}>{shell.pinned.includes(a.id) ? '★' : '☆'}</button
		>
	</li>
{/snippet}

<div id="os-start" class="start pop" role="dialog" aria-label="Menú Inicio" tabindex="-1" onkeydown={key}>
	<input bind:this={input} bind:value={query} type="search" placeholder="Buscar apps: bolsa, luz, NVDA…" aria-label="Buscar apps" enterkeyhint="go" />
	<div class="scroll">
		{#if query.trim()}
			{#if found.length}
				<ul>{#each found as a (a.id)}{@render app(a)}{/each}</ul>
			{:else}
				<p class="empty">Nada con «{query}». Prueba con otra palabra o un código como ECO.</p>
			{/if}
		{:else}
			{#if pinned.length}
				<h3>Ancladas</h3>
				<ul class="cols">{#each pinned as a (a.id)}{@render app(a)}{/each}</ul>
			{/if}
			{#if recent.length}
				<h3>Recientes</h3>
				<ul class="cols">{#each recent as a (a.id)}{@render app(a)}{/each}</ul>
			{/if}
			{#each groups as g (g.category)}
				<h3>{g.category}</h3>
				<ul class="cols">{#each g.apps as a (a.id)}{@render app(a)}{/each}</ul>
			{/each}
		{/if}
	</div>
	<footer>
		<span class="mut">Arc OS</span>
		<button type="button" onclick={onleave}>Salir de Arc OS</button>
	</footer>
</div>

<style>
	/* Botones de la shell sin el borde ni el fondo que algunas estéticas dan a todos los botones. */
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.start {
		left: 0;
		width: min(560px, calc(100vw - 2 * var(--sp-8)));
		display: flex;
		flex-direction: column;
		max-height: min(70vh, 640px);
	}
	input {
		margin: var(--sp-8);
		height: var(--control-h);
		padding: 0 var(--sp-8);
		background: var(--bg);
		color: var(--fg);
		border: var(--hair) solid var(--line);
		border-radius: var(--radius-s);
		font: inherit;
		font-size: var(--fs-field);
	}
	footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--sp-4) var(--sp-12);
		border-top: var(--hair) solid var(--line);
		font-size: var(--fs-xs);
	}
	footer button {
		min-height: var(--control-h);
		color: var(--amber);
	}
	.scroll {
		overflow: auto;
		padding: 0 var(--sp-8) var(--sp-8);
	}
	h3 {
		margin: var(--sp-10) var(--sp-4) var(--sp-4);
		color: var(--muted);
		font-size: var(--fs-xxs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
	}
	.app {
		display: flex;
		align-items: center;
		border-radius: var(--radius-s);
	}
	.app:hover,
	.app:focus-within {
		background: var(--raise);
	}
	.open {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		min-height: var(--control-h);
		padding: 0 var(--sp-6);
		text-align: left;
	}
	.ico {
		width: var(--sp-20);
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		text-align: center;
	}
	.name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-s);
	}
	.code {
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
	}
	.pin {
		padding: 0 var(--sp-6);
		min-height: var(--control-h);
		color: var(--faint);
	}
	.pin.on {
		color: var(--amber);
	}
	.app:not(:hover, :focus-within) .pin:not(.on) {
		opacity: 0;
	}
	@media (hover: none) {
		.app .pin:not(.on) {
			opacity: 1;
		}
	}
</style>
