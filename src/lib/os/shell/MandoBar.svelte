<!--
	Barra de arriba del aspecto «Mando» (centro de mando): marca de la sesión, menú de apps, las ventanas abiertas
	como pestañas (clic derecho: su menú), los escritorios virtuales (1…6 y «+»), el nivel de alerta global
	(mando.ts → alertLevel, de los avisos graves y los temas grandes), los relojes UTC y Madrid con segundos y el
	menú de la cuenta. Clic derecho en lo vacío de la barra: el menú de la barra. Debajo del escritorio va su franja de estado (MandoStrip.svelte).
-->
<script lang="ts">
	import { cloud } from '#lib/cloud.svelte.ts';
	import { accountLine } from '#lib/os/system/account.ts';
	import ContextMenu, { type MenuEntry } from '#lib/components/os/ContextMenu.svelte';
	import { lock } from '../system/system.svelte.ts';
	import * as os from './bridge.ts';
	import { winMenu } from './menus.ts';
	import { alertLevel, hms } from './mando.ts';
	import NoticeCenter from './NoticeCenter.svelte';
	import OsIcon from '../icons/OsIcon.svelte';
	import UiIcon from '../icons/UiIcon.svelte';
	import { shell, toggle } from './shell.svelte.ts';
	import { wdata } from './widgetdata.svelte.ts';

	const wins = $derived(os.windows());
	const desks = $derived(os.desks());

	let menu = $state<{ x: number; y: number; items: MenuEntry[]; label: string } | null>(null);
	const ctx = (e: MouseEvent, items: MenuEntry[], label: string) => (e.preventDefault(), e.stopPropagation(), (menu = { x: e.clientX, y: e.clientY, items, label }));

	/** Clic derecho en lo vacío de la barra. */
	function barMenu(e: MouseEvent) {
		if ((e.target as Element).closest('button, a, input')) return;
		ctx(
			e,
			[
				{ label: 'Todas las apps…', run: () => (shell.open = 'launchpad') },
				{ label: 'Buscar…', kbd: 'Ctrl+Espacio', run: () => (shell.open = 'spotlight') },
				'sep',
				{ label: 'Mostrar escritorio', run: os.showDesktop },
				{ label: 'Ventanas en mosaico', run: os.tileWins },
				{ label: 'Escritorio nuevo', disabled: !os.canAddDesk(), run: os.addDesk },
				'sep',
				{ label: 'Panel de control', run: () => (shell.open = 'control') }
			],
			'Menú de la barra'
		);
	}
	function deskItems(id: string, i: number): MenuEntry[] {
		return [
			{ label: 'Ir a este escritorio', kbd: `Alt+${i + 1}`, run: () => os.switchDesk(id) },
			{ label: 'Escritorio nuevo', disabled: !os.canAddDesk(), run: os.addDesk },
			'sep',
			{ label: 'Cerrar escritorio (sus ventanas pasan al de al lado)', disabled: desks.length < 2, run: () => os.closeDesk(id) }
		];
	}
	/** La inicial de la cuenta abre su menú, debajo. */
	function userMenu(e: MouseEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		menu = {
			x: r.right,
			y: r.bottom,
			label: 'Menú de la cuenta',
			items: [
				{ label: account.text, disabled: true, run: () => {} },
				'sep',
				{ label: 'Cuenta y ajustes…', run: () => os.openAt('ajustes', 'cuenta') },
				{ label: 'Bloquear la pantalla', kbd: 'Ctrl+Alt+L', run: lock },
				'sep',
				{ label: 'Volver a la web clásica', run: os.leave }
			]
		};
	}

	// Relojes con segundos: un tic por segundo solo mientras la barra está montada, alineado con el cambio de
	// segundo (con un intervalo suelto, la hora iba hasta 1 s tarde y a veces se saltaba un segundo).
	let now = $state(Date.now());
	$effect(() => {
		let id: ReturnType<typeof setTimeout>;
		const tick = () => {
			now = Date.now();
			id = setTimeout(tick, 1000 - (now % 1000) + 5);
		};
		tick();
		return () => clearTimeout(id);
	});
	// El nivel, con la hora por minutos: los avisos caducan aunque muro.json no cambie.
	const minute = $derived(Math.floor(now / 60_000) * 60_000);
	const alert = $derived(wdata.loaded ? alertLevel(wdata.wall, minute) : alertLevel(null));
	const account = $derived(accountLine(cloud.state, cloud.user, cloud.frozen));
</script>

<nav class="mando" aria-label="Barra del centro de mando" oncontextmenu={barMenu}>
	<span class="brand" aria-hidden="true"><b>◆</b> ARC<span class="sep">·</span>MANDO</span>
	<button type="button" class="tool" aria-label="Todas las apps" aria-expanded={shell.open === 'launchpad'} onclick={() => toggle('launchpad')}><UiIcon id="apps" size={16} /></button>
	<button type="button" class="tool" title="Mostrar escritorio" aria-label="Mostrar escritorio" onclick={os.showDesktop}><UiIcon id="desktop" size={16} /></button>
	<div class="desks" role="group" aria-label="Escritorios">
		{#each desks as d, i (d.id)}
			<button type="button" class="desk" aria-pressed={d.active} title={`${d.name} (Alt+${i + 1})`} aria-label={d.name} onclick={() => os.switchDesk(d.id)} oncontextmenu={(e) => ctx(e, deskItems(d.id, i), `Menú de ${d.name}`)}>{i + 1}</button>
		{/each}
		{#if os.canAddDesk()}<button type="button" class="desk add" title="Escritorio nuevo" aria-label="Escritorio nuevo" onclick={os.addDesk}>+</button>{/if}
	</div>
	<ul class="tabs" aria-label="Apps abiertas">
		{#each wins as w (w.id)}
			<li>
				<button type="button" class:on={w.focused} class:min={w.minimized} aria-pressed={w.focused} title={w.title} onclick={() => os.activate(w.id)} oncontextmenu={(e) => ctx(e, winMenu(w), `Menú de ${w.title}`)}>
					<span class="ico" aria-hidden="true"><OsIcon id={w.appId} size={14} /></span><span class="t">{w.title}</span>
				</button>
			</li>
		{/each}
	</ul>
	<div class="level" data-level={alert.level} role="status" title={alert.reasons.join(' · ')}>
		<span class="k">Alerta</span>
		<span class="pips" aria-hidden="true">{#each [1, 2, 3, 4, 5] as n (n)}<i class:on={n <= alert.level}></i>{/each}</span>
		<b>{alert.label}</b>
		<span class="sr">{alert.level ? `nivel ${alert.level} de 5` : 'sin datos'}: {alert.reasons.join('. ')}</span>
	</div>
	<div class="tray">
		<button type="button" class="tray-btn" aria-label="Buscar (Ctrl+Espacio)" aria-expanded={shell.open === 'spotlight'} onclick={() => toggle('spotlight')}><UiIcon id="search" size={16} /></button>
		<NoticeCenter onnavigate={os.navigate} />
		<span class="clk" title="Hora universal coordinada"><span class="k">UTC</span>{hms('UTC', now)}</span>
		<span class="clk" title="Hora de Madrid"><span class="k">MAD</span>{hms('Europe/Madrid', now)}</span>
		<button type="button" class="tray-btn" aria-label="Panel de control" aria-controls="os-control" aria-expanded={shell.open === 'control'} onclick={() => toggle('control')}><UiIcon id="gear" size={16} /></button>
		<button type="button" class="user" class:warn={account.warn} title={account.text} aria-label="Cuenta" aria-haspopup="menu" aria-expanded={menu?.label === 'Menú de la cuenta'} onclick={userMenu}>
			{#if cloud.user}{cloud.user.slice(0, 1).toUpperCase()}{:else}<UiIcon id="user" size={12} />{/if}
		</button>
	</div>
</nav>

{#if menu}<ContextMenu x={menu.x} y={menu.y} items={menu.items} label={menu.label} onclose={() => (menu = null)} />{/if}

<style>
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.mando {
		position: relative;
		z-index: var(--z-bar);
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		height: var(--os-bar-h);
		padding: 0 var(--sp-4) 0 var(--sp-10);
		background: var(--os-topbar-bg);
		color: var(--os-topbar-fg);
		border-bottom: var(--hair) solid var(--cmd-cold-dim);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
	}
	.brand {
		margin-right: var(--sp-8);
		font-weight: var(--fw-bold);
		letter-spacing: var(--track-brand);
		white-space: nowrap;
	}
	.brand b {
		color: var(--amber);
	}
	.sep {
		margin: 0 var(--sp-4);
		color: var(--cmd-cold);
	}
	.tool {
		display: grid;
		place-items: center;
		width: var(--os-bar-h);
		height: var(--os-bar-h);
		font-size: var(--fs-m);
		color: var(--cmd-cold);
	}
	.tool[aria-expanded='true'] {
		background: var(--os-topbar-hover);
	}
	@media (hover: hover) {
		.tool:hover {
			background: var(--os-topbar-hover);
		}
	}
	.tabs {
		flex: 1;
		min-width: 0;
		display: flex;
		margin: 0;
		padding: 0 var(--sp-8);
		list-style: none;
		border-left: var(--hair) solid var(--line);
		overflow: hidden;
	}
	/* Con muchas ventanas, cada pestaña encoge (hasta quedarse en el icono) en vez de pisar a la de al lado. */
	.tabs li {
		min-width: 0;
		display: flex;
		overflow: hidden;
	}
	.tabs button {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		min-width: 0;
		max-width: 180px;
		height: var(--os-bar-h);
		padding: 0 var(--sp-10);
		border-bottom: var(--hair) solid transparent;
		text-transform: uppercase;
		color: var(--muted);
	}
	@media (hover: hover) {
		.tabs button:hover {
			background: var(--os-topbar-hover);
			color: var(--fg);
		}
	}
	.tabs button.on {
		border-bottom-color: var(--cmd-cold);
		color: var(--fg);
	}
	/* Minimizada: más apagada, pero legible (con opacidad 0,6 bajaba a 3:1, por debajo de AA). */
	.tabs button.min {
		color: var(--faint);
		font-style: italic;
	}
	.desks {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: 0 var(--sp-6);
		border-left: var(--hair) solid var(--line);
	}
	.desk {
		display: grid;
		place-items: center;
		min-width: var(--sp-20);
		height: var(--sp-20);
		border: var(--hair) solid var(--line);
		color: var(--muted);
		font-size: var(--fs-xxs);
		font-variant-numeric: tabular-nums;
	}
	.desk:hover {
		background: var(--os-topbar-hover);
		color: var(--fg);
	}
	.desk[aria-pressed='true'] {
		border-color: var(--cmd-cold);
		color: var(--cmd-cold);
	}
	.desk.add {
		border-style: dashed;
	}
	.t {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.k {
		margin-right: var(--sp-6);
		color: var(--faint);
		text-transform: uppercase;
	}
	.level {
		--lv: var(--cmd-cold);
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		height: var(--os-bar-h);
		padding: 0 var(--sp-10);
		border-left: var(--hair) solid var(--line);
		border-right: var(--hair) solid var(--line);
		text-transform: uppercase;
		white-space: nowrap;
	}
	.level[data-level='3'],
	.level[data-level='4'] {
		--lv: var(--amber);
	}
	.level[data-level='5'] {
		--lv: var(--down);
	}
	.level b {
		color: var(--lv);
		font-weight: var(--fw-medium);
	}
	.pips {
		display: flex;
		gap: var(--sp-2);
	}
	/* Apagado: solo el borde (antes, relleno de --line a 1,2:1: la escala de 5 casi no se veía). */
	.pips i {
		width: var(--sp-4);
		height: var(--sp-10);
		box-shadow: inset 0 0 0 var(--hair) var(--faint);
	}
	.pips i.on {
		background: var(--lv);
		box-shadow: none;
	}
	.level[data-level='0'] b {
		color: var(--muted);
	}
	/* Nivel máximo: un latido lento, sin parpadeo. */
	.level[data-level='5'] .pips i.on {
		animation: cmd-pulse 2.4s ease-in-out infinite;
	}
	@keyframes cmd-pulse {
		50% {
			opacity: 0.45;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.level .pips i.on {
			animation: none;
		}
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.tray {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.clk {
		padding: 0 var(--sp-8);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.mando :global(.tray-btn) {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		height: var(--os-bar-h);
		padding: 0 var(--sp-8);
		color: inherit;
		font-size: var(--fs-s);
	}
	.mando :global(.tray-btn[aria-expanded='true']) {
		background: var(--os-topbar-hover);
	}
	@media (hover: hover) {
		.mando :global(.tray-btn:hover) {
			background: var(--os-topbar-hover);
		}
	}
	.mando :global(.pop) {
		position: absolute;
		top: calc(100% + var(--sp-4));
		background: var(--cmd-deck);
		color: var(--fg);
		border: var(--hair) solid var(--cmd-cold-dim);
		border-radius: var(--os-menu-radius);
		box-shadow: var(--shadow-pop);
		z-index: var(--z-popover);
	}
	.user {
		display: grid;
		padding: 0;
		place-items: center;
		width: var(--sp-20);
		height: var(--sp-20);
		margin: 0 var(--sp-4);
		border: var(--hair) solid var(--cmd-cold);
		color: var(--cmd-cold);
		font-size: var(--fs-xxs);
	}
	/* La cuenta no está sincronizando (sin conexión, sesión caducada): en ámbar, y el porqué en el título. */
	.user.warn {
		border-color: var(--amber-edge);
		color: var(--amber);
	}
	.user:hover,
	.user[aria-expanded='true'] {
		background: var(--os-topbar-hover);
	}
	/* Pantallas estrechas: fuera la marca y Madrid; quedan las pestañas, el nivel y UTC. */
	@media (max-width: 900px) {
		.brand,
		.clk + .clk,
		.level .k {
			display: none;
		}
	}
</style>
