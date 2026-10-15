<!--
	HIPOTECA (F7): cuota, cuadro de amortización y la próxima revisión con el euríbor a 12 meses de hoy.
	Los datos de tu hipoteca se quedan en tu navegador (clave arc-mortgage, la misma que «Tu hipoteca» de ECO) y,
	con cuenta, en tus ajustes privados (D1). Nunca llegan al repo ni a los JSON públicos.
-->
<script lang="ts">
	import DecimalInput from '#lib/components/DecimalInput.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import Tile from '#lib/components/ui/Tile.svelte';
	import Tiles from '#lib/components/ui/Tiles.svelte';
	import { nf, period, signed } from '#lib/format.ts';
	import { amortization, balanceAfter, firstYearPaid, monthlyPayment, nextReview } from '#lib/mortgage.ts';
	import { last } from '#lib/series.ts';

	let { data } = $props();

	const KEY = 'arc-mortgage';
	const FIELDS = ['capital', 'years', 'spread', 'rate', 'month', 'every'] as const;
	let form = $state({ capital: 150000, years: 25, spread: 0.75, rate: 3, month: 1, every: 12 });
	let loaded = $state(false);

	// Como un onMounted de Vue: recupera lo guardado (también lo que escribiste en ECO, «Tu hipoteca»).
	$effect(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
			for (const k of FIELDS) if (typeof saved?.[k] === 'number' && Number.isFinite(saved[k])) form[k] = saved[k];
		} catch {}
		loaded = true;
	});

	// Como un watch profundo: guarda cada cambio, sin borrar lo que otra vista guarde en la misma clave.
	$effect(() => {
		const value = { ...form };
		if (!loaded) return;
		try {
			const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
			localStorage.setItem(KEY, JSON.stringify({ ...saved, ...value }));
		} catch {}
	});

	const EVERY = [
		{ value: '12', label: 'Anual' },
		{ value: '6', label: 'Semestral' }
	];
	const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

	const euribor = $derived(last(data.ecb?.data.series.find((s) => s.id === 'euribor-12m')));
	const pay = $derived(monthlyPayment(form.capital, form.years, form.rate));
	const rows = $derived(amortization(form.capital, form.years, form.rate));
	const interest = $derived(rows.reduce((s, r) => s + r.interest, 0));
	const yearPaid = $derived(firstYearPaid(form.capital, form.years, form.rate));
	// Desde la Ley 5/2019 el interés no baja de 0: la cuota se calcula así y así se enseña.
	const rateNow = $derived(Number.isFinite(form.rate) ? Math.max(form.rate, 0) : null);
	const review = $derived(nextReview(form.month, form.every === 6 ? 6 : 12, new Date()));
	// ¿Acaba de pagarse antes de la revisión? Entonces no hay cuota nueva.
	const endsBefore = $derived(review !== null && pay !== null && review.months >= Math.round(form.years * 12));
	// Un diferencial vacío cuenta como 0.
	const spread = $derived(Number.isFinite(form.spread) ? form.spread : 0);
	const newRate = $derived(euribor ? Math.max(euribor.v + spread, 0) : null);
	// En la revisión, el banco recalcula la cuota con lo que quede y los años que falten.
	const left = $derived(review ? balanceAfter(form.capital, form.years, form.rate, review.months) : null);
	const newPay = $derived(
		review && left !== null && newRate !== null ? monthlyPayment(left, form.years - review.months / 12, newRate) : null
	);
	const diff = $derived(newPay !== null && pay !== null ? newPay - pay : null);
	const when = $derived(review ? (review.months === 0 ? 'este mes' : review.months === 1 ? 'el mes que viene' : `en ${review.months} meses`) : '');
</script>

<ViewHeader code="HIPOTECA" title="Tu hipoteca" sub="Cuota, cuadro de amortización y tu próxima revisión con el euríbor de hoy" />

<div class="grid grid-2">
	<Panel title="Tus datos">
		<Table>
			<tbody>
				<tr>
					<td class="name"><label for="h-capital">Capital pendiente</label></td>
					<td><DecimalInput id="h-capital" class="num" thousands bind:value={form.capital} /> €</td>
				</tr>
				<tr>
					<td class="name"><label for="h-years">Años que quedan</label></td>
					<td><DecimalInput id="h-years" class="num" bind:value={form.years} /> a</td>
				</tr>
				<tr>
					<td class="name"><label for="h-rate">Tipo que pagas ahora</label></td>
					<td><DecimalInput id="h-rate" class="num" bind:value={form.rate} /> %</td>
				</tr>
				<tr>
					<td class="name"><label for="h-spread">Diferencial sobre el euríbor</label></td>
					<td><DecimalInput id="h-spread" class="num" bind:value={form.spread} /> %</td>
				</tr>
				<tr>
					<td class="name"><label for="h-month">Mes de la revisión</label></td>
					<td>
						<select id="h-month" bind:value={form.month}>
							{#each MONTHS as m, i (m)}<option value={i + 1}>{m}</option>{/each}
						</select>
					</td>
				</tr>
			</tbody>
		</Table>
		<div class="seg">
			<Seg label="Revisión" options={EVERY} bind:value={() => String(form.every), (v) => (form.every = Number(v))} />
		</div>
		<Note>Se guarda solo en tu navegador y, si entras con tu cuenta, en tus ajustes privados. Nadie más lo ve.</Note>
	</Panel>

	<Panel title="Tu próxima revisión">
		{#if euribor && review}
			<Tiles>
				<Tile label="Cuota de hoy" value="{nf(pay)} €" sub="Al {nf(rateNow)} %" />
				<Tile
					label="Tras la revisión"
					value="{nf(newPay)} €"
					sub={endsBefore ? `Acabas de pagar antes de ${period(review.ym)}` : `${period(review.ym)}, ${when}`}
				/>
				<!-- Pagar más es una subida (rojo); pagar menos, una bajada (verde). -->
				<Tile
					label="Diferencia"
					value={diff === null ? '—' : `${signed(diff, 0)} €/mes`}
					tone={diff === null ? 'mut' : diff > 0 ? 'down' : diff < 0 ? 'up' : 'flat'}
					sub="Al {nf(newRate)} %: euríbor {nf(euribor.v, 3)} % + {nf(spread)} %"
				/>
			</Tiles>
			<Note>
				Con el euríbor a 12 meses de {period(euribor.t)} (BCE). El banco usa el de uno o dos meses antes de la revisión: es una
				estimación, no lo que dirá tu banco.
			</Note>
		{:else}
			<p class="empty">Sin datos del euríbor todavía.</p>
		{/if}
	</Panel>
</div>

<div class="grid">
	<Panel title="Cuadro de amortización · por años">
		{#if rows.length}
			<Table>
				<thead>
					<tr><th class="l">Año</th><th>Intereses</th><th>Capital</th><th>Queda</th></tr>
				</thead>
				<tbody>
					{#each rows as r (r.year)}
						<tr>
							<td class="l">{r.year}</td>
							<td class="mut">{nf(r.interest, 0)}</td>
							<td>{nf(r.principal, 0)}</td>
							<td>{nf(r.balance, 0)}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
			<Note>
				En euros, desde hoy y con el tipo de ahora sin cambios: {rows.length > 1 ? 'cada año pagas' : 'en lo que queda pagas'} {nf(yearPaid, 0)} €. En total pagarías {nf(interest, 0)} € de intereses. Al principio
				casi todo es interés; al final, capital.
			</Note>
		{:else}
			<p class="empty">Escribe el capital, los años y el tipo.</p>
		{/if}
	</Panel>
</div>

<style>
	/* Los campos son de DecimalInput (otro componente): :global para que les lleguen estos estilos. */
	td :global(input.num),
	select {
		height: var(--control-h);
		padding: 0 var(--sp-6);
		background: var(--raise);
		border: var(--border);
		color: inherit;
		font: inherit;
	}

	td :global(input.num) {
		width: 11ch;
		text-align: right;
	}

	td :global(input.num:focus),
	select:focus {
		outline: none;
		border-color: var(--amber);
	}

	.seg {
		padding: var(--sp-8) var(--pad-x) 0;
	}
</style>
