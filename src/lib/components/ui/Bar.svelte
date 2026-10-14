<!-- Barra horizontal de comparación (0–100 %). Decorativa: el dato va escrito al lado. -->
<script lang="ts">
	interface Props {
		/** Largo de la barra, de 0 a 100. */
		pct: number;
		/** Color: gris (por defecto), verde para «la mejor» o ámbar. */
		tone?: 'faint' | 'up' | 'amber';
		/** Más fina (listas). */
		thin?: boolean;
	}

	let { pct, tone = 'faint', thin = false }: Props = $props();
</script>

<span class="bar" class:thin aria-hidden="true"><i class={tone} style:width="{pct.toFixed(0)}%"></i></span>

<style>
	.bar {
		display: block;
		position: relative;
		height: var(--bar-h);
		min-width: var(--bar-min);
		background: var(--raise);
	}

	.thin {
		height: var(--bar-h-thin);
	}

	i {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--faint);
	}

	.up {
		background: var(--up);
	}

	.amber {
		background: var(--amber);
		opacity: 0.75;
	}
</style>
