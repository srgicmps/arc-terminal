<!--
	Conversor de divisas con los tipos de referencia del BCE («100 EUR = 108,42 USD»). Se calcula en el navegador;
	la cantidad y las divisas elegidas se guardan en localStorage (si el navegador no deja, siguen en memoria).
-->
<script lang="ts">
	import { nf, period } from '#lib/format.ts';
	import { convert, fxRates } from '#lib/fx.ts';
	import Tile from './ui/Tile.svelte';
	import type { Series } from '#lib/types.ts';

	let { series }: { series: (Series | undefined)[] } = $props();

	const rates = $derived(fxRates(series));
	const codes = $derived([...rates.keys()].sort((a, b) => (a === 'EUR' ? -1 : b === 'EUR' ? 1 : a.localeCompare(b))));

	const KEY = 'arc-fx';
	let form = $state({ amount: 100, from: 'EUR', to: 'USD' });
	let loaded = $state(false);

	// Al arrancar en el navegador, recupera lo último que se eligió (como un onMounted de Vue)…
	$effect(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
			if (typeof saved?.amount === 'number' && Number.isFinite(saved.amount)) form.amount = saved.amount;
			if (typeof saved?.from === 'string') form.from = saved.from;
			if (typeof saved?.to === 'string') form.to = saved.to;
		} catch {}
		loaded = true;
	});

	// …y guarda cada cambio (como un watch de Vue), después de haber leído lo guardado.
	$effect(() => {
		const value = JSON.stringify(form);
		if (!loaded) return;
		try {
			localStorage.setItem(KEY, value);
		} catch {}
	});

	const result = $derived(convert(form.amount, form.from, form.to, rates));
	const unit = $derived(convert(1, form.to, form.from, rates));
	/** Fecha del tipo más antiguo de los dos: la del cruce. */
	const date = $derived([rates.get(form.from)?.date, rates.get(form.to)?.date].filter(Boolean).sort()[0]);

	function swap() {
		[form.from, form.to] = [form.to, form.from];
	}
</script>

{#if codes.length > 1}
	<div class="fx">
		<input type="number" inputmode="decimal" min="0" step="any" bind:value={form.amount} aria-label="Cantidad" />
		<select bind:value={form.from} aria-label="De">
			{#each codes as c (c)}<option value={c}>{c}</option>{/each}
		</select>
		<button type="button" onclick={swap} aria-label="Intercambiar divisas">⇄</button>
		<select bind:value={form.to} aria-label="A">
			{#each codes as c (c)}<option value={c}>{c}</option>{/each}
		</select>
	</div>
	<Tile
		label="{nf(form.amount)} {form.from} ="
		value="{nf(result)} {form.to}"
		sub="1 {form.to} = {nf(unit, 4)} {form.from}{date ? ` · tipo del ${period(date)}` : ''}"
	/>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	/* La fila de controles, con el mismo espaciado que la cabecera de un panel. */
	.fx {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6) var(--sp-12);
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
		justify-content: flex-start;
		/* El campo de la cantidad mide lo mismo que los desplegables (que en pantallas táctiles crecen a 44 px). */
		align-items: stretch;
	}

	input,
	select {
		background: var(--raise);
		border: var(--border);
	}

	input {
		width: 10ch;
		text-align: right;
	}

	:is(input, select):focus {
		outline: none;
		border-color: var(--amber);
	}

	button {
		background: none;
		border: var(--border);
		color: var(--muted);
		cursor: pointer;
	}

	button:hover {
		color: var(--amber);
	}
</style>
