<!--
	Escritorio de Arc OS: el fondo (el de la estética activa, o liso, rejilla o degradado, siempre con sus
	tokens), los accesos directos de las apps ancladas a la izquierda y los widgets movibles. Las ventanas del
	núcleo van encima (children).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { place } from '#lib/place.svelte.ts';
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
	const widgets = $derived(shell.widgets ?? (w ? defaultWidgets(w) : []));

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
	<div class="widgets">
		{#each widgets as wd (wd.kind)}
			<Widget w={wd} desk={{ w, h }} onmove={moveTo} onremove={() => setWidgets(removeWidget(widgets, wd.kind))}>
				<WidgetBody kind={wd.kind} {onnavigate} />
			</Widget>
		{/each}
	</div>
	{@render children?.()}
</div>

<style>
	.desktop {
		position: relative;
		height: 100%;
		overflow: hidden;
		background: var(--bg);
		background-image: var(--bg-image, none);
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
</style>
