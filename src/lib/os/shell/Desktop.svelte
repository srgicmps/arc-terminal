<!--
	Escritorio de Arc OS: el fondo (el de la estética activa, o liso, rejilla o degradado, siempre con sus
	tokens), los accesos directos de las apps ancladas a la izquierda y los widgets movibles. Las ventanas del
	núcleo van encima (children).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { place } from '#lib/place.svelte.ts';
	import WallLayer from '../system/wall/WallLayer.svelte';
	import { setWidgets, shell } from './shell.svelte.ts';
	import type { StartApp } from './start.ts';
	import Widget from './Widget.svelte';
	import WidgetBody from './WidgetBody.svelte';
	import { refreshWidgets } from './widgetdata.svelte.ts';
	import { defaultWidgets, removeWidget, type Placed } from './widgets.ts';

	interface Props {
		apps: StartApp[];
		onopen: (id: string) => void;
		onnavigate: (href: string) => void;
		/** Ancho y alto del escritorio, para quien lo necesite fuera (Panel de control). */
		size?: { w: number; h: number };
		children?: Snippet;
	}
	let { apps, onopen, onnavigate, size = $bindable({ w: 0, h: 0 }), children }: Props = $props();

	let w = $state(0);
	let h = $state(0);
	$effect(() => {
		size = { w, h };
	});

	const icons = $derived(shell.pinned.map((id) => apps.find((a) => a.id === id)).filter((a): a is StartApp => !!a));
	const widgets = $derived(shell.widgets ?? (w ? defaultWidgets(w, shell.skin) : []));

	onMount(() => {
		const go = () => refreshWidgets(place.current);
		go();
		const id = setInterval(go, 300_000);
		return () => clearInterval(id);
	});

	function moveTo(p: Placed) {
		setWidgets(widgets.map((x) => (x.kind === p.kind ? p : x)));
	}
</script>

<div class="desktop" data-wallpaper={shell.wallpaper} bind:clientWidth={w} bind:clientHeight={h}>
	<!-- El fondo (app «Fondo de pantalla» de «OS 5»): uno por escritorio, imagen propia, vivos y presentación. -->
	<WallLayer />
	<ul class="icons" aria-label="Accesos directos">
		{#each icons as a (a.id)}
			<li>
				<!-- Con ratón, doble clic (como en un escritorio); con el dedo o el teclado (Intro), un toque. -->
				<button type="button" ondblclick={() => onopen(a.id)} onclick={(e) => (e as unknown as PointerEvent).pointerType !== 'mouse' && onopen(a.id)} title={a.desc}>
					<span class="ico" aria-hidden="true">{a.icon ?? a.code?.slice(0, 3) ?? '·'}</span>
					<span class="name">{a.title}</span>
				</button>
			</li>
		{/each}
	</ul>
	<div class="widgets" class:hidden={shell.widgetsHidden}>
		{#each widgets as wd (wd.kind)}
			<Widget w={wd} desk={{ w, h }} onmove={moveTo} onremove={() => setWidgets(removeWidget(widgets, wd.kind))}>
				<WidgetBody kind={wd.kind} {onnavigate} />
			</Widget>
		{/each}
	</div>
	<!-- Las ventanas del núcleo, encima; lo vacío deja pasar el ratón a los widgets y los iconos. -->
	{#if children}<div class="wins">{@render children()}</div>{/if}
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
	.desktop {
		position: relative;
		height: 100%;
		overflow: hidden;
		background: var(--os-desk);
		background-image: var(--bg-image, none);
	}
	/* «El del aspecto»: un fondo propio de cada uno, hecho con los colores de la estética. */
	:global([data-os-skin='windows']) .desktop[data-wallpaper='sistema'] {
		background-image: radial-gradient(ellipse 80% 60% at 50% 110%, var(--amber-soft), transparent 70%), radial-gradient(ellipse 60% 50% at 80% 0%, var(--raise), transparent 70%);
	}
	:global([data-os-skin='mac']) .desktop[data-wallpaper='sistema'] {
		background-image: linear-gradient(160deg, var(--raise) 0%, var(--amber-soft) 55%, var(--panel) 100%);
	}
	:global([data-os-skin='linux']) .desktop[data-wallpaper='sistema'] {
		background-image: radial-gradient(circle at 70% 30%, var(--amber-soft), transparent 45%), linear-gradient(var(--panel), var(--bg));
	}
	.desktop[data-wallpaper='liso'] {
		background-image: none;
	}
	.desktop[data-wallpaper='rejilla'] {
		background-image:
			linear-gradient(var(--line) var(--hair), transparent var(--hair)),
			linear-gradient(90deg, var(--line) var(--hair), transparent var(--hair));
		background-size: 32px 32px;
	}
	.desktop[data-wallpaper='degradado'] {
		background-image: radial-gradient(ellipse at 20% 0%, var(--amber-soft), transparent 60%), linear-gradient(var(--bg), var(--panel));
	}
	.icons {
		position: absolute;
		top: var(--sp-12);
		left: var(--sp-12);
		display: grid;
		grid-auto-flow: column;
		grid-template-rows: repeat(auto-fill, 84px);
		gap: var(--sp-4);
		max-height: calc(100% - 2 * var(--sp-12));
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.icons button {
		display: grid;
		justify-items: center;
		gap: var(--sp-4);
		width: 84px;
		padding: var(--sp-6) var(--sp-4);
		border-radius: var(--radius-s);
	}
	.icons button:hover,
	.icons button:focus-visible {
		background: var(--amber-soft);
	}
	.ico {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		background: var(--panel);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--radius);
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-s);
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-xs);
		text-shadow: 0 0 var(--sp-4) var(--bg);
	}
	.widgets {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.widgets :global(.widget) {
		pointer-events: auto;
	}
	.widgets.hidden {
		display: none;
	}
	/* DSM: iconos grandes, en columnas desde arriba a la izquierda. */
	:global([data-os-skin='dsm']) .icons {
		grid-template-rows: repeat(auto-fill, 112px);
	}
	:global([data-os-skin='dsm']) .icons button {
		width: 104px;
	}
	:global([data-os-skin='dsm']) .ico {
		width: 64px;
		height: 64px;
		border-radius: var(--os-icon-radius);
		font-size: var(--fs-xl);
	}
	:global([data-os-skin='dsm']) .desktop[data-wallpaper='sistema'] {
		background-image: linear-gradient(180deg, var(--amber-soft) 0%, transparent 40%), radial-gradient(ellipse 70% 50% at 30% 100%, var(--raise), transparent 70%);
	}
	.wins {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.wins :global([data-os-layer]) {
		pointer-events: none;
	}
</style>
