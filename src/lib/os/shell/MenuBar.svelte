<!--
	Barra de arriba de los aspectos Mac y Linux.
	- Mac: menú del logo (Acerca de, Panel de control, Salir), el nombre de la app con el foco en negrita y sus
	  menús (Archivo, Ventana, Ayuda); a la derecha, el buscador (Ctrl+Espacio), el reloj, los avisos y ajustes.
	- Linux: «Actividades» a la izquierda (todas las ventanas en mosaico), el reloj en el centro y la bandeja a la
	  derecha.
	Los menús se abren con clic o Intro, se recorren con Tab y se cierran con Escape o al elegir.
-->
<script lang="ts">
	import Logo from '#lib/components/Logo.svelte';
	import { cloud } from '#lib/cloud.svelte.ts';
	import * as os from './bridge.ts';
	import NoticeCenter from './NoticeCenter.svelte';
	import { shell, toggle } from './shell.svelte.ts';
	import TrayClock from './TrayClock.svelte';

	interface Props {
		mode: 'mac' | 'linux';
	}
	let { mode }: Props = $props();

	type Item = { label: string; keys?: string; run: () => void; disabled?: boolean } | 'sep';
	let menu = $state<string | null>(null);
	$effect(() => {
		if (shell.open !== 'menu') menu = null;
	});

	const focused = $derived(os.focused());
	const wins = $derived(os.windows());

	const menus = $derived<{ id: string; label: string; items: Item[] }[]>([
		{
			id: 'logo',
			label: 'Arc',
			items: [
				{ label: 'Acerca de Arc OS', run: () => os.navigate('/novedades') },
				'sep',
				{ label: 'Panel de control…', run: () => (shell.open = 'control') },
				{ label: 'Buscar…', keys: 'Ctrl Espacio', run: () => (shell.open = 'spotlight') },
				'sep',
				{ label: 'Volver a la web clásica', run: os.leave }
			]
		},
		{
			id: 'archivo',
			label: 'Archivo',
			items: [
				{ label: 'Abrir app…', run: () => (shell.open = 'launchpad') },
				{ label: 'Cerrar ventana', keys: 'Alt W', disabled: !focused, run: () => focused && os.winClose(focused.id) }
			]
		},
		{
			id: 'ventana',
			label: 'Ventana',
			items: [
				{ label: 'Minimizar', keys: 'Alt ↓', disabled: !focused, run: () => focused && os.winMin(focused.id) },
				{ label: 'Ampliar', keys: 'Alt ↑', disabled: !focused, run: () => focused && os.winMax(focused.id) },
				'sep',
				...wins.map((w): Item => ({ label: `${w.focused ? '✓ ' : ''}${w.title}`, run: () => os.focusWin(w.id) })),
				...(wins.length ? ['sep' as const] : []),
				{ label: 'Escritorio nuevo', run: os.addDesk },
				...os.desks().map((d, i): Item => ({ label: `${d.active ? '✓ ' : ''}${d.name}`, keys: `Alt ${i + 1}`, run: () => os.switchDesk(d.id) }))
			]
		},
		{
			id: 'ayuda',
			label: 'Ayuda',
			items: [
				{ label: 'Manual de Arc', run: () => os.navigate('/manual') },
				{ label: 'Atajos y ayuda', run: () => os.navigate('/help') }
			]
		}
	]);

	function openMenu(id: string) {
		if (menu === id) {
			menu = null;
			shell.open = null;
		} else {
			menu = id;
			shell.open = 'menu';
		}
	}
	function choose(it: Exclude<Item, 'sep'>) {
		menu = null;
		shell.open = shell.open === 'menu' ? null : shell.open;
		it.run();
	}
	// Con un menú abierto, pasar el ratón a otro lo abre (como en un escritorio de verdad).
	const hoverMenu = (id: string) => menu && menu !== id && (menu = id);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && menu && ((menu = null), (shell.open = null))} />

<nav class="menubar" class:linux={mode === 'linux'} aria-label="Barra de menús">
	{#if mode === 'mac'}
		<ul class="menus" role="menubar">
			{#each menus as m, i (m.id)}
				<li class="m">
					{#if i === 1}<span class="appname">{focused?.title ?? 'Escritorio'}</span>{/if}
					<button
						type="button"
						role="menuitem"
						aria-haspopup="menu"
						aria-expanded={menu === m.id}
						aria-label={m.id === 'logo' ? 'Menú de Arc' : undefined}
						onclick={() => openMenu(m.id)}
						onpointerenter={() => hoverMenu(m.id)}
					>
						{#if m.id === 'logo'}<Logo />{:else}{m.label}{/if}
					</button>
					{#if menu === m.id}
						<ul class="drop" role="menu" aria-label={m.label}>
							{#each m.items as it, j (j)}
								{#if it === 'sep'}<li class="sep" role="separator"></li>
								{:else}
									<li role="none">
										<button type="button" role="menuitem" disabled={it.disabled} onclick={() => choose(it)}>
											<span>{it.label}</span>{#if it.keys}<kbd>{it.keys}</kbd>{/if}
										</button>
									</li>
								{/if}
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<button type="button" class="activities" aria-expanded={shell.open === 'activities'} onclick={() => toggle('activities')}>Actividades</button>
	{/if}

	<div class="center">{#if mode === 'linux'}<TrayClock />{/if}</div>

	<div class="tray">
		{#if os.status()}<span class="status" role="status">{os.status()}</span>{/if}
		{#if mode === 'mac'}
			<button type="button" class="tray-btn" aria-label="Buscar (Ctrl+Espacio)" aria-expanded={shell.open === 'spotlight'} onclick={() => toggle('spotlight')}>⌕</button>
			<TrayClock />
		{/if}
		<NoticeCenter onnavigate={os.navigate} />
		<button type="button" class="tray-btn" aria-label="Panel de control" aria-expanded={shell.open === 'control'} onclick={() => toggle('control')}>⚙</button>
		<span class="user" title={cloud.user || 'Sin cuenta (solo en este navegador)'}>{cloud.user ? cloud.user.slice(0, 1).toUpperCase() : '·'}</span>
	</div>
</nav>

<style>
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.menubar {
		position: relative;
		z-index: var(--z-bar);
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		height: var(--os-bar-h);
		padding: 0 var(--sp-8);
		background: var(--panel);
		border-bottom: var(--hair) solid var(--panel-edge);
		backdrop-filter: var(--panel-blur);
		font-size: var(--fs-s);
	}
	.menubar.linux {
		background: var(--os-topbar-bg);
		color: var(--os-topbar-fg);
		border-bottom: 0;
	}
	.menus {
		display: flex;
		align-items: center;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.m {
		position: relative;
		display: flex;
		align-items: center;
	}
	.m > button {
		display: flex;
		align-items: center;
		height: calc(var(--os-bar-h) - var(--sp-6));
		padding: 0 var(--sp-8);
		border-radius: var(--radius-s);
	}
	.m > button[aria-expanded='true'] {
		background: var(--raise);
	}
	@media (hover: hover) {
		.m > button:hover {
			background: var(--raise);
		}
	}
	.m :global(svg) {
		width: var(--sp-16);
		height: var(--sp-16);
		color: var(--amber);
	}
	/* Tras el logo, el nombre de la app con el foco en negrita, como en el Mac. */
	.appname {
		padding: 0 var(--sp-8);
		font-weight: var(--fw-bold);
	}
	.drop {
		position: absolute;
		top: calc(100% + var(--sp-2));
		left: 0;
		z-index: var(--z-popover);
		min-width: 220px;
		margin: 0;
		padding: var(--sp-4);
		list-style: none;
		background: var(--panel);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--os-menu-radius, var(--radius));
		box-shadow: var(--shadow-pop);
		backdrop-filter: var(--panel-blur);
	}
	.drop button {
		display: flex;
		justify-content: space-between;
		gap: var(--sp-16);
		width: 100%;
		min-height: var(--control-h);
		padding: 0 var(--sp-10);
		border-radius: var(--radius-s);
		text-align: left;
	}
	.drop button:focus-visible {
		background: var(--amber);
		color: var(--on-amber);
	}
	@media (hover: hover) {
		.drop button:hover:not(:disabled) {
			background: var(--amber);
			color: var(--on-amber);
		}
	}
	.drop button:disabled {
		color: var(--faint);
		cursor: default;
	}
	kbd {
		color: inherit;
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		opacity: 0.7;
	}
	.sep {
		height: var(--hair);
		margin: var(--sp-4) var(--sp-6);
		background: var(--line);
	}
	.activities {
		justify-self: start;
		height: calc(var(--os-bar-h) - var(--sp-8));
		padding: 0 var(--sp-12);
		border-radius: var(--os-menu-radius, var(--radius));
		font-weight: var(--fw-medium);
	}
	.activities[aria-expanded='true'] {
		background: var(--os-topbar-hover);
	}
	@media (hover: hover) {
		.activities:hover {
			background: var(--os-topbar-hover);
		}
	}
	.center {
		position: relative;
	}
	.center :global(.pop) {
		left: 50%;
		right: auto;
		transform: translateX(-50%);
	}
	.tray {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: var(--sp-2);
	}
	.menubar :global(.tray-btn) {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		height: calc(var(--os-bar-h) - var(--sp-6));
		padding: 0 var(--sp-8);
		border-radius: var(--radius-s);
		color: inherit;
		font-size: var(--fs-s);
	}
	.menubar :global(.tray-btn[aria-expanded='true']) {
		background: var(--raise);
	}
	@media (hover: hover) {
		.menubar :global(.tray-btn:hover) {
			background: var(--raise);
		}
	}
	.linux :global(.tray-btn[aria-expanded='true']) {
		background: var(--os-topbar-hover);
	}
	@media (hover: hover) {
		.linux :global(.tray-btn:hover) {
			background: var(--os-topbar-hover);
		}
	}
	.linux :global(.mk) {
		color: inherit;
		opacity: 0.7;
	}
	.menubar :global(.pop) {
		position: absolute;
		top: calc(100% + var(--sp-4));
		background: var(--panel);
		color: var(--fg);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--os-menu-radius, var(--radius));
		box-shadow: var(--shadow-pop);
		z-index: var(--z-popover);
	}
	.status {
		color: var(--amber);
		font-size: var(--fs-xs);
	}
	.user {
		display: grid;
		place-items: center;
		width: var(--sp-20);
		height: var(--sp-20);
		margin-left: var(--sp-4);
		border: var(--hair) solid currentColor;
		border-radius: 50%;
		font-size: var(--fs-xxs);
		opacity: 0.8;
	}
</style>
