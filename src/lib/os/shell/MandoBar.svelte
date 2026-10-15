<!--
	Barra de arriba del aspecto «Mando» (centro de mando): marca de la sesión, menú de apps, las ventanas abiertas
	como pestañas, el nivel de alerta global (mando.ts → alertLevel, de los avisos graves y los temas grandes) y
	los relojes UTC y Madrid con segundos. Debajo del escritorio va su franja de estado (MandoStrip.svelte).
-->
<script lang="ts">
	import { cloud } from '#lib/cloud.svelte.ts';
	import { accountLine } from '#lib/os/system/account.ts';
	import * as os from './bridge.ts';
	import { alertLevel, hms } from './mando.ts';
	import NoticeCenter from './NoticeCenter.svelte';
	import OsIcon from '../icons/OsIcon.svelte';
	import UiIcon from '../icons/UiIcon.svelte';
	import { shell, toggle } from './shell.svelte.ts';
	import { wdata } from './widgetdata.svelte.ts';

	const wins = $derived(os.windows());
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

<nav class="mando" aria-label="Barra del centro de mando">
	<span class="brand" aria-hidden="true"><b>◆</b> ARC<span class="sep">·</span>MANDO</span>
	<button type="button" class="tool" aria-label="Todas las apps" aria-expanded={shell.open === 'launchpad'} onclick={() => toggle('launchpad')}><UiIcon id="apps" size={16} /></button>
	<button type="button" class="tool" title="Mostrar escritorio" aria-label="Mostrar escritorio" onclick={os.showDesktop}><UiIcon id="desktop" size={16} /></button>
	<ul class="tabs" aria-label="Apps abiertas">
		{#each wins as w (w.id)}
			<li>
				<button type="button" class:on={w.focused} class:min={w.minimized} aria-pressed={w.focused} title={w.title} onclick={() => os.activate(w.id)}>
					<OsIcon id={w.appId} size={14} /><span class="t">{w.title}</span>
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
		<button type="button" class="tray-btn" aria-label="Panel de control" aria-expanded={shell.open === 'control'} onclick={() => toggle('control')}><UiIcon id="gear" size={16} /></button>
		<span class="user" class:warn={account.warn} title={account.text}>{#if cloud.user}{cloud.user.slice(0, 1).toUpperCase()}{:else}<UiIcon id="user" size={12} />{/if}</span>
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
	/* Pantallas estrechas: fuera la marca y Madrid; quedan las pestañas, el nivel y UTC. */
	@media (max-width: 900px) {
		.brand,
		.clk + .clk,
		.level .k {
			display: none;
		}
	}
</style>
