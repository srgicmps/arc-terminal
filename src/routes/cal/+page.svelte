<script lang="ts">
	import { resolve } from '$app/paths';
	import { clock } from '#lib/clock.svelte.ts';
	import MeetingList from '#lib/components/MeetingList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { compact, dm, hm, nf, weekday } from '#lib/format.ts';
	import { bmeHolidays, nyseHolidays } from '#lib/markets.ts';
	import { madridDate } from '#lib/meetings.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const calendar = {
		importanceFilter: '0,1',
		countryFilter: 'us,eu,es,de,fr,it,gb,cn,jp'
	};

	const earnings = $derived(data.finnhub?.data.earnings ?? []);

	const HOUR: Record<string, string> = { bmo: 'Pre', amc: 'Post', dmh: 'Sesión' };

	// Festivos de los próximos 12 meses: España y Baleares (Nager.Date) y días sin bolsa (por reglas).
	// Fecha de hoy en Madrid. Hasta que arranca el reloj en el navegador se usa la fecha en la que se
	// construyó la página.
	const today = $derived(madridDate(clock.now || Date.now()));

	// Próximos datos de los calendarios oficiales (con tema), desde hoy en hora de Madrid.
	const releases = $derived(
		(data.releases?.data.events ?? []).filter((e) => e.topic && madridDate(Date.parse(e.date)) >= today).slice(0, 14)
	);
	const days = $derived.by(() => {
		const year = Number(today.slice(0, 4));
		const limit = `${year + 1}${today.slice(4)}`;
		const all = [
			...(data.holidays?.data.items ?? []).map((h) => ({ date: h.date, name: h.name, tag: h.scope })),
			...[year, year + 1].flatMap((y) => [...nyseHolidays(y), ...bmeHolidays(y)]).map((h) => ({ ...h, tag: h.market }))
		].filter((h) => h.date >= today && h.date < limit);
		// Un día por fila: si coinciden varios, se juntan las etiquetas y los nombres distintos.
		const byDate = new Map<string, { date: string; names: string[]; tags: string[] }>();
		for (const h of all.sort((a, b) => a.date.localeCompare(b.date))) {
			const row = byDate.get(h.date) ?? { date: h.date, names: [], tags: [] };
			if (!row.names.includes(h.name)) row.names.push(h.name);
			if (!row.tags.includes(h.tag)) row.tags.push(h.tag);
			byDate.set(h.date, row);
		}
		return [...byDate.values()];
	});
	// El próximo festivo de España o Baleares (los días sin bolsa no cuentan).
	const next = $derived(days.find((d) => d.tags.includes('ES') || d.tags.includes('IB')));
	const inDays = (date: string) => Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
</script>

<ViewHeader
	code="CAL"
	title="Agenda económica"
	sub="Datos macro de la semana (TradingView) y resultados empresariales (Finnhub)"
/>

<div class="grid grid-2">
	<div class="col">
		<Panel title="Calendario" meta="Importancia media y alta · hora local">
			<TvWidget widget="events" config={calendar} height={720} />
		</Panel>
	</div>
	<div class="col">
		<Panel title="Bancos centrales" meta="Próximas reuniones · BCE y Fed">
			<MeetingList mode="list" limit={6} />
			{#snippet note()}Decisión de tipos, en hora de España. Fuentes: calendarios oficiales del BCE y de la Fed.{/snippet}
		</Panel>
		<Panel title="Próximos datos" meta="Calendarios oficiales · hora de España">
			{#if releases.length}
				<Table>
					<thead><tr><th>Día</th><th>Hora</th><th class="l">Dato</th><th class="l">Fuente</th></tr></thead>
					<tbody>
						{#each releases as e (e.source + e.date + e.title)}
							<tr>
								<td class="mut">{weekday(madridDate(Date.parse(e.date)))} {dm(e.date).split(' ')[1]}</td>
								<td class="mut">{e.allDay ? '—' : hm(e.date)}</td>
								<td class="l name wrap"
									>{#if e.url}<a href={e.url} target="_blank" rel="noopener">{e.title}</a>{:else}{e.title}{/if}</td
								>
								<td class="l mut">{e.source}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">
					{data.releases
						? 'Sin publicaciones de los datos que sigue la terminal en las próximas semanas.'
						: 'Sin datos todavía.'}
				</p>
			{/if}
			{#snippet note()}
				IPC y empleo de EE. UU. (BLS, fechas vía FRED) e IPC, EPA, vivienda y turistas del INE.
				{#if data.releases}<Updated at={data.releases.fetchedAt} source="releases-cal" />{/if}
			{/snippet}
		</Panel>
		<Panel title="Festivos" meta="Próximos 12 meses">
			{#if next}
				<ul class="mini">
					<li>
						<span class="l">Próximo festivo<small>{next.names.join(' · ')}</small></span>
						<b>{dm(`${next.date}T12:00:00Z`)} · {inDays(next.date) === 0 ? 'hoy' : `en ${inDays(next.date)} días`}</b>
					</li>
				</ul>
			{/if}
			{#if days.length}
				<Table>
					<thead>
						<tr><th>Día</th><th class="l">Festivo</th><th class="l">Dónde</th></tr>
					</thead>
					<tbody>
						{#each days as d (d.date)}
							<tr>
								<td class="mut">{weekday(d.date)} {dm(`${d.date}T12:00:00Z`).split(' ')[1]}</td>
								<td class="l name wrap">{d.names.join(' · ')}</td>
								<td class="l mut">{d.tags.join(' ')}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{/if}
			{#snippet note()}
				ES: festivo en toda España · IB: en Baleares · NYSE y BME: sin bolsa en Nueva York o en Madrid. Festivos:
				Nager.Date{#if data.holidays}&nbsp;· <Updated at={data.holidays.fetchedAt} />{/if}. Días sin bolsa calculados
				con las reglas de la NYSE y del calendario TARGET2 (BME). Los festivos locales de cada municipio no están
				incluidos.
			{/snippet}
		</Panel>
		<Panel title="Resultados" meta="Grandes empresas de EE. UU. · próximas 2 semanas">
			{#if !data.finnhub}
				<p class="empty">Falta la clave FINNHUB_API_KEY en GitHub Secrets.</p>
			{:else if earnings.length}
				<Table>
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
								<td class="l"
									><a class="sym" href="{resolve('/s')}?sym={encodeURIComponent(e.symbol)}">{e.symbol}</a></td
								>
								<td class="mut h">{HOUR[e.hour] ?? ''}</td>
								<td>{nf(e.epsEstimate)}</td>
								<td>
									<Change
										value={e.epsActual !== null && e.epsEstimate !== null ? e.epsActual - e.epsEstimate : null}
										text={nf(e.epsActual)}
									/>
								</td>
								<td class="mut rev">{e.revenueEstimate ? compact(e.revenueEstimate) : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
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
	/* Los nombres largos pasan a otra línea para que quepa la columna «Dónde» en el móvil. */
	/* Los nombres de los festivos pueden ocupar varias líneas. */
	.wrap {
		white-space: normal;
	}

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
