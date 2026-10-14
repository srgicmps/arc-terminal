<!-- De dónde sale la electricidad: una barra fina con el peso de cada tecnología y el % renovable.
     Renovables en tonos ámbar y el resto en grises (el verde y el rojo quedan para subidas y bajadas). -->
<script lang="ts">
	import { nf } from '#lib/format.ts';
	import type { PowerMix } from '#lib/types.ts';

	let { mix }: { mix: PowerMix } = $props();

	const pct = (share: number) => `${nf(share * 100, 0)} %`;
	const parts = $derived(mix.groups.filter((g) => g.share > 0));
</script>

<div class="mix">
	<div class="head">
		<span class="name">{mix.label}</span>
		<span class="ren"><b>{pct(mix.renewable)}</b> renovable</span>
	</div>
	<div class="bar" role="img" aria-label={parts.map((g) => `${g.label} ${pct(g.share)}`).join(', ')}>
		{#each parts as g (g.key)}
			<span class="seg {g.key}" style:width="{g.share * 100}%" title="{g.label} · {pct(g.share)}"></span>
		{/each}
	</div>
	<ul class="legend">
		{#each parts as g (g.key)}
			<li title={g.techs.join(', ')}><i class="seg {g.key}"></i>{g.label} <b>{pct(g.share)}</b></li>
		{/each}
	</ul>
	<p class="sub">
		{nf(mix.mwh / 1000, 0)} GWh generados{#if mix.co2 !== null}&nbsp;· {nf(mix.co2 / 1000, 1)} mil t de CO₂{/if}
	</p>
</div>

<style>
	.mix {
		padding: var(--sp-10) var(--pad-x);
	}

	.mix + .mix {
		border-top: var(--border);
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: var(--sp-6);
	}

	.name {
		font-family: var(--sans);
		font-size: var(--fs-l);
	}

	.ren {
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.ren b {
		color: var(--amber);
		font-weight: var(--fw-medium);
	}

	.bar {
		display: flex;
		height: var(--bar-h);
		gap: var(--hair);
		background: var(--line);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-14);
		margin: var(--sp-8) 0 0;
		padding: 0;
		list-style: none;
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.legend li {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-5);
	}

	.legend b {
		color: var(--fg);
		font-weight: var(--fw-regular);
	}

	.legend i {
		width: var(--swatch);
		height: var(--swatch);
	}

	.sub {
		margin: var(--sp-6) 0 0;
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	/* Renovables: ámbar de más a menos intenso. No renovables: grises. */
	.wind {
		background: var(--amber);
	}

	.solar {
		background: var(--amber);
		opacity: 0.75;
	}

	.hydro {
		background: var(--amber-edge);
	}

	.nuclear {
		background: var(--muted);
	}

	.gas {
		background: var(--faint);
	}

	.other {
		background: var(--neutral);
	}
</style>
