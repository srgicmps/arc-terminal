<!--
	Launchpad (aspecto Mac) y «Mostrar aplicaciones» (Linux): todas las apps en una rejilla grande a pantalla
	completa, por categorías, con buscador. Tocar una la abre; clic derecho, su menú (otra ventana, anclar, al
	escritorio). Escape o tocar el fondo, cierra.
-->
<script lang="ts">
	import ContextMenu, { type MenuEntry } from '#lib/components/os/ContextMenu.svelte';
	import OsIcon from '../icons/OsIcon.svelte';
	import { appMenu } from './menus.ts';
	import { tick } from 'svelte';
	import * as os from './bridge.ts';
	import { shell } from './shell.svelte.ts';
	import { byCategory, searchApps } from './start.ts';

	let query = $state('');
	let input = $state<HTMLInputElement>();
	const groups = $derived(query.trim() ? [{ category: 'Resultados', apps: searchApps(os.installed(), query) }] : byCategory(os.installed()));

	$effect(() => {
		tick().then(() => input?.focus());
	});

	function go(id: string) {
		shell.open = null;
		os.open(id);
	}
	let menu = $state<{ x: number; y: number; items: MenuEntry[]; label: string } | null>(null);
	function ctx(e: MouseEvent, id: string, title: string) {
		e.preventDefault();
		menu = {
			x: e.clientX,
			y: e.clientY,
			label: `Menú de ${title}`,
			// El de la barra (abrir, anclar, al escritorio), más «Abrir otra ventana»; abrir cierra el Launchpad.
			items: [{ label: 'Abrir', run: () => go(id) }, { label: 'Abrir otra ventana', run: () => ((shell.open = null), os.openFresh(id)) }, ...appMenu(id).slice(1)]
		};
	}
	function key(e: KeyboardEvent) {
		if (menu) return;
		if (e.key === 'Escape') shell.open = null;
		if (e.key === 'Enter' && query.trim() && groups[0]?.apps[0]) go(groups[0].apps[0].id);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="pad" role="dialog" aria-label="Todas las apps" tabindex="-1" onkeydown={key} onclick={(e) => e.target === e.currentTarget && (shell.open = null)}>
	<input bind:this={input} bind:value={query} type="search" placeholder="Buscar" aria-label="Buscar apps" />
	<div class="scroll">
		{#each groups as g (g.category)}
			<h3>{g.category}</h3>
			<ul>
				{#each g.apps as a (a.id)}
					<li>
						<button type="button" onclick={() => go(a.id)} oncontextmenu={(e) => ctx(e, a.id, a.title)} title={a.desc}>
							<OsIcon id={a.id} size={64} />
							<span class="name">{a.title}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/each}
	</div>
	{#if menu}<ContextMenu x={menu.x} y={menu.y} items={menu.items} label={menu.label} onclose={() => ((menu = null), input?.focus())} />{/if}
</div>

<style>
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.pad {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--sp-24) var(--sp-24) 0;
		background: var(--os-veil);
		backdrop-filter: var(--os-blur);
	}
	input {
		width: min(280px, 80vw);
		height: var(--control-h);
		padding: 0 var(--sp-12);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--os-menu-radius, var(--radius));
		background: var(--panel);
		color: var(--fg);
		font: inherit;
		text-align: center;
	}
	/* El foco pisa el borde, en vez de un segundo marco separado. */
	input:focus-visible {
		outline: var(--hair) solid var(--amber);
		outline-offset: calc(-1 * var(--hair));
	}
	.scroll {
		width: min(1100px, 100%);
		overflow: auto;
		padding-bottom: var(--sp-24);
	}
	h3 {
		margin: var(--sp-20) 0 var(--sp-8);
		color: var(--fg);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		opacity: 0.7;
	}
	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: var(--sp-12);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li button {
		display: grid;
		justify-items: center;
		gap: var(--sp-6);
		width: 100%;
		padding: var(--sp-8) var(--sp-4);
		border-radius: var(--radius);
	}
	li button:focus-visible {
		background: var(--amber-soft);
	}
	@media (hover: hover) {
		li button:hover {
			background: var(--amber-soft);
		}
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-s);
	}
	/* iPhone e iPad: con menos de 16 px, Safari amplía la página al escribir (--fs-field vale 16 px en táctil). */
	@media (pointer: coarse) {
		input {
			font-size: var(--fs-field);
		}
	}
</style>
