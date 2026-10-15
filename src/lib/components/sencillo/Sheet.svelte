<!--
	Hoja que sube desde abajo (como en las apps del móvil) con el detalle de una tarjeta. Es un <dialog> modal:
	Esc y el fondo la cierran, y el foco vuelve solo a la tarjeta. En el móvil se cierra también deslizándola hacia
	abajo desde el asa. En pantallas grandes sale centrada.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let { open = $bindable(false), title, children }: { open: boolean; title: string; children: Snippet } = $props();

	let dialog = $state<HTMLDialogElement>();
	let drag = $state(0);
	let startY: number | null = null;

	// Como un watch de Vue sobre `open`: abre o cierra el <dialog> de verdad.
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function onTouchStart(e: TouchEvent) {
		startY = e.touches[0].clientY;
	}
	function onTouchMove(e: TouchEvent) {
		if (startY !== null) drag = Math.max(0, e.touches[0].clientY - startY);
	}
	function onTouchEnd() {
		if (drag > 90) open = false;
		drag = 0;
		startY = null;
	}
</script>

<dialog
	bind:this={dialog}
	class="sheet"
	aria-label={title}
	style:translate={drag ? `0 ${drag}px` : undefined}
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && (open = false)}
>
	<div class="grip" ontouchstart={onTouchStart} ontouchmove={onTouchMove} ontouchend={onTouchEnd} aria-hidden="true"><span></span></div>
	<header>
		<h2>{title}</h2>
		<button type="button" class="x" aria-label="Cerrar" onclick={() => (open = false)}><Icon name="close" /></button>
	</header>
	<div class="body">
		{#if open}{@render children()}{/if}
	</div>
</dialog>

<style>
	.sheet {
		position: fixed;
		inset: auto 0 0;
		width: 100%;
		max-width: var(--app-max);
		max-height: var(--app-sheet-max);
		margin: 0 auto;
		padding: 0 0 env(safe-area-inset-bottom);
		border: 0;
		border-radius: var(--app-radius) var(--app-radius) 0 0;
		background: var(--panel);
		color: var(--fg);
		font-family: var(--app-font);
		box-shadow: var(--app-shadow);
		overflow: hidden auto;
		overscroll-behavior: contain;
	}

	.sheet[open] {
		display: flex;
		flex-direction: column;
		animation: up var(--app-dur) ease-out;
	}

	.sheet::backdrop {
		background: var(--scrim);
	}

	@media (min-width: 900px) {
		.sheet {
			inset: 0;
			margin: auto;
			height: fit-content;
			border-radius: var(--app-radius);
		}
	}

	@keyframes up {
		from {
			translate: 0 var(--sp-24);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet[open] {
			animation: none;
		}
	}

	.grip {
		display: flex;
		justify-content: center;
		padding: var(--sp-8) 0 var(--sp-2);
		touch-action: none;
	}

	.grip span {
		width: var(--sp-24);
		height: var(--sp-4);
		border-radius: var(--app-radius-pill);
		background: var(--line);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-12);
		padding: var(--sp-4) var(--sp-20) var(--sp-8);
	}

	h2 {
		margin: 0;
		font-size: var(--app-fs-h2);
		font-weight: var(--fw-bold);
	}

	.x {
		display: grid;
		place-items: center;
		width: var(--touch);
		height: var(--touch);
		border: 0;
		border-radius: var(--app-radius-pill);
		background: var(--raise);
		color: var(--muted);
		cursor: pointer;
	}

	.body {
		padding: 0 var(--sp-20) var(--sp-24);
	}
</style>
