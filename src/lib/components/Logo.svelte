<script lang="ts">
	// El logo de Arc Terminal: dos arcos finos con un punto en el centro (D44). Pinta con currentColor, que
	// es el acento (--amber), y mide --logo. Es el mismo dibujo que static/favicon.svg; si cambia, se
	// cambian los dos y se relanza scripts/icons.ts.
	let { size = 'var(--logo)' }: { size?: string } = $props();
</script>

<svg class="logo" viewBox="0 0 24 24" style:width={size} style:height={size} aria-hidden="true">
	<path d="M4 15.5a8 8 0 0 1 16 0" />
	<path d="M8 15.5a4 4 0 0 1 8 0" />
	<circle class="dot" cx="12" cy="15.5" r="1.3" />
</svg>

<style>
	.logo {
		display: block;
		flex: none;
		color: var(--amber);
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
	}

	.dot {
		fill: currentColor;
		stroke: none;
	}
</style>
