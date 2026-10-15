<!--
	AHORRO (F9, F10 y F11): dónde rinde hoy el dinero, cuánto crece con interés compuesto, cuánto vale hoy el de
	otro año y tu inflación con los pesos de tu cesta (MI IPC). Lo que escribes se queda en tu navegador y, con
	cuenta, en tus ajustes privados (arc-savings y arc-basket).
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import DecimalInput from '#lib/components/DecimalInput.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import Tile from '#lib/components/ui/Tile.svelte';
	import Tiles from '#lib/components/ui/Tiles.svelte';
	import { BASKET_KEY, basketToSave, myInflation, parseBasket } from '#lib/cesta.ts';
	import { nf, period, signed } from '#lib/format.ts';
	import { parseDecimal, showDecimal } from '#lib/decimal.ts';
	import { compound, realValue } from '#lib/savings.ts';

	let { data } = $props();

	const SAVINGS_KEY = 'arc-savings';
	let form = $state({ initial: 10000, monthly: 200, rate: 2, years: 10, amount: 1000, year: 2005 });
	let basket = $state<Record<string, number>>({});
	let loaded = $state(false);
	const codes = $derived(data.cesta?.groups.map((g) => g.code) ?? []);

	// Como un onMounted de Vue: recupera lo guardado. `untrack` hace que solo se ejecute una vez.
	$effect(() => untrack(() => {
		// Sin nada guardado, la rentabilidad de partida es la del depósito medio a un año.
		const deposit = data.rows.find((r) => r.id === 'deposit-1y-es');
		if (deposit) form.rate = Math.round(deposit.v * 100) / 100;
		try {
			const saved = JSON.parse(localStorage.getItem(SAVINGS_KEY) ?? 'null');
			for (const k of Object.keys(form) as (keyof typeof form)[])
				if (typeof saved?.[k] === 'number' && Number.isFinite(saved[k])) form[k] = saved[k];
			basket = parseBasket(localStorage.getItem(BASKET_KEY), codes);
		} catch {}
		loaded = true;
	}));

	// Como un watch profundo: guarda cada cambio.
	$effect(() => {
		const f = JSON.stringify(form);
		const b = basketToSave(basket, codes);
		if (!loaded) return;
		try {
			localStorage.setItem(SAVINGS_KEY, f);
			if (b === null) localStorage.removeItem(BASKET_KEY);
			else if (b !== undefined) localStorage.setItem(BASKET_KEY, b);
		} catch {}
	});

	const inflation = $derived(data.cesta?.total ?? null);
	const growth = $derived(compound(form.initial || 0, form.monthly || 0, form.rate, form.years));
	// Lo que valdría el total en dinero de hoy si la inflación siguiera como ahora.
	const realTotal = $derived(growth && inflation !== null ? growth.total / (1 + inflation / 100) ** form.years : null);
	const yearsIndex = $derived(data.cesta?.index.points ?? []);
	const firstYear = $derived(Number(yearsIndex[0]?.t.slice(0, 4) ?? 2002));
	const lastYear = $derived(Number(yearsIndex.at(-1)?.t.slice(0, 4) ?? new Date().getFullYear()));
	const YEARS = $derived(Array.from({ length: Math.max(lastYear - firstYear, 0) + 1 }, (_, i) => firstYear + i));
	const then = $derived(realValue(form.amount, yearsIndex, `${form.year}-01`));
	const mine = $derived(data.cesta ? myInflation(data.cesta.groups, basket) : null);
	const tone = (v: number | null) => (v === null ? 'mut' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat');

	function setWeight(code: string, raw: string) {
		const v = parseDecimal(raw);
		const next = { ...basket };
		if (v === null || v < 0) delete next[code];
		else next[code] = v;
		basket = next;
	}
</script>

<ViewHeader code="AHORRO" title="Tu ahorro" sub="Dónde rinde hoy el dinero, cuánto crece y cuánto se lo come la inflación" />

<div class="grid grid-2">
	<Panel title="Dónde rinde hoy tu dinero">
		{#if data.rows.length}
			<Table>
				<thead><tr><th class="l">Producto</th><th>Tipo</th><th>Real</th><th class="hide-s">Dato</th></tr></thead>
				<tbody>
					{#each data.rows as r (r.id)}
						<tr>
							<td class="l name">{r.label}</td>
							<td>{nf(r.v)} %</td>
							<!-- Real: lo que rinde menos la inflación de ahora. Por debajo de 0, pierdes poder de compra. -->
							<td class={tone(inflation === null ? null : r.v - inflation)}>{inflation === null ? '—' : `${signed(r.v - inflation)} %`}</td>
							<td class="hide-s mut">{period(r.t)}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
			<Note>
				Cuenta y depósito: tipos medios de los depósitos nuevos de hogares en España (BCE), no la mejor oferta. €STR: lo que se prestan los bancos a un día; «Depósito en el BCE», lo que paga el BCE a los bancos. «Real» resta la inflación de ahora
				({inflation === null ? 'sin dato' : `${nf(inflation, 1)} %`}). Letras: lo que rinden en el mercado (Banco de España), no
				el resultado de la última subasta.
			</Note>
		{:else}
			<p class="empty">Sin tipos todavía.</p>
		{/if}
	</Panel>

	<Panel title="Interés compuesto">
		<div class="form">
			<label>Hoy pones <span><DecimalInput class="num" thousands bind:value={form.initial} /> €</span></label>
			<label>Cada mes <span><DecimalInput class="num" thousands bind:value={form.monthly} /> €</span></label>
			<label>Rentabilidad al año <span><DecimalInput class="num" bind:value={form.rate} /> %</span></label>
			<label>Durante <span><DecimalInput class="num" bind:value={form.years} /> años</span></label>
		</div>
		{#if growth}
			<Tiles>
				<Tile label="Tendrás" value="{nf(growth.total, 0)} €" sub={realTotal === null ? '' : `${nf(realTotal, 0)} € de hoy, con la inflación de ahora`} />
				<Tile label="Habrás puesto" value="{nf(growth.contributed, 0)} €" />
				<Tile label="Intereses" value="{nf(growth.interest, 0)} €" tone={tone(growth.interest)} />
			</Tiles>
		{/if}
		<Note>Sin impuestos ni comisiones, y con la misma rentabilidad todos los años: es una cuenta, no una promesa.</Note>
	</Panel>
</div>

<div class="grid grid-2">
	<Panel title="Lo que vale hoy tu dinero de otro año">
		{#if yearsIndex.length}
			<div class="form">
				<label>Cantidad <span><DecimalInput class="num" thousands bind:value={form.amount} /> €</span></label>
				<label>
					de
					<select bind:value={form.year}>
						{#each YEARS as y (y)}<option value={y}>{y}</option>{/each}
					</select>
				</label>
			</div>
			{#if then}
				<Tiles>
					<Tile label="Hoy serían" value="{nf(then.value, 0)} €" sub="Para comprar lo mismo que en {period(then.from.t)}" />
					<Tile label="Subida de precios" value="{nf(then.inflation, 1)} %" sub="De {period(then.from.t)} a {period(then.to.t)}" />
				</Tiles>
			{/if}
			<Note>Con el IPCA de España (INE, vía Eurostat): la inflación media, no la de tu cesta.</Note>
		{:else}
			<p class="empty">Sin el índice de precios todavía.</p>
		{/if}
	</Panel>

	<Panel title="Tu inflación (MI IPC)">
		{#if data.cesta}
			<Tiles>
				<Tile label="La general" value="{nf(inflation, 1)} %" sub="IPCA de España, {period(data.cesta.month)}" />
				<Tile label="La tuya" value={mine === null ? '—' : `${nf(mine, 1)} %`} sub="Con los pesos de tu cesta" />
			</Tiles>
			<Table>
				<thead><tr><th class="l">En qué gastas</th><th>Sube</th><th class="hide-s">Media</th><th>Tú, %</th></tr></thead>
				<tbody>
					{#each data.cesta.groups as g (g.code)}
						<tr>
							<td class="l name">{g.label}</td>
							<td class={tone(g.rate === null ? null : -g.rate)}>{g.rate === null ? '—' : `${signed(g.rate, 1)} %`}</td>
							<td class="hide-s mut">{nf(g.weight / 10, 1)} %</td>
							<td>
								<input
									class="num"
									type="text"
									inputmode="decimal"
									autocomplete="off"
									aria-label="Tu peso en {g.label}"
									placeholder={nf(g.weight / 10, 1)}
									value={showDecimal(basket[g.code])}
									onchange={(e) => setWeight(g.code, e.currentTarget.value)}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</Table>
			<Note>
				Pon qué parte de tu gasto va a cada grupo (si no suman 100, se reparte en proporción); lo que dejes vacío lleva el peso
				medio de España ({data.cesta.weightsYear}). Si gastas más en lo que más sube, tu inflación es mayor que la general.
			</Note>
		{:else}
			<p class="empty">Sin el IPCA por grupos todavía.</p>
		{/if}
	</Panel>
</div>

<style>
	.form {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8) var(--sp-12);
		padding: var(--sp-12) var(--pad-x);
	}

	label {
		display: grid;
		gap: var(--sp-4);
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	label span {
		color: var(--fg);
		font-size: var(--fs-m);
	}

	/* Los campos de cifras son de DecimalInput (otro componente): :global para que les lleguen estos estilos. */
	label :global(input.num),
	td input.num,
	select {
		height: var(--control-h);
		padding: 0 var(--sp-6);
		background: var(--raise);
		border: var(--border);
		color: inherit;
		font: inherit;
	}

	label :global(input.num) {
		width: 10ch;
		text-align: right;
	}

	td input.num {
		width: 8ch;
		text-align: right;
	}

	label :global(input.num:focus),
	td input.num:focus,
	select:focus {
		outline: none;
		border-color: var(--amber);
	}

	@media (max-width: 720px) {
		.hide-s {
			display: none;
		}
	}
</style>
