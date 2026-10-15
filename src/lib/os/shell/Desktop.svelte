<!--
	Escritorio de Arc OS: el fondo (el del aspecto, liso, rejilla o degradado, siempre con los tokens
	del aspecto), los iconos de las apps ancladas (DesktopIcons) y los widgets movibles. Las ventanas del
	núcleo van encima (children).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount, untrack } from 'svelte';
	import { place } from '#lib/place.svelte.ts';
	import WallLayer from '../system/wall/WallLayer.svelte';
	import DesktopIcons from './DesktopIcons.svelte';
	import { setWidgets, shell } from './shell.svelte.ts';
	import type { StartApp } from './start.ts';
	import Widget from './Widget.svelte';
	import WidgetBody from './WidgetBody.svelte';
	import { REFRESH_MS, refreshWidgets } from './widgetdata.svelte.ts';
	import { defaultWidgets, fitWidgets, removeWidget, stackWidgets, type Placed } from './widgets.ts';

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

	// Los de por defecto (sin tocar aún) se apilan según su alto real: con datos crecen y no deben pisarse.
	let heights = $state<number[]>([]);
	let layer = $state<HTMLElement>();
	const widgets = $derived(shell.widgets ?? (w ? stackWidgets(defaultWidgets(w, shell.skin), heights) : []));
	$effect(() => {
		void widgets.length; // volver a mirar cuando aparecen (el ancho del escritorio llega después de montar)
		if (!layer || shell.widgets) return;
		const measure = () => {
			const hs = [...layer!.querySelectorAll<HTMLElement>(':scope > .widget')].map((el) => el.offsetHeight);
			if (hs.join() !== untrack(() => heights).join()) heights = hs;
		};
		const ro = new ResizeObserver(measure);
		for (const el of layer.querySelectorAll(':scope > .widget')) ro.observe(el);
		measure();
		return () => ro.disconnect();
	});
	// En una pantalla más pequeña que cuando se colocaron, ninguno se queda fuera.
	const shown = $derived(fitWidgets(widgets, w, h));

	onMount(() => {
		const go = () => refreshWidgets(place.current);
		go();
		const id = setInterval(go, REFRESH_MS);
		return () => clearInterval(id);
	});

	function moveTo(p: Placed) {
		setWidgets(widgets.map((x) => (x.kind === p.kind ? p : x)));
	}
</script>

<!-- data-fs-drop: aquí se pueden soltar iconos de las ventanas de carpeta; sobre otra ventana, no («none»). -->
<div class="desktop" data-wallpaper={shell.wallpaper} data-fs-drop="desktop" bind:clientWidth={w} bind:clientHeight={h}>
	<!-- El fondo (app «Fondo de pantalla» de «OS 5»): uno por escritorio, imagen propia, vivos y presentación. -->
	<WallLayer />
	<DesktopIcons {apps} {w} {h} />
	<div class="widgets" class:hidden={shell.widgetsHidden} bind:this={layer}>
		{#each shown as wd (wd.kind)}
			<Widget w={wd} desk={{ w, h }} onmove={moveTo} onremove={() => setWidgets(removeWidget(widgets, wd.kind))}>
				<WidgetBody kind={wd.kind} {onnavigate} />
			</Widget>
		{/each}
	</div>
	<!-- Las ventanas del núcleo, encima; lo vacío deja pasar el ratón a los widgets y los iconos. -->
	{#if children}<div class="wins" data-fs-drop="none">{@render children()}</div>{/if}
</div>

<style>
	.desktop {
		position: relative;
		height: 100%;
		overflow: hidden;
		background: var(--os-desk);
	}
	/* «El del aspecto»: un fondo propio de cada uno, hecho con sus colores. */
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
