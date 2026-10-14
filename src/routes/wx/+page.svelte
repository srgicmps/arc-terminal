<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { nf, weekday } from '#lib/format.ts';
	import { compass, sky } from '#lib/weather.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const places = $derived(data.weather?.data.places ?? []);
</script>

<ViewHeader code="WX" title="El tiempo" sub="Menorca, Madrid, Barcelona y Nueva York · Open-Meteo" />

{#if !places.length}<p class="empty">Sin datos todavía.</p>{/if}

<div class="grid grid-2e">
	{#each places as p (p.name)}
		{@const now = sky(p.current.code)}
		<div class="col">
			<Panel title={p.name} meta={now.label}>
				<div class="now">
					<span class="icon" aria-hidden="true">{now.icon}</span>
					<b>{nf(p.current.temp, 0)}°</b>
					<ul>
						<li>Viento <span>{nf(p.current.wind, 0)} km/h {compass(p.current.windDir)}</span></li>
						<li>Humedad <span>{nf(p.current.humidity, 0)} %</span></li>
						{#if p.sea !== null}<li>Agua del mar <span>{nf(p.sea, 1)}°</span></li>{/if}
					</ul>
				</div>
				<div class="scroll">
					<table class="t">
						<thead><tr><th>Día</th><th class="l">Cielo</th><th>Máx.</th><th>Mín.</th><th>Lluvia</th><th>Viento</th></tr></thead>
						<tbody>
							{#each p.daily as d (d.date)}
								{@const s = sky(d.code)}
								<tr>
									<td>{weekday(d.date)}</td>
									<td class="l"><span class="i" aria-hidden="true">{s.icon}</span> {s.label}</td>
									<td>{nf(d.max, 0)}°</td>
									<td class="mut">{nf(d.min, 0)}°</td>
									<td class:rain={d.rain >= 50}>{nf(d.rain, 0)} %</td>
									<td class="mut">{nf(d.wind, 0)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Panel>
		</div>
	{/each}
</div>
<p class="foot">Fuente: Open-Meteo (CC BY 4.0) · <Updated at={data.weather?.fetchedAt} /></p>

<style>
	.now {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px;
		border-bottom: 1px solid var(--line);
	}

	.icon {
		color: var(--amber);
		font-size: 26px;
		line-height: 1;
	}

	.now b {
		font-size: var(--fs-xxl);
		font-weight: 500;
	}

	.now ul {
		list-style: none;
		margin: 0 0 0 auto;
		padding: 0;
		color: var(--muted);
		font-size: var(--fs-s);
		text-align: right;
	}

	.now li span {
		color: var(--fg);
	}

	.i {
		color: var(--amber);
	}

	.rain {
		color: var(--amber);
	}

	.foot {
		margin: 8px 0 0;
		color: var(--faint);
		font-size: var(--fs-xs);
	}
</style>
