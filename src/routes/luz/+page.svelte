<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import LineChart from '#lib/components/LineChart.svelte';
	import MixBar from '#lib/components/MixBar.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import PriceBars from '#lib/components/PriceBars.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { dm, longDay, nf } from '#lib/format.ts';
	import { days, hourly, madridNow, type HourPrice } from '#lib/power.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const pvpc = $derived(hourly(data.power?.data.pvpc ?? []));
	const spot = $derived(hourly(data.power?.data.spot ?? []));
	const now = $derived(clock.now ? madridNow(clock.now) : null);

	// Un bloque por día: PVPC si lo hay; si no (mañana, antes de las 20:30), el mayorista.
	const blocks = $derived(
		days([...pvpc, ...spot]).map((day) => {
			const fromPvpc = pvpc.filter((p) => p.day === day);
			const prices = fromPvpc.length ? fromPvpc : spot.filter((p) => p.day === day);
			return { day, prices, kind: fromPvpc.length ? 'PVPC' : 'Mayorista', stats: stats(prices) };
		})
	);

	function stats(prices: HourPrice[]) {
		const sorted = [...prices].sort((a, b) => a.kwh - b.kwh);
		const avg = prices.reduce((a, p) => a + p.kwh, 0) / (prices.length || 1);
		return { min: sorted[0], max: sorted.at(-1), avg, cheap: sorted.slice(0, 3) };
	}

	const history = $derived(data.power?.data.history ?? []);
	const historyLines = $derived([
		{ label: 'Media', points: history.map((d) => ({ t: d.date, v: d.avg })) },
		{ label: 'Mínimo', color: '--up', points: history.map((d) => ({ t: d.date, v: d.min })) },
		{ label: 'Máximo', color: '--down', points: history.map((d) => ({ t: d.date, v: d.max })) }
	]);

	const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
	const currentPrice = $derived(
		now ? blocks.find((b) => b.day === now.day)?.prices.find((p) => p.hour === now.hour) : undefined
	);
</script>

<ViewHeader code="LUZ" title="Precio de la luz" sub="PVPC (tarifa regulada) y mercado mayorista · Red Eléctrica">
	{#snippet aside()}
		{#if currentPrice}Ahora: <b class="now">{nf(currentPrice.kwh, 3)} €/kWh</b>{/if}
	{/snippet}
</ViewHeader>

{#if !blocks.length}
	<p class="empty">Sin datos todavía.</p>
{/if}

<div class="grid" class:grid-2e={blocks.length > 1}>
	{#each blocks as b (b.day)}
		<div class="col">
			<Panel title={longDay(`${b.day}T12:00:00Z`)} meta="{b.kind} · €/kWh">
				{#if b.stats.min && b.stats.max}
					<div class="tiles">
						<div class="tile"><span class="lbl">Media</span><b>{nf(b.stats.avg, 3)}</b></div>
						<div class="tile">
							<span class="lbl">Mínimo</span><b class="up">{nf(b.stats.min.kwh, 3)}</b>
							<span class="sub">a las {hh(b.stats.min.hour)}</span>
						</div>
						<div class="tile">
							<span class="lbl">Máximo</span><b class="down">{nf(b.stats.max.kwh, 3)}</b>
							<span class="sub">a las {hh(b.stats.max.hour)}</span>
						</div>
					</div>
				{/if}
				<PriceBars prices={b.prices} current={now?.day === b.day ? now.hour : -1} />
				<ul class="mini">
					<li>
						<span class="l">Horas más baratas</span>
						<b>{b.stats.cheap.map((p) => hh(p.hour)).join(' · ')}</b>
					</li>
				</ul>
				{#snippet note()}
					{#if b.kind === 'Mayorista'}
						El PVPC de este día aún no está publicado (sale hacia las 20:30): se muestra el precio del
						mercado mayorista, sin peajes ni cargos.
					{:else}
						Precio del término de energía del PVPC, con peajes y cargos, sin impuestos.
					{/if}
					Fuente: Red Eléctrica · <Updated at={data.power?.fetchedAt} source="power" />
				{/snippet}
			</Panel>
		</div>
	{/each}
</div>

{#if data.mix?.data.systems.length}
	<div class="grid">
		<div class="col">
			<Panel title="De dónde sale la luz" meta="Mix de generación · {dm(`${data.mix.data.systems[0].date}T12:00:00Z`)}">
				{#each data.mix.data.systems as mix (mix.id)}
					<MixBar {mix} />
				{/each}
				{#snippet note()}Fuente: Red Eléctrica · <Updated at={data.mix?.fetchedAt} />{/snippet}
			</Panel>
		</div>
	</div>
{/if}

<div class="grid">
	<div class="col">
		<Panel title="Evolución del PVPC" meta="Por días · €/kWh">
			<LineChart lines={historyLines} decimals={3} />
		</Panel>
	</div>
</div>

<style>
	.now {
		color: var(--amber);
		font-weight: 500;
	}

</style>
