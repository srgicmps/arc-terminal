<script lang="ts">
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { compact, nf, trend, weekday } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const calendar = {
		importanceFilter: '0,1',
		countryFilter: 'us,eu,es,de,fr,it,gb,cn,jp'
	};

	const earnings = $derived(data.finnhub?.data.earnings ?? []);
	const HOUR: Record<string, string> = { bmo: 'Pre', amc: 'Post', dmh: 'Sesión' };
</script>

<ViewHeader code="CAL" title="Agenda económica" sub="Datos macro de la semana (TradingView) y resultados empresariales (Finnhub)" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Calendario" meta="Importancia media y alta · hora local">
			<TvWidget widget="events" config={calendar} height={720} />
		</Panel>
	</div>
	<div class="col">
		<Panel title="Resultados" meta="Grandes empresas de EE. UU. · próximas 2 semanas">
			{#if !data.finnhub}
				<p class="empty">Falta la clave FINNHUB_API_KEY en GitHub Secrets.</p>
			{:else if earnings.length}
				<div class="scroll">
					<table class="t">
						<thead>
							<tr>
								<th>Día</th>
								<th class="l">Valor</th>
								<th class="h">Hora</th>
								<th>BPA prev.</th>
								<th>BPA real</th>
								<th class="rev">Ventas prev.</th>
							</tr>
						</thead>
						<tbody>
							{#each earnings as e, i (e.symbol + e.date)}
								<tr>
									<td class="mut">{i === 0 || earnings[i - 1].date !== e.date ? weekday(e.date) : ''}</td>
									<td class="l"><a class="sym" href="{resolve('/s')}?sym={encodeURIComponent(e.symbol)}">{e.symbol}</a></td>
									<td class="mut h">{HOUR[e.hour] ?? ''}</td>
									<td>{nf(e.epsEstimate)}</td>
									<td class={e.epsActual !== null && e.epsEstimate !== null ? trend(e.epsActual - e.epsEstimate) : 'mut'}>
										{nf(e.epsActual)}
									</td>
									<td class="mut rev">{e.revenueEstimate ? compact(e.revenueEstimate) : '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="empty">No hay resultados de grandes empresas en estas fechas.</p>
			{/if}
			{#snippet note()}
				BPA: beneficio por acción, en $. Pre: antes de la apertura · Post: tras el cierre. Fuente: Finnhub
				{#if data.finnhub}· <Updated at={data.finnhub.fetchedAt} source="finnhub" />{/if}
			{/snippet}
		</Panel>
	</div>
</div>

<style>
	a.sym {
		color: inherit;
		text-decoration: none;
	}

	a.sym:hover {
		color: var(--amber);
	}

	@container (max-width: 440px) {
		.rev {
			display: none;
		}
	}

	@container (max-width: 340px) {
		.h {
			display: none;
		}
	}
</style>
