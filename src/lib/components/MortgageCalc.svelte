<!--
	Calculadora de hipoteca variable con el euríbor a 12 meses real (serie «euribor-12m» del BCE).
	Da la cuota de hoy y la de hace un año con el mismo capital, plazo y diferencial. Todo se calcula en el
	navegador; lo que escribe el usuario se guarda en localStorage (si el navegador no deja, sigue en memoria).
-->
<script lang="ts">
	import { nf, period, signed } from '#lib/format.ts';
	import { lastAndYearAgo, monthlyPayment } from '#lib/mortgage.ts';
	import Table from './ui/Table.svelte';
	import Tile from './ui/Tile.svelte';
	import Tiles from './ui/Tiles.svelte';
	import type { Series } from '#lib/types.ts';

	let { euribor }: { euribor: Series | undefined } = $props();

	const KEY = 'arc-mortgage';
	let form = $state({ capital: 150000, years: 25, spread: 0.75 });
	let loaded = $state(false);

	// Al arrancar en el navegador, recupera lo último que se escribió (como un onMounted de Vue).
	$effect(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
			for (const k of ['capital', 'years', 'spread'] as const)
				if (typeof saved?.[k] === 'number' && Number.isFinite(saved[k])) form[k] = saved[k];
		} catch {}
		loaded = true;
	});

	// Y guarda cada cambio (como un watch profundo de Vue). Espera a haber leído lo guardado para no pisarlo.
	$effect(() => {
		const value = JSON.stringify(form);
		if (!loaded) return;
		try {
			localStorage.setItem(KEY, value);
		} catch {}
	});

	const rates = $derived(lastAndYearAgo(euribor));
	const now = $derived(rates ? monthlyPayment(form.capital, form.years, rates.now.v + form.spread) : null);
	const before = $derived(rates?.before ? monthlyPayment(form.capital, form.years, rates.before.v + form.spread) : null);
	const diff = $derived(now !== null && before !== null ? now - before : null);
</script>

{#if rates}
	<Table>
		<tbody>
			<tr>
				<td class="name"><label for="mc-capital">Capital pendiente</label></td>
				<td><input id="mc-capital" type="number" inputmode="numeric" min="0" step="1000" bind:value={form.capital} /> €</td>
			</tr>
			<tr>
				<td class="name"><label for="mc-years">Años que quedan</label></td>
				<td><input id="mc-years" type="number" inputmode="numeric" min="1" max="40" step="1" bind:value={form.years} /> a</td>
			</tr>
			<tr>
				<td class="name"><label for="mc-spread">Diferencial</label></td>
				<td><input id="mc-spread" type="number" inputmode="decimal" min="0" step="0.05" bind:value={form.spread} /> %</td>
			</tr>
		</tbody>
	</Table>
	<Tiles>
		<Tile label="Cuota hoy" value="{nf(now)} €" sub="Euríbor {period(rates.now.t)}: {nf(rates.now.v, 3)} %" />
		<Tile
			label="Hace un año"
			value="{nf(before)} €"
			sub={rates.before ? `Euríbor ${period(rates.before.t)}: ${nf(rates.before.v, 3)} %` : 'Sin el dato de hace un año'}
		/>
		<!-- Pagar más es una subida (rojo); pagar menos, una bajada (verde). -->
		<Tile
			label="Diferencia"
			value={diff === null ? '—' : `${signed(diff, 0)} €/mes`}
			tone={diff === null ? 'mut' : diff > 0 ? 'down' : diff < 0 ? 'up' : 'flat'}
			sub="Con el mismo capital y plazo"
		/>
	</Tiles>
{:else}
	<p class="empty">Sin datos del euríbor todavía.</p>
{/if}

<style>
	input {
		width: 9ch;
		text-align: right;
		background: var(--raise);
		border: var(--border);
	}

	input:focus {
		outline: none;
		border-color: var(--amber);
	}
</style>
