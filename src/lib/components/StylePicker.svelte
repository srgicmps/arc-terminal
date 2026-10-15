<!-- Selector de estética con vista previa: cada tarjeta lleva data-style y se pinta con los tokens de su estética
	(tokens.css, «Vistas previas»). Lo usan HELP («A tu gusto») y ESTILO. Las letras de todas se cargan al abrirlo. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { ESTILOS } from '#lib/estilos.ts';
	import { READY } from '#lib/estilos-css.ts';
	import { loadFonts, setStyle, taste } from '#lib/taste.svelte.ts';

	const list = ESTILOS.filter((e) => READY.includes(e.id));

	onMount(() => loadFonts(list.map((e) => e.id), 'font-preview'));
</script>

<div class="picker" role="radiogroup" aria-label="Estética">
	{#each list as e (e.id)}
		<button type="button" class="card" role="radio" aria-checked={taste.style === e.id} data-style={e.id} onclick={() => setStyle(e.id)}>
			<span class="mock">
				<span class="mh">{e.label}</span>
				<span class="row"><span>Ibex 35</span><b class="up">+0,84 %</b></span>
				<span class="row"><span>Bund 10A</span><b class="down">−0,03</b></span>
				<svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
					<polyline points="0,18 14,15 28,17 42,10 56,12 70,6 84,8 100,3" />
				</svg>
			</span>
			<span class="desc">{e.desc}</span>
		</button>
	{/each}
</div>

<style>
	.picker {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr));
		gap: var(--sp-8);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		padding: var(--sp-8);
		text-align: left;
		border: var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		transition: border-color var(--dur-ui) var(--ease);
	}

	.card[aria-checked='true'] {
		outline: var(--sp-2) solid var(--amber);
		outline-offset: var(--sp-1);
	}

	.mock {
		display: flex;
		flex-direction: column;
		background: var(--panel);
		border: var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		overflow: hidden;
	}

	.mh {
		padding: var(--sp-4) var(--sp-8);
		border-bottom: var(--border);
		font-family: var(--title-font);
		font-size: var(--fs-title);
		font-weight: var(--fw-bold);
		letter-spacing: var(--title-track);
		text-transform: var(--title-case);
		color: var(--title-color);
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: var(--sp-6);
		padding: var(--sp-2) var(--sp-8);
		font-size: var(--fs-xs);
	}

	.row b {
		font-weight: var(--fw-medium);
	}

	svg {
		width: 100%;
		height: var(--sp-24);
		padding: 0 var(--sp-8) var(--sp-4);
	}

	polyline {
		fill: none;
		stroke: var(--amber);
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}

	.desc {
		font-family: var(--sans);
		font-size: var(--fs-xs);
		line-height: var(--lh-snug);
		color: var(--muted);
	}
</style>
