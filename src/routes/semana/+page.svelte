<!--
	SEMANA: lo más importante de los últimos 7 días (IMP), cómo se han movido los mercados, los datos macro
	publicados y la agenda de los 7 siguientes. El resumen llega hecho de +page.server.ts (weekSummary()).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { dm, hm, nf } from '#lib/format.ts';
	import type { ReleaseEvent } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const s = $derived(data.summary);
	const sources = $derived([...new Set(s.markets.map((m) => m.source))].join(', '));
	/** «14 oct · 08:30», o solo el día si el organismo no da la hora. */
	const when = (e: ReleaseEvent) => (e.allDay ? dm(e.date) : `${dm(e.date)} · ${hm(e.date)}`);
</script>

<ViewHeader code="SEMANA" title="La semana" sub="Los últimos 7 días y lo que viene en los 7 siguientes" />

<div class="grid grid-2e">
	<div class="col">
		<Panel title="Lo más importante" meta="7 días · top {s.top.length}" jump={{ code: 'IMP', href: resolve('/imp') }}>
			{#if s.top.length}
				<ol class="mini">
					{#each s.top as t (t.k)}
						<!-- El original en inglés, con su voz en el lector de pantalla; la línea de abajo sigue en español. -->
						{@const en = t.titleEs ? undefined : t.lang}
						<li>
							<a class="l" href={t.url} target="_blank" rel="noopener" lang={en}
								>{t.titleEs ?? t.title}<small lang={en ? 'es' : undefined}
									>{t.days} {t.days === 1 ? 'día' : 'días'} · {t.sources.length} {t.sources.length === 1 ? 'medio' : 'medios'}</small
								></a
							>
							<b>{nf(t.score, 0)}</b>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="empty">Sin datos todavía.</p>
			{/if}
			{#snippet note()}Puntuación de IMP sumada día a día · <Updated at={data.impAt} source="imp" />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Mercados" meta="Variación en 7 días">
			{#if s.markets.length}
				<Table>
					<thead>
						<tr><th>Mercado</th><th>Último</th><th>7 días</th><th class="mut per">Fecha</th></tr>
					</thead>
					<tbody>
						{#each s.markets as m (m.label)}
							<tr>
								<td class="name">{m.label}</td>
								<td>{nf(m.last, m.decimals)}</td>
								<td
									><Change value={m.change} digits={m.kind === 'pct' ? 1 : 0} unit={m.kind === 'pct' ? ' %' : ' pb'} /></td
								>
								<td class="mut per">{dm(`${m.t}T12:00:00Z`)}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">Sin datos todavía.</p>
			{/if}
			{#snippet note()}Precios en %, tipos en puntos básicos. Fuentes: {sources}{/snippet}
		</Panel>
		<Panel title="Datos de la semana" meta="{s.macro.length} publicados">
			{#if s.macro.length}
				<ul class="mini">
					{#each s.macro as e (`${e.date}${e.title}`)}
						<li>
							<span class="l">{e.title}<small>{e.source}</small></span>
							<span class="mut">{when(e)}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">Sin publicaciones guardadas de estos días.</p>
			{/if}
		</Panel>
		<Panel title="Agenda" meta="Próximos 7 días" jump={{ code: 'CAL', href: resolve('/cal') }}>
			{#if s.agenda.length}
				<ul class="mini">
					{#each s.agenda as e (`${e.date}${e.title}`)}
						<li>
							<span class="l">{e.title}<small>{e.source}</small></span>
							<span class="mut">{when(e)}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">Nada en el calendario estos días.</p>
			{/if}
			{#snippet note()}Hora de Madrid · <Updated at={data.releasesAt} source="releases-cal" />{/snippet}
		</Panel>
	</div>
</div>
