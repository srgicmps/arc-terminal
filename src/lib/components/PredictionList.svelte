<!--
	Mercados de predicción: pregunta y probabilidad de cada opción, con una barra fina y el cambio en 24 h
	(en puntos). Los que más se mueven van arriba (byMove, src/lib/predictions.ts).
-->
<script lang="ts">
	import { compact, nf, signed } from '#lib/format.ts';
	import { byMove } from '#lib/predictions.ts';
	import Bar from './ui/Bar.svelte';
	import type { Prediction } from '#lib/types.ts';

	let { items }: { items: Prediction[] } = $props();

	const sorted = $derived(byMove(items));
	/** Cambio en 24 h en puntos, sin signo de color (subir no es bueno ni malo); vacío si es menos de medio punto. */
	const move = (d: number | undefined) => (d === undefined || Math.abs(d) < 0.005 ? '' : `${signed(d * 100, 0)} pt`);
</script>

{#if items.length}
	<ul class="pm">
		{#each sorted as e (e.id)}
			<li>
				<a class="q" href={e.url} target="_blank" rel="noopener">{e.title}</a>
				{#each e.outcomes as o (o.label)}
					<div class="o">
						<span class="lab">{o.label}</span>
						<Bar pct={o.p * 100} tone="amber" thin />
						<b>{nf(o.p * 100, 0)} %</b>
						<span class="mv" class:big={Math.abs(o.d ?? 0) >= 0.05}>{move(o.d)}</span>
					</div>
				{/each}
				{#if e.volume24h}<small>Volumen 24 h: {compact(e.volume24h)} $</small>{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	.pm {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		padding: var(--sp-9) var(--pad-x);
		border-bottom: var(--border);
	}

	li:last-child {
		border-bottom: 0;
	}

	.q {
		display: block;
		margin-bottom: var(--sp-5);
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: var(--lh-tight);
	}

	.q:hover {
		color: var(--amber);
	}

	.o {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 90px 44px 44px;
		gap: var(--sp-10);
		align-items: center;
		font-size: var(--fs-s);
		padding: var(--sp-1) 0;
	}

	.lab {
		color: var(--muted);
		font-family: var(--sans);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}


	b {
		font-weight: var(--fw-medium);
		text-align: right;
	}

	/* Paneles estrechos (móvil): la barra encoge para que la etiqueta de la opción no quede en nada. */
	@container (max-width: 420px) {
		.o {
			grid-template-columns: minmax(0, 1fr) 48px 40px 40px;
			gap: var(--sp-6);
		}
	}

	.mv {
		color: var(--faint);
		text-align: right;
	}

	.mv.big {
		color: var(--amber);
	}

	small {
		display: block;
		margin-top: var(--sp-4);
		color: var(--faint);
		font-size: var(--fs-xs);
	}
</style>
