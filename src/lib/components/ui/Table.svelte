<!--
	Tabla densa con desplazamiento horizontal si no cabe. Dentro van <thead> y <tbody>, como en un <table>.
	Clases para las celdas: .l (alineada a la izquierda; la primera columna ya lo está), .name (nombre en
	letra de texto), .sub (detalle gris tras el nombre, se oculta en paneles estrechos), .mut (gris).
	Los estilos son globales (:global) porque las celdas las escribe quien usa la tabla, no este componente.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Alto máximo (p. ej. «420px»): a partir de ahí, la tabla se desplaza en vertical. */
		maxHeight?: string;
		children: Snippet;
	}

	let { maxHeight, children }: Props = $props();
</script>

<div class="scroll" class:capped={maxHeight} style:max-height={maxHeight}>
	<table class="t">
		{@render children()}
	</table>
</div>

<style>
	.scroll {
		position: relative;
		overflow-x: auto;
	}

	.capped {
		overflow-y: auto;
	}

	:global {
		.t {
			width: 100%;
			border-collapse: collapse;
			font-size: var(--fs-s);
		}
		.t th,
		.t td {
			padding: var(--sp-5) var(--sp-10);
			text-align: right;
			white-space: nowrap;
			border-bottom: var(--border);
		}
		.t tbody tr:last-child td {
			border-bottom: 0;
		}
		.t th {
			padding-block: var(--sp-6);
			font-weight: var(--fw-regular);
			font-size: var(--fs-xs);
			letter-spacing: var(--track-caps);
			text-transform: uppercase;
			color: var(--faint);
		}
		.t th:first-child,
		.t td:first-child,
		.t .l {
			text-align: left;
		}
		.t .name {
			font-family: var(--sans);
			font-size: var(--fs-m);
		}
		.t .sub {
			margin-left: var(--sp-6);
			color: var(--muted);
			font-family: var(--sans);
			font-size: var(--fs-s);
		}
	}

	@container (max-width: 390px) {
		:global(.t .sub) {
			display: none;
		}
	}

	/* Pantallas táctiles: la celda que empieza por un enlace o botón (y no tiene otro) crece hasta 44 px
	   y el ::after invisible del enlace la cubre entera. */
	@media (pointer: coarse) {
		:global(.t td:has(> :is(a, button):first-child):not(:has(:is(a, button) ~ :is(a, button)))) {
			position: relative;
			height: var(--touch);
		}
		:global(.t td:not(:has(:is(a, button) ~ :is(a, button))) > :is(a, button):first-child::after) {
			content: '';
			position: absolute;
			inset: 0;
		}
	}
</style>
