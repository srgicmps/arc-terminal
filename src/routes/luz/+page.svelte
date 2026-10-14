<script lang="ts">
	import EuPowerTable from '#lib/components/EuPowerTable.svelte';
	import { vsAverage } from '#lib/eupower.ts';
	import { clock } from '#lib/clock.svelte.ts';
	import LineChart from '#lib/components/LineChart.svelte';
	import MixBar from '#lib/components/MixBar.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import PriceBars from '#lib/components/PriceBars.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { dm, hm, longDay, nf, signed } from '#lib/format.ts';
	import { cheapestWindow, days, dayStats, hourLabel, hourly, isHour, madridNow } from '#lib/power.ts';
	import { luzShare, relativeDay, type ShareInfo } from '#lib/share.ts';
	import Tile from '#lib/components/ui/Tile.svelte';
	import Tiles from '#lib/components/ui/Tiles.svelte';
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
			const stats = dayStats(prices);
			// La franja de 2 y de 3 horas seguidas más barata, para la lavadora o el lavavajillas, y cuánto más
			// barata es que la media del día.
			const windows = [2, 3].flatMap((n) => {
				const w = cheapestWindow(prices, day, n);
				return w ? [{ n, w, saving: stats.avg ? ((stats.avg - w.avg) / stats.avg) * 100 : 0 }] : [];
			});
			return { day, prices, kind: fromPvpc.length ? 'PVPC' : 'Mayorista', stats, windows };
		})
	);

	const history = $derived(data.power?.data.history ?? []);
	// Demanda eléctrica: las dos últimas horas, real frente a prevista (REE, cada 5 minutos).
	const demandLines = $derived.by(() => {
		const recent = data.demand?.data.recent ?? [];
		const pick = (k: 'real' | 'forecast') =>
			recent.flatMap((p) => (p[k] === null ? [] : [{ t: p.time, v: p[k] as number }]));
		return [
			{ label: 'Real', color: '--amber', points: pick('real') },
			{ label: 'Prevista', color: '--muted', points: pick('forecast') }
		].filter((l) => l.points.length);
	});

	const historyLines = $derived([
		{ label: 'Media', points: history.map((d) => ({ t: d.date, v: d.avg })) },
		{ label: 'Mínimo', color: '--up', points: history.map((d) => ({ t: d.date, v: d.min })) },
		{ label: 'Máximo', color: '--down', points: history.map((d) => ({ t: d.date, v: d.max })) }
	]);

	// «Compartir» de un día: media y hora más barata. «hoy» o «mañana» según la fecha de Madrid al pulsar.
	function share(b: (typeof blocks)[number]): () => ShareInfo {
		return () => {
			const when = relativeDay(b.day, madridNow(Date.now()).day, longDay(`${b.day}T12:00:00Z`));
			const { min, avg, cheap } = b.stats;
			if (!min) return { title: `Precio de la luz ${when}` };
			return luzShare({ when, kind: b.kind, avg, cheapHour: min.hour, cheapKwh: min.kwh, cheapest: cheap.map((p) => p.hour) });
		};
	}

	const currentPrice = $derived(
		now ? blocks.find((b) => b.day === now.day)?.prices.find((p) => isHour(p, now)) : undefined
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
			<Panel title={longDay(`${b.day}T12:00:00Z`)} meta="{b.kind} · €/kWh" share={share(b)}>
				{#if b.stats.min && b.stats.max}
					<Tiles>
						<Tile label="Media" value={nf(b.stats.avg, 3)} />
						<Tile label="Mínimo" value={nf(b.stats.min.kwh, 3)} tone="up" sub="a las {hourLabel(b.stats.min)}" />
						<Tile label="Máximo" value={nf(b.stats.max.kwh, 3)} tone="down" sub="a las {hourLabel(b.stats.max)}" />
					</Tiles>
				{/if}
				<PriceBars prices={b.prices} current={now} />
				<ul class="mini">
					<li>
						<span class="l">Horas más baratas</span>
						<b>{b.stats.cheap.map(hourLabel).join(' · ')}</b>
					</li>
					{#each b.windows as { n, w, saving } (n)}
						<li>
							<span class="l">Mejor franja de {n} h</span>
							<span title="Precio medio de la franja y cuánto más barata es que la media del día"
								><b>{hourLabel(w.first)}–{hourLabel(w.after)}</b> <span class="mut">{nf(w.avg, 3)} · −{nf(saving, 0)} %</span></span
							>
						</li>
					{/each}
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
				{#snippet note()}Fuente: Red Eléctrica · <Updated at={data.mix?.fetchedAt} source="power-mix" />{/snippet}
			</Panel>
		</div>
	</div>
{/if}

{#if data.demand}
	{@const d = data.demand.data}
	<div class="grid">
		<div class="col">
			<Panel title="Demanda eléctrica" meta="España · real frente a prevista · {hm(d.time)}">
				<Tiles>
					<Tile label="Real" value="{nf(d.real, 0)} MW" />
					<Tile label="Prevista" value={d.forecast === null ? '—' : `${nf(d.forecast, 0)} MW`} tone={d.forecast === null ? 'mut' : undefined} />
					<Tile
						label="Desvío"
						value={d.gap === null ? '—' : `${signed(-d.gap, 1)} %`}
						tone={d.gap === null ? 'mut' : undefined}
						sub={d.gap === null ? undefined : d.gap > 0 ? 'por debajo de la prevista' : 'por encima de la prevista'}
					/>
				</Tiles>
				{#if demandLines.length}<LineChart lines={demandLines} decimals={0} unit=" MW" height={160} />{/if}
				{#snippet note()}
					Últimas dos horas, cada 5 minutos. Una caída brusca de la real frente a la prevista puede ser un apagón.
					Fuente: Red Eléctrica · <Updated at={data.demand?.fetchedAt} source="ree-demand" />
				{/snippet}
			</Panel>
		</div>
	</div>
{/if}

{#if data.eupower?.data.zones.length}
	{@const es = vsAverage(data.eupower.data.zones, 'ES', 'today')}
	<div class="grid">
		<div class="col">
			<Panel
				title="Luz en Europa"
				meta={es ? `España, ${nf(Math.abs(es.pct), 0)} % ${es.pct < 0 ? 'más barata' : 'más cara'} que la media` : 'Mercado mayorista · €/MWh'}
			>
				<EuPowerTable zones={data.eupower.data.zones} />
				{#snippet note()}
					Media diaria del mercado mayorista, en €/MWh (sin peajes ni impuestos). Fuentes: Energy-Charts / SMARD
					(Bundesnetzagentur), CC BY 4.0; España, Red Eléctrica · <Updated at={data.eupower?.fetchedAt} source="energycharts" />
				{/snippet}
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
		font-weight: var(--fw-medium);
	}

</style>
