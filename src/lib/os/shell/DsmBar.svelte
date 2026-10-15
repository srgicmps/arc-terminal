<!--
	Barra de arriba del aspecto DSM (inspirada en el panel web de un servidor doméstico): fina, con el menú
	principal ▦ (todas las apps en una rejilla grande con buscador), «Mostrar escritorio», las apps abiertas como
	pestañas y, a la derecha, buscar, avisos, mostrar u ocultar los widgets, ajustes y la cuenta.
-->
<script lang="ts">
	import OsIcon from '../icons/OsIcon.svelte';
	import { cloud } from '#lib/cloud.svelte.ts';
	import ContextMenu, { type MenuEntry } from '#lib/components/os/ContextMenu.svelte';
	import * as os from './bridge.ts';
	import { winMenu } from './menus.ts';
	import NoticeCenter from './NoticeCenter.svelte';
	import { shell, toggle } from './shell.svelte.ts';
	import TrayClock from './TrayClock.svelte';

	const wins = $derived(os.windows());
	let menu = $state<{ x: number; y: number; items: MenuEntry[] } | null>(null);
</script>

<nav class="dsm" aria-label="Barra principal">
	<button type="button" class="main" aria-label="Menú principal: todas las apps" aria-expanded={shell.open === 'launchpad'} onclick={() => toggle('launchpad')}>
		<span aria-hidden="true">▦</span>
	</button>
	<button type="button" class="tool" title="Mostrar escritorio" aria-label="Mostrar escritorio" onclick={os.showDesktop}>
		<span aria-hidden="true">▭</span>
	</button>
	<ul class="tabs" aria-label="Apps abiertas">
		{#each wins as w (w.id)}
			<li>
				<button type="button" class:on={w.focused} class:min={w.minimized} aria-pressed={w.focused} title={w.title} onclick={() => os.activate(w.id)} oncontextmenu={(e) => (e.preventDefault(), (menu = { x: e.clientX, y: e.clientY, items: winMenu(w) }))}>
					<OsIcon id={w.appId} size={18} /><span class="t">{w.title}</span>
				</button>
			</li>
		{/each}
	</ul>
	{#if os.status()}<span class="status" role="status">{os.status()}</span>{/if}
	<div class="tray">
		<button type="button" class="tray-btn" aria-label="Buscar (Ctrl+Espacio)" aria-expanded={shell.open === 'spotlight'} onclick={() => toggle('spotlight')}>⌕</button>
		<NoticeCenter onnavigate={os.navigate} />
		<button type="button" class="tray-btn" aria-label={shell.widgetsHidden ? 'Mostrar los widgets' : 'Ocultar los widgets'} aria-pressed={!shell.widgetsHidden} onclick={() => (shell.widgetsHidden = !shell.widgetsHidden)}>◫</button>
		<TrayClock />
		<button type="button" class="tray-btn" aria-label="Panel de control" aria-expanded={shell.open === 'control'} onclick={() => toggle('control')}>⚙</button>
		<span class="user" title={cloud.user || 'Sin cuenta (solo en este navegador)'}>{cloud.user ? cloud.user.slice(0, 1).toUpperCase() : '·'}</span>
	</div>
</nav>
{#if menu}<ContextMenu x={menu.x} y={menu.y} items={menu.items} label="Menú de la ventana" onclose={() => (menu = null)} />{/if}

<style>
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.dsm {
		position: relative;
		z-index: var(--z-bar);
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		height: var(--os-bar-h);
		padding: 0 var(--sp-4);
		background: var(--os-topbar-bg);
		color: var(--os-topbar-fg);
		border-bottom: var(--hair) solid var(--panel-edge);
		backdrop-filter: var(--os-blur);
		font-size: var(--fs-s);
	}
	.main,
	.tool {
		display: grid;
		place-items: center;
		width: var(--os-bar-h);
		height: var(--os-bar-h);
		font-size: var(--fs-l);
	}
	.main[aria-expanded='true'] {
		background: var(--os-topbar-hover);
	}
	@media (hover: hover) {
		.main:hover,
		.tool:hover {
			background: var(--os-topbar-hover);
		}
	}
	.tool {
		border-right: var(--hair) solid var(--line);
	}
	.tabs {
		flex: 1;
		min-width: 0;
		display: flex;
		margin: 0;
		padding: 0 var(--sp-4);
		list-style: none;
	}
	.tabs li {
		min-width: 0;
	}
	.tabs button {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		max-width: 180px;
		height: var(--os-bar-h);
		padding: 0 var(--sp-10);
		border-bottom: var(--sp-2) solid transparent;
	}
	@media (hover: hover) {
		.tabs button:hover {
			background: var(--os-topbar-hover);
		}
	}
	.tabs button.on {
		border-bottom-color: var(--amber);
		background: var(--os-topbar-hover);
	}
	.tabs button.min {
		opacity: 0.6;
	}
	.t {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.status {
		color: var(--amber);
		font-size: var(--fs-xs);
		white-space: nowrap;
	}
	.tray {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.dsm :global(.tray-btn) {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		height: var(--os-bar-h);
		padding: 0 var(--sp-8);
		color: inherit;
		font-size: var(--fs-s);
	}
	.dsm :global(.tray-btn[aria-expanded='true']) {
		background: var(--os-topbar-hover);
	}
	@media (hover: hover) {
		.dsm :global(.tray-btn:hover) {
			background: var(--os-topbar-hover);
		}
	}
	.dsm :global(.tray-btn[aria-pressed='false']) {
		opacity: 0.6;
	}
	.dsm :global(.pop) {
		position: absolute;
		top: calc(100% + var(--sp-4));
		background: var(--panel);
		color: var(--fg);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--os-menu-radius, var(--radius));
		box-shadow: var(--shadow-pop);
		z-index: var(--z-popover);
	}
	.user {
		display: grid;
		place-items: center;
		width: var(--sp-24);
		height: var(--sp-24);
		margin: 0 var(--sp-4);
		border-radius: 50%;
		background: var(--amber);
		color: var(--on-amber);
		font-size: var(--fs-xs);
	}
</style>
