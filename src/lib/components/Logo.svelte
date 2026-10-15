<script lang="ts">
	// El logo de Arc Terminal: un sol (dos arcos) sobre el horizonte. Toma el acento (--amber) y mide --logo.
	// Es el mismo dibujo que static/favicon.svg; si cambia, se cambian los dos y se relanza scripts/icons.ts.
	let { size = 'var(--logo)' }: { size?: string } = $props();
</script>

<svg class="logo" viewBox="0 0 24 24" style:width={size} style:height={size} aria-hidden="true">
	<path d="M5 15a7 7 0 0 1 14 0" />
	<path d="M9 15a3 3 0 0 1 6 0" />
	<path class="horizon" d="M2.5 15.8h19" />
</svg>

<style>
	.logo {
		display: block;
		flex: none;
		fill: none;
		stroke: var(--amber);
		stroke-width: 1.6;
	}

	.horizon {
		stroke-linecap: round;
	}
</style>
