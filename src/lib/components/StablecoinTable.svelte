<!--
	Stablecoins (DefiLlama): cuánto dinero hay en monedas ligadas al dólar y cuáles son las grandes.
	Arriba, el total y su variación; debajo, cada una con lo que circula, cómo ha cambiado y su precio.
	Un precio a medio céntimo o más de 1 $ sale en ámbar: la moneda se ha despegado del dólar.
-->
<script lang="ts">
	import { compact, nf, period, signed } from '#lib/format.ts';
	import { offPeg, type StablecoinsData } from '#lib/stablecoins.ts';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';
	import Tile from './ui/Tile.svelte';
	import Tiles from './ui/Tiles.svelte';

	let { data }: { data: StablecoinsData | undefined } = $props();

	const tone = (v: number | null) => (v === null ? 'mut' : v > 0 ? 'up' : v < 0 ? 'down' : undefined);

	/** Cómo se respalda cada una, en corto. */
	const BACKING: Record<string, string> = { 'fiat-backed': 'dinero', 'crypto-backed': 'cripto', algorithmic: 'algoritmo' };
</script>

{#if data?.coins.length}
	<Tiles cols={3}>
		<Tile label="Total" value="{compact(data.total)} $" sub={period(data.date)} />
		<Tile label="En 30 días" value="{signed(data.totalMonth, 1)} %" tone={tone(data.totalMonth)} sub="Variación del total" />
		<Tile label="En un año" value="{signed(data.totalYear, 1)} %" tone={tone(data.totalYear)} sub="Variación del total" />
	</Tiles>
	<Table>
		<thead>
			<tr><th>Moneda</th><th>Circula</th><th>7 d</th><th>30 d</th><th>Precio</th></tr>
		</thead>
		<tbody>
			{#each data.coins as c (c.id)}
				<tr>
					<td><span class="sym">{c.symbol}</span><span class="sub">{c.name} · {BACKING[c.mechanism] ?? c.mechanism}</span></td>
					<td>{compact(c.usd)}</td>
					<td><Change value={c.week} digits={1} unit=" %" /></td>
					<td><Change value={c.month} digits={1} unit=" %" /></td>
					<td class:off={offPeg(c.price)} class:mut={!offPeg(c.price)}>{c.price === null ? '—' : nf(c.price, 4)}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	.sym {
		display: inline-block;
		min-width: 5ch;
		color: var(--amber);
		font-weight: var(--fw-medium);
	}

	.off {
		color: var(--amber);
	}
</style>
