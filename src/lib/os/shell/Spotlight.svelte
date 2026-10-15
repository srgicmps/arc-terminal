<!--
	Buscador al centro de la pantalla (Ctrl+Espacio, o la lupa de la barra): apps, lo que entiende la barra de
	comandos («NEWS inflación», «NVDA GP»), valores, países, líderes y ajustes (searchAll de «OS 5»). Solo las apps
	instaladas (Centro de paquetes). ↑ ↓ eligen, Intro abre, Escape cierra.
-->
<script lang="ts">
	import OsIcon from '../icons/OsIcon.svelte';
	import { tick } from 'svelte';
	import { installedApps } from '../packages.svelte.ts';
	import { searchAll, type Hit } from '../system/search.ts';
	import { runHit } from '../system/search.svelte.ts';
	import { shell } from './shell.svelte.ts';

	let query = $state('');
	let sel = $state(0);
	let input = $state<HTMLInputElement>();
	const found = $derived(searchAll(query, installedApps(), 10));

	$effect(() => {
		tick().then(() => input?.focus());
	});
	$effect(() => {
		void query;
		sel = 0;
	});

	function go(hit: Hit) {
		shell.open = null;
		runHit(hit);
	}
	const appOf = (h: Hit) => ('app' in h.action ? h.action.app : null);
	function key(e: KeyboardEvent) {
		if (e.key === 'Escape') shell.open = null;
		else if (e.key === 'ArrowDown') (e.preventDefault(), (sel = Math.min(sel + 1, found.length - 1)));
		else if (e.key === 'ArrowUp') (e.preventDefault(), (sel = Math.max(sel - 1, 0)));
		else if (e.key === 'Enter' && found[sel]) go(found[sel]);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scrim" onclick={() => (shell.open = null)}></div>
<div class="spot" role="dialog" aria-label="Buscar" tabindex="-1" onkeydown={key}>
	<input
		bind:this={input}
		bind:value={query}
		type="search"
		placeholder="Buscar: apps, NVDA, NEWS inflación, Francia…"
		aria-label="Buscar"
		role="combobox"
		aria-expanded={found.length > 0}
		aria-controls="os-spot-list"
		aria-activedescendant={found[sel] ? `os-spot-${found[sel].id}` : undefined}
	/>
	{#if found.length}
		<ul id="os-spot-list" role="listbox" aria-label="Resultados">
			{#each found as h, i (h.id)}
				{@const app = appOf(h)}
				<li id={`os-spot-${h.id}`} role="option" aria-selected={i === sel}>
					<button type="button" tabindex="-1" onclick={() => go(h)} onmouseenter={() => (sel = i)}>
						{#if app}<OsIcon id={app} size={28} />{:else}<span class="glyph" aria-hidden="true">{h.icon}</span>{/if}
						<span class="t">{h.title}<small>{h.detail}</small></span>
						<span class="c">{h.kind}</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else if query.trim()}
		<p class="empty">Nada con «{query}».</p>
	{/if}
</div>

<style>
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.scrim {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
	}
	.spot {
		position: fixed;
		left: 50%;
		top: 18dvh;
		z-index: var(--z-modal);
		width: min(600px, calc(100vw - 2 * var(--sp-16)));
		transform: translateX(-50%);
		background: var(--panel);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--os-menu-radius, var(--radius));
		box-shadow: var(--shadow-pop);
		backdrop-filter: var(--panel-blur);
		overflow: hidden;
	}
	input {
		width: 100%;
		height: calc(var(--control-h) * 1.6);
		padding: 0 var(--sp-16);
		border: 0;
		background: none;
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-l);
		outline: none;
	}
	ul {
		margin: 0;
		padding: var(--sp-4);
		list-style: none;
		border-top: var(--hair) solid var(--line);
	}
	li button {
		display: flex;
		align-items: center;
		gap: var(--sp-10);
		width: 100%;
		min-height: var(--control-h);
		padding: var(--sp-4) var(--sp-10);
		border-radius: var(--radius-s);
		text-align: left;
	}
	li[aria-selected='true'] button {
		background: var(--amber);
		color: var(--on-amber);
	}
	.t {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.t small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-xs);
		opacity: 0.7;
	}
	.glyph {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		flex: none;
		border: var(--hair) solid var(--line);
		border-radius: var(--os-icon-radius, var(--radius));
		font-size: var(--fs-l);
	}
	.c {
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		opacity: 0.7;
	}
	.empty {
		margin: 0;
		padding: var(--sp-12) var(--sp-16);
		border-top: var(--hair) solid var(--line);
	}
	/* iPhone e iPad: con menos de 16 px, Safari amplía la página al escribir (--fs-field vale 16 px en táctil). */
	@media (pointer: coarse) {
		input {
			font-size: var(--fs-field);
		}
	}
</style>
