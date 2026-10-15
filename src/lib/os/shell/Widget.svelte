<!--
	Un widget del escritorio de Arc OS: tarjeta movible (arrastrar por la cabecera, o foco + flechas; Mayúsculas
	para ir más rápido) con ✕ para quitarlo. Al soltar se ajusta a la rejilla y no se sale del escritorio.
-->
<script lang="ts">
	import UiIcon from '../icons/UiIcon.svelte';
	import type { Snippet } from 'svelte';
	import { nudge, snap, WIDGET_LABEL, WIDGET_W, type Placed } from './widgets.ts';

	interface Props {
		w: Placed;
		desk: { w: number; h: number };
		onmove: (p: Placed) => void;
		onremove: () => void;
		children: Snippet;
	}
	let { w, desk, onmove, onremove, children }: Props = $props();

	let drag = $state<{ dx: number; dy: number; x: number; y: number } | null>(null);
	let el = $state<HTMLElement>();

	function down(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('button')) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { dx: e.clientX - w.x, dy: e.clientY - w.y, x: w.x, y: w.y };
	}
	function move(e: PointerEvent) {
		if (drag) drag = { ...drag, x: e.clientX - drag.dx, y: e.clientY - drag.dy };
	}
	function up() {
		if (!drag) return;
		onmove(snap({ ...w, x: drag.x, y: drag.y }, desk.w, desk.h, el?.offsetHeight));
		drag = null;
	}
	function key(e: KeyboardEvent) {
		if (!e.key.startsWith('Arrow')) return;
		e.preventDefault();
		onmove(snap(nudge(w, e.key, e.shiftKey), desk.w, desk.h, el?.offsetHeight));
	}
</script>

<section
	bind:this={el}
	class="widget"
	class:dragging={drag}
	style:left={`${drag?.x ?? w.x}px`}
	style:top={`${drag?.y ?? w.y}px`}
	style:width={`${WIDGET_W}px`}
	aria-label={WIDGET_LABEL[w.kind]}
>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<header
		tabindex="0"
		role="toolbar"
		aria-label={`${WIDGET_LABEL[w.kind]}: flechas para moverlo`}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onkeydown={key}
	>
		<span>{WIDGET_LABEL[w.kind]}</span>
		<button type="button" aria-label={`Quitar ${WIDGET_LABEL[w.kind]}`} onclick={onremove}><UiIcon id="close" size={12} /></button>
	</header>
	<div class="body">{@render children()}</div>
</section>

<style>
	/* Botones de la shell sin el borde ni el fondo que algunas estéticas dan a todos los botones. */
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.widget {
		position: absolute;
		background: var(--panel);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		backdrop-filter: var(--panel-blur);
	}
	.dragging {
		box-shadow: var(--shadow-pop);
		z-index: 1;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--sp-4) var(--sp-4) var(--sp-4) var(--sp-10);
		color: var(--muted);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	.dragging header {
		cursor: grabbing;
	}
	header button {
		display: grid;
		place-items: center;
		padding: var(--sp-4);
		color: var(--faint);
	}
	header button:hover {
		color: var(--fg);
	}
	.body {
		padding: 0 var(--sp-10) var(--sp-10);
		font-size: var(--fs-s);
	}
</style>
