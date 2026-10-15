<!-- Divisas con los cambios de referencia del BCE (ecb.json, el mismo que usa la barra: fxlive.svelte.ts). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { convert } from '../../../fx.ts';
	import { fxLive, loadFxRates } from '../../../fxlive.svelte.ts';
	import { parseNum } from './fin.ts';
	import { calc } from './state.svelte.ts';

	onMount(loadFxRates);

	// La cantidad y las divisas viven en state.svelte.ts: no se pierden al cambiar de pestaña.
	const x = calc.fx;
	const codes = $derived(fxLive.rates ? [...fxLive.rates.keys()].sort() : []);
	const result = $derived(fxLive.rates ? convert(parseNum(x.amount), x.from, x.to, fxLive.rates) : null);
	const date = $derived(fxLive.rates?.get(x.from === 'EUR' ? x.to : x.from)?.date ?? '');
	const swap = () => ([x.from, x.to] = [x.to, x.from]);
	// loadFxRates() solo descarga si nunca lo ha intentado: tras un fallo, se vuelve a dejar en «idle».
	function retry() {
		fxLive.status = 'idle';
		loadFxRates();
	}
</script>

<div class="fx">
	{#if fxLive.status === 'error'}
		<p class="empty">No se han podido cargar los cambios del BCE (¿sin conexión?).</p>
		<button type="button" class="retry" onclick={retry}>Reintentar</button>
	{:else if !fxLive.rates}
		<p class="empty">Cargando los cambios del BCE…</p>
	{:else}
		<div class="row">
			<label>Cantidad<input inputmode="decimal" bind:value={x.amount} /></label>
			<label>De<select bind:value={x.from}>{#each codes as c (c)}<option>{c}</option>{/each}</select></label>
			<button type="button" onclick={swap} aria-label="Cambiar el orden" title="Cambiar el orden">⇄</button>
			<label>A<select bind:value={x.to}>{#each codes as c (c)}<option>{c}</option>{/each}</select></label>
		</div>
		<p class="res">{result === null ? '—' : `${result.toLocaleString('es-ES', { maximumFractionDigits: 4 })} ${x.to}`}</p>
		<p class="note">Cambio de referencia del BCE{date ? ` · ${date}` : ''}. Orientativo: tu banco aplica su margen.</p>
	{/if}
</div>

<style>
	.fx {
		display: grid;
		gap: var(--sp-12);
		max-width: 520px;
		margin: 0 auto;
	}

	.empty {
		margin: 0;
		color: var(--muted);
	}

	.retry {
		justify-self: start;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--sp-8);
	}

	label {
		display: grid;
		gap: var(--sp-4);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	input,
	select,
	button {
		height: var(--control-h);
		padding: 0 var(--sp-8);
		font: inherit;
		font-size: var(--fs-field);
		color: var(--fg);
		background: var(--bg);
		border: var(--border);
		border-radius: var(--radius-s);
	}

	input {
		width: 140px;
	}

	button {
		cursor: pointer;
	}

	.res {
		margin: 0;
		color: var(--amber);
		font-size: var(--fs-xxl);
	}

	.note {
		margin: 0;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}
</style>
