<!--
	Índice de paneles en el móvil (≤ 720 px), solo en vistas de más de 6 paneles: una fila fina de chips con
	los títulos, fija arriba al hacer scroll, que lleva a cada panel. Se desliza en horizontal y no cuenta
	para «deslizar entre vistas» (data-noswipe).
-->
<script lang="ts">
	import { edgeFade } from '#lib/edgefade.ts';
	import { getPanelIndex } from '#lib/panelindex.svelte.ts';

	const MIN = 7;
	const index = getPanelIndex();
	const items = $derived(index?.ordered ?? []);

	function go(el: HTMLElement) {
		const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
		el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
	}
</script>

{#if items.length >= MIN}
	<nav class="pidx" data-ui="panel-index" aria-label="Paneles de esta vista" data-noswipe use:edgeFade>
		{#each items as item (item.id)}
			<button type="button" onclick={() => go(item.el)}><span>{item.title}</span></button>
		{/each}
	</nav>
{/if}

<style>
	.pidx {
		display: none;
	}

	@media (max-width: 720px) {
		.pidx {
			position: sticky;
			top: 0;
			z-index: var(--z-bar);
			display: flex;
			gap: var(--sp-6);
			overflow-x: auto;
			scrollbar-width: none;
			margin-bottom: var(--sp-8);
			background: var(--bg);
			border-bottom: var(--border);
		}

		.pidx::-webkit-scrollbar {
			display: none;
		}

		/* El botón es más alto que el chip que se ve (36 px pulsables, 26 px de chip): fila fina y fácil de tocar. */
		button {
			flex: none;
			display: flex;
			align-items: center;
			min-height: 0;
			height: calc(var(--index-chip) + var(--sp-10));
			padding: 0;
			background: none;
			border: 0;
			cursor: pointer;
		}

		span {
			display: flex;
			align-items: center;
			height: var(--index-chip);
			padding: 0 var(--sp-8);
			border: var(--border);
			color: var(--muted);
			font-size: var(--fs-xs);
			letter-spacing: var(--track-label);
			text-transform: uppercase;
		}

		button:active span,
		button:focus-visible span {
			color: var(--amber);
			border-color: var(--amber-edge);
		}
	}
</style>
