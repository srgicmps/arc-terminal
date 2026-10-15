<!--
	CARTERA (F8): tus posiciones, lo que valen hoy en euros, lo que ganas o pierdes y el reparto por sector y divisa.
	Las posiciones se guardan en tu navegador (arc-portfolio) y, con cuenta, en tus ajustes privados (D1).
	Precios: Finnhub para los valores de EE. UU. que descarga Arc; el resto, el precio que pongas tú.
-->
<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Bar from '#lib/components/ui/Bar.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import Tile from '#lib/components/ui/Tile.svelte';
	import Tiles from '#lib/components/ui/Tiles.svelte';
	import { resolve } from '$app/paths';
	import { clock } from '#lib/clock.svelte.ts';
	import { nf, signed, when } from '#lib/format.ts';
	import { madridDate } from '#lib/meetings.ts';
	import { earningsLine, myEarnings } from '#lib/myearnings.ts';
	import { fxRates } from '#lib/fx.ts';
	import { cleanPosition, MAX_POSITIONS, parsePortfolio, PORTFOLIO_KEY, summarize, type Position } from '#lib/portfolio.ts';

	let { data } = $props();

	let positions = $state<Position[]>([]);
	let loaded = $state(false);

	// Como un onMounted de Vue: lee lo guardado en este navegador (los ajustes de tu cuenta ya están aquí).
	$effect(() => {
		try {
			positions = parsePortfolio(localStorage.getItem(PORTFOLIO_KEY));
		} catch {}
		loaded = true;
	});

	// Y guarda cada cambio (como un watch profundo).
	$effect(() => {
		const value = JSON.stringify(positions);
		if (!loaded) return;
		try {
			localStorage.setItem(PORTFOLIO_KEY, value);
		} catch {}
	});

	const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'DKK', 'SEK', 'NOK'];
	let draft = $state({ sym: '', qty: '', cost: '', cur: 'USD', price: '', sector: '' });
	let error = $state('');

	const toNum = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : NaN);

	function add(e: SubmitEvent) {
		e.preventDefault();
		const p = cleanPosition({
			sym: draft.sym,
			qty: toNum(draft.qty),
			cost: toNum(draft.cost),
			cur: draft.cur,
			price: draft.price ? toNum(draft.price) : undefined,
			sector: draft.sector
		});
		if (!p) return void (error = 'Revisa el código, la cantidad y el precio de compra.');
		if (positions.length >= MAX_POSITIONS) return void (error = `Como mucho ${MAX_POSITIONS} posiciones.`);
		positions = [...positions, p];
		draft = { sym: '', qty: '', cost: '', cur: draft.cur, price: '', sector: '' };
		error = '';
	}

	const remove = (i: number) => (positions = positions.filter((_, j) => j !== i));

	function setPrice(i: number, raw: string) {
		const v = toNum(raw);
		const p = { ...positions[i] };
		if (v > 0) p.price = v;
		else delete p.price;
		positions = positions.map((x, j) => (j === i ? p : x));
	}

	const rates = $derived(fxRates(data.fx));
	const s = $derived(summarize(positions, data.quotes, rates));
	const today = $derived(madridDate(clock.now || Date.now()));
	const upcoming = $derived(myEarnings(data.earnings, positions.map((p) => p.sym), today));
	const tone = (v: number | null) => (v === null ? 'mut' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
</script>

<ViewHeader code="CARTERA" title="Tu cartera" sub="Lo que tienes, lo que vale hoy en euros y lo que ganas o pierdes" />

{#if positions.length}
	<div class="grid">
		<Panel title="Resumen">
			<Tiles>
				<Tile label="Vale hoy" value="{nf(s.value, 0)} €" sub="{s.rows.length - s.missing.length} de {s.rows.length} posiciones con precio" />
				<Tile label="Invertido" value="{nf(s.invested, 0)} €" />
				<Tile label="Ganancia" value="{signed(s.gain, 0)} €" tone={tone(s.gain)} sub={s.gainPct === null ? '' : `${signed(s.gainPct, 1)} %`} />
			</Tiles>
		</Panel>
	</div>
{/if}

<div class="grid">
	<Panel title="Posiciones">
		{#if positions.length}
			<Table>
				<thead>
					<tr><th class="l">Valor</th><th>Cant.</th><th>Precio</th><th class="hide-s">Hoy</th><th>Ganancia</th><th class="hide-s">Peso</th><th></th></tr>
				</thead>
				<tbody>
					{#each s.rows as r, i (i)}
						<tr>
							<td class="l name">{r.sym}<span class="sub">{r.cur}{r.sector ? ` · ${r.sector}` : ''}</span></td>
							<td>{nf(r.qty, r.qty % 1 ? 2 : 0)}</td>
							<td>
								{#if r.source === 'finnhub'}
									{nf(r.now)}<span class="sub">Finnhub</span>
								{:else}
									<input
										type="number"
										inputmode="decimal"
										min="0"
										step="any"
										aria-label="Precio de {r.sym} a mano"
										placeholder="a mano"
										value={r.price ?? ''}
										onchange={(e) => setPrice(i, e.currentTarget.value)}
									/>
								{/if}
							</td>
							<td class="hide-s"><Change value={r.changePct} unit=" %" /></td>
							<td class={tone(r.gain)}>{r.gain === null ? '—' : `${signed(r.gain, 0)} €`}<span class="sub">{r.gainPct === null ? '' : `${signed(r.gainPct, 1)} %`}</span></td>
							<td class="hide-s mut">{r.weight === null ? '—' : `${nf(r.weight, 0)} %`}</td>
							<td><button class="x" aria-label="Quitar {r.sym}" onclick={() => remove(i)}>×</button></td>
						</tr>
					{/each}
				</tbody>
			</Table>
			{#if s.missing.length}
				<Note>Sin precio: {s.missing.join(', ')}. Escríbelo a mano y cuenta en el total.</Note>
			{/if}
		{:else}
			<p class="empty">Aún no tienes posiciones. Añade la primera abajo.</p>
		{/if}

		<form onsubmit={add}>
			<label>Código <input bind:value={draft.sym} placeholder="NVDA" autocapitalize="characters" maxlength="20" required /></label>
			<label>Cantidad <input bind:value={draft.qty} inputmode="decimal" placeholder="10" required /></label>
			<label>Precio de compra <input bind:value={draft.cost} inputmode="decimal" placeholder="120,50" required /></label>
			<label>
				Divisa
				<select bind:value={draft.cur}>
					{#each CURRENCIES as c (c)}<option>{c}</option>{/each}
				</select>
			</label>
			<label>Sector <input bind:value={draft.sector} placeholder="opcional" maxlength="40" /></label>
			<button type="submit">Añadir</button>
		</form>
		{#if error}<p class="err">{error}</p>{/if}
		<Note>
			Precios: Finnhub (con retraso) solo para los valores de EE. UU. que descarga Arc{data.quotesAt ? `, ${when(data.quotesAt, Date.now())}` : ''}.
			Para el resto (bolsas europeas, fondos…) no hay precio gratis: escríbelo a mano. Se pasa a euros con el cambio del BCE.
			Tus posiciones se guardan solo en tu navegador y, con cuenta, en tus ajustes privados.
		</Note>
	</Panel>
</div>

{#if positions.length}
	<div class="grid">
		<Panel title="Resultados de tus valores">
			{#if upcoming.length}
				<ul class="mini">
					{#each upcoming as e (e.symbol + e.date)}
						<li><a class="l" href="{resolve('/s')}?sym={encodeURIComponent(e.code)}">{earningsLine(e, today)}</a></li>
					{/each}
				</ul>
			{:else}
				<p class="empty">Ninguno de tus valores presenta resultados en las próximas 2 semanas.</p>
			{/if}
			<Note>Grandes empresas de EE. UU. (Finnhub). Para que te avise el móvil la víspera, añade tus valores en <a href={resolve('/avisos')}>AVISOS</a>.</Note>
		</Panel>
	</div>
{/if}

{#if s.value > 0}
	<div class="grid grid-2">
		<Panel title="Reparto por sector">
			<ul class="mini split">
				{#each s.bySector as g (g.name)}
					<li><span>{g.name}</span><Bar pct={g.pct} /><span class="num">{nf(g.pct, 0)} %</span></li>
				{/each}
			</ul>
		</Panel>
		<Panel title="Reparto por divisa">
			<ul class="mini split">
				{#each s.byCurrency as g (g.name)}
					<li><span>{g.name}</span><Bar pct={g.pct} /><span class="num">{nf(g.pct, 0)} %</span></li>
				{/each}
			</ul>
		</Panel>
	</div>
{/if}

<style>
	input,
	select,
	button {
		height: var(--control-h);
		padding: 0 var(--sp-6);
		background: var(--raise);
		border: var(--border);
		color: inherit;
		font: inherit;
	}

	input:focus,
	select:focus {
		outline: none;
		border-color: var(--amber);
	}

	td input {
		width: 10ch;
		text-align: right;
	}

	.sub {
		display: block;
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.x {
		padding: 0 var(--sp-8);
		border-color: transparent;
		background: none;
		color: var(--muted);
		cursor: pointer;
	}

	.x:hover {
		color: var(--down);
	}

	form {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
		align-items: end;
		padding: var(--sp-12) var(--pad-x) 0;
	}

	label {
		display: grid;
		gap: var(--sp-4);
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	label input {
		width: 12ch;
	}

	button[type='submit'] {
		color: var(--amber);
		cursor: pointer;
	}

	.err {
		margin: var(--sp-8) var(--pad-x) 0;
		color: var(--down);
	}

	.split li {
		display: grid;
		grid-template-columns: 10ch 1fr 5ch;
		gap: var(--sp-8);
		align-items: center;
	}

	.num {
		text-align: right;
	}

	@media (max-width: 720px) {
		.hide-s {
			display: none;
		}
	}
</style>
