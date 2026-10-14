<script lang="ts">
	import Disclosure from '#lib/components/ui/Disclosure.svelte';
	import { clock } from '#lib/clock.svelte.ts';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { lastRuns } from '#lib/data.ts';
	import { dm, nf, when } from '#lib/format.ts';
	import { G_LABEL, stormLevel } from '#lib/space.ts';
	import Table from '#lib/components/ui/Table.svelte';
	import type { FeedStatus } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const rows = $derived(data.status?.data ?? []);
	const LABEL = { ok: 'Al día', cached: 'Al día', stale: 'Copia anterior', error: 'Sin datos', off: 'Sin clave' };
	const ok = $derived(rows.filter((r) => r.state === 'ok' || r.state === 'cached').length);
	// Las fuentes sin clave no son un fallo: no cuentan en el total.
	const active = $derived(rows.filter((r) => r.state !== 'off').length);
	// Tira con las últimas pasadas de cada fuente, reconstruida a partir de los tramos de status-history.
	const STRIP = 28;
	const TONE = { ok: 'good', cached: 'good', stale: 'stale', error: 'bad', off: 'off' };
	const strips = $derived(
		new Map((data.history?.data ?? []).map((h) => [h.name, lastRuns(h.history, STRIP)]))
	);

	// Canales RSS. Los JSON anteriores a este cambio no traen `ok`: cuenta como caído solo si hay error.
	const feedOk = (f: FeedStatus) => f.ok !== false && !f.error;
	const feedsAll = $derived(data.rss.reduce((n, s) => n + s.feeds.length, 0));
	// Tormentas solares (NOAA SWPC): una línea con el Kp, la escala G de ahora y la prevista.
	const swpc = $derived(data.swpc?.data);
	const storm = $derived(stormLevel(swpc));
	const forecastWhen = $derived(
		storm?.forecast && swpc?.gForecastDate ? dm(`${swpc.gForecastDate}T12:00:00Z`) : G_LABEL[storm?.forecast ?? 0]
	);
	const kpMax = $derived(swpc?.kp24.length ? Math.max(...swpc.kp24.map((p) => p.v)) : null);

	const feedsOk = $derived(data.rss.reduce((n, s) => n + s.feeds.filter(feedOk).length, 0));
</script>

<ViewHeader code="STATUS" title="Estado de las fuentes" sub="Qué tal fue la última descarga de cada fuente de datos" />

<div class="grid">
	<div class="col">
		<Panel title="Tormentas solares" meta="NOAA SWPC">
			{#if swpc && storm}
				<p class="space">
					<span>Kp <b>{nf(swpc.kp, 1)}</b>{#if kpMax !== null}<small>· máx. 24 h {nf(kpMax, 1)}</small>{/if}</span>
					<span>Ahora <b class:hot={storm.now >= 3}>G{storm.now}</b><small>· {G_LABEL[storm.now]}</small></span>
					<span>Prevista <b class:hot={storm.forecast >= 3}>G{storm.forecast}</b><small>· {forecastWhen}</small></span>
				</p>
			{:else}
				<p class="empty">Sin datos todavía.</p>
			{/if}
			{#snippet note()}
				Escala G de 0 a 5: desde G3 hay auroras a latitudes medias y puede fallar el GPS · <Updated at={data.swpc?.fetchedAt} source="swpc" />
			{/snippet}
		</Panel>

		<Panel title="Fuentes" meta="{ok} de {active} al día">
			{#if rows.length}
				<Table>
					<thead><tr><th>Fuente</th><th class="l">Qué trae</th><th>Estado</th><th>Datos de</th></tr></thead>
					<tbody>
						{#each rows as r (r.name)}
							{@const runs = strips.get(r.name) ?? []}
							<tr>
								<td class="mut">{r.name}</td>
								<td class="l wrap">{r.label}{#if r.error}<small class:off={r.state === 'off'}>{r.error}</small>{/if}</td>
								<td class={r.state === 'ok' || r.state === 'cached' ? 'up' : r.state === 'off' ? 'mut' : 'down'}>
									{LABEL[r.state]}
									{#if runs.length}
										<span class="strip" aria-label="Últimas {runs.length} pasadas">
											{#each runs as state, i (i)}
												<i class={TONE[state]} title={LABEL[state]}></i>
											{/each}
										</span>
									{/if}
								</td>
								<td class="mut">{when(r.fetchedAt, clock.now)}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">Sin datos todavía.</p>
			{/if}
			{#snippet note()}
				Cada 15 minutos, GitHub Actions descarga las fuentes. Las que cambian poco (Eurostat, BLS) se
				reutilizan unas horas. Si una falla, se mantiene su última copia.
			{/snippet}
		</Panel>

		<!-- Salud de cada canal RSS de las secciones de titulares. -->
		<Panel title="Canales RSS" meta="{feedsOk} de {feedsAll} responden">
			{#if data.rss.length}
				<ul class="rss">
					{#each data.rss as s (s.name)}
						{@const down = s.feeds.filter((f) => !feedOk(f))}
						<li>
							<Disclosure>
								{#snippet summary()}
									<span class="mut">{s.name}</span>
									<span class:down={down.length}>{s.feeds.length - down.length}/{s.feeds.length} canales</span>
									{#each down as f (f.name)}<span class="down">{f.name}: {f.error ?? 'sin titulares'}</span>{/each}
								{/snippet}
								<ul class="feeds">
									{#each s.feeds as f (f.name)}
										<li class:down={!feedOk(f)}>
											<span>{f.name}</span>
											<span class="n">{feedOk(f) ? `${f.items ?? 0} titulares` : (f.error ?? 'sin titulares')}</span>
										</li>
									{/each}
								</ul>
							</Disclosure>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">Sin datos todavía.</p>
			{/if}
		</Panel>
	</div>
</div>

<style>
	.space {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-20);
		margin: 0;
		padding: var(--row-y) var(--pad-x);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.space b {
		color: var(--fg);
		font-weight: var(--fw-medium);
	}

	.space b.hot {
		color: var(--amber);
	}

	.space small {
		display: inline;
		margin-left: var(--sp-4);
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.wrap {
		white-space: normal;
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	small {
		display: block;
		color: var(--down);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	small.off {
		color: var(--muted);
	}

	/* Una raya de 1 px de alto por pasada, la más reciente a la derecha. */
	.strip {
		display: flex;
		justify-content: flex-end;
		gap: var(--hair);
		margin-top: var(--sp-4);
	}

	.strip i {
		width: 3px;
		height: 1px;
		background: var(--line);
	}

	.strip .good {
		background: var(--up);
		opacity: 0.45;
	}

	.strip .stale {
		background: var(--amber);
	}

	.strip .bad {
		background: var(--down);
	}

	/* Canales RSS: una línea plegada por sección; al abrirla, cada canal con sus titulares. */
	.rss,
	.feeds {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.rss > li {
		border-top: var(--border);
	}

	.rss > li:first-child {
		border-top: 0;
	}

	/* Los canales de cada fuente, en mono como en el resumen. */
	.rss :global(summary) {
		font-family: var(--mono);
		font-size: var(--fs-s);
	}

	/* Sangría: la del resumen (10 px) más el hueco del marcador (12 px). */
	.feeds {
		padding: var(--sp-2) var(--sp-10) var(--sp-8) calc(var(--sp-10) + var(--sp-12));
	}

	.feeds li {
		display: flex;
		justify-content: space-between;
		gap: var(--sp-10);
		padding: var(--sp-2) 0;
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	.feeds .n {
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	.down,
	.feeds .down .n {
		color: var(--down);
	}
</style>
