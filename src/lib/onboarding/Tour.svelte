<!--
	Recorrido corto (pasos en tour.ts, estado en tour.svelte.ts). Una tarjeta abajo y, si el paso señala algo
	que se ve, un marco fino alrededor. Se salta con «Saltar» o Esc; ← → cambian de paso.
-->
<script lang="ts">
	import { TOUR } from './tour.ts';
	import { closeTour, stepTour, tour } from './tour.svelte.ts';

	const step = $derived(TOUR[tour.step]);
	let box = $state<{ top: number; left: number; width: number; height: number } | null>(null);
	let card = $state<HTMLElement>();

	function measure() {
		box = null;
		for (const sel of step.targets) {
			const r = document.querySelector(sel)?.getBoundingClientRect();
			if (r && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight) {
				box = { top: r.top - 4, left: r.left - 4, width: r.width + 8, height: Math.min(r.height, innerHeight * 0.5) + 8 };
				return;
			}
		}
	}

	$effect(() => {
		void tour.step;
		measure();
		card?.focus();
	});

	function escape(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		e.stopImmediatePropagation();
		closeTour();
	}

	function onkey(e: KeyboardEvent) {
		if (e.key === 'Escape') closeTour();
		else if (e.key === 'ArrowRight') stepTour(1, TOUR.length);
		else if (e.key === 'ArrowLeft') stepTour(-1, TOUR.length);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}
</script>

<!-- Esc cierra el recorrido aunque el foco ya no esté en la tarjeta (tras un clic fuera): sin esto llegaba al Esc
	general de la barra, que lleva a TOP y dejaba el recorrido abierto sin ir a tu inicio. -->
<svelte:window onresize={measure} onscroll={measure} onkeydowncapture={escape} />

{#if box}
	<div class="mark" style:top="{box.top}px" style:left="{box.left}px" style:width="{box.width}px" style:height="{box.height}px" aria-hidden="true"></div>
{/if}

<div class="tour" role="dialog" aria-modal="false" aria-labelledby="tour-title" tabindex="-1" bind:this={card} onkeydown={onkey}>
	<p class="count">{tour.step + 1} / {TOUR.length}</p>
	<h2 id="tour-title">{step.title}</h2>
	<p class="text">{step.text}</p>
	<div class="actions">
		<button type="button" class="skip" onclick={closeTour}>Saltar</button>
		{#if tour.step > 0}<button type="button" onclick={() => stepTour(-1, TOUR.length)}>Atrás</button>{/if}
		<button type="button" class="next" onclick={() => stepTour(1, TOUR.length)}>{tour.step === TOUR.length - 1 ? 'Listo' : 'Siguiente'}</button>
	</div>
</div>

<style>
	.mark {
		position: fixed;
		z-index: var(--z-modal);
		border: var(--hair) solid var(--amber);
		box-shadow: 0 0 0 100vmax var(--scrim);
		pointer-events: none;
		transition: all var(--dur-fast);
	}
	.tour {
		position: fixed;
		z-index: var(--z-modal);
		left: 50%;
		bottom: calc(var(--tabbar-h) + var(--sp-16) + env(safe-area-inset-bottom));
		translate: -50% 0;
		width: min(420px, calc(100vw - 2 * var(--gutter-touch)));
		padding: var(--sp-14) var(--sp-16);
		background: var(--panel);
		border: var(--hair) solid var(--amber-edge);
		font-family: var(--sans);
	}
	.tour:focus {
		outline: none;
	}
	@media (min-width: 721px) {
		.tour {
			bottom: var(--sp-24);
		}
	}
	.count {
		margin: 0;
		font: var(--fs-xs) var(--mono);
		letter-spacing: var(--track-code);
		color: var(--faint);
	}
	h2 {
		margin: var(--sp-4) 0 var(--sp-6);
		font-size: var(--fs-l);
		font-weight: var(--fw-bold);
		color: var(--amber);
	}
	.text {
		margin: 0;
		font-size: var(--fs-m);
		line-height: var(--lh-loose);
		color: var(--fg);
	}
	.actions {
		display: flex;
		gap: var(--sp-8);
		margin-top: var(--sp-14);
	}
	button {
		height: var(--control-h);
		padding: 0 var(--sp-12);
		font: var(--fs-s) var(--mono);
		color: var(--fg);
		background: var(--raise);
		border: var(--border);
		cursor: pointer;
	}
	.skip {
		margin-right: auto;
		color: var(--muted);
		background: none;
		border-color: transparent;
	}
	.next {
		color: var(--on-amber);
		background: var(--amber);
		border-color: var(--amber);
	}
	@media (prefers-reduced-motion: reduce) {
		.mark {
			transition: none;
		}
	}
</style>
