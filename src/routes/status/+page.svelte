<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { when } from '#lib/format.ts';
	import type { FeedStatus } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const rows = $derived(data.status?.data ?? []);
	const LABEL = { ok: 'Al día', cached: 'Al día', stale: 'Copia anterior', error: 'Sin datos', off: 'Sin clave' };
	const ok = $derived(rows.filter((r) => r.state === 'ok' || r.state === 'cached').length);
	// Las fuentes sin clave no son un fallo: no cuentan en el total.
	const active = $derived(rows.filter((r) => r.state !== 'off').length);

	// Canales RSS. Los JSON anteriores a este cambio no traen `ok`: cuenta como caído solo si hay error.
	const feedOk = (f: FeedStatus) => f.ok !== false && !f.error;
	const feedsAll = $derived(data.rss.reduce((n, s) => n + s.feeds.length, 0));
	const feedsOk = $derived(data.rss.reduce((n, s) => n + s.feeds.filter(feedOk).length, 0));
</script>

<ViewHeader code="STATUS" title="Estado de las fuentes" sub="Qué tal fue la última descarga de cada fuente de datos" />

<div class="grid">
	<div class="col">
		<Panel title="Fuentes" meta="{ok} de {active} al día">
			{#if rows.length}
				<div class="scroll">
					<table class="t">
						<thead><tr><th>Fuente</th><th class="l">Qué trae</th><th>Estado</th><th>Datos de</th></tr></thead>
						<tbody>
							{#each rows as r (r.name)}
								<tr>
									<td class="mut">{r.name}</td>
									<td class="l wrap">{r.label}{#if r.error}<small class:off={r.state === 'off'}>{r.error}</small>{/if}</td>
									<td class={r.state === 'ok' || r.state === 'cached' ? 'up' : r.state === 'off' ? 'mut' : 'down'}>{LABEL[r.state]}</td>
									<td class="mut">{when(r.fetchedAt, clock.now)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
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
							<details>
								<summary>
									<span class="mut">{s.name}</span>
									<span class:down={down.length}>{s.feeds.length - down.length}/{s.feeds.length} canales</span>
									{#each down as f (f.name)}<span class="down">{f.name}: {f.error ?? 'sin titulares'}</span>{/each}
								</summary>
								<ul class="feeds">
									{#each s.feeds as f (f.name)}
										<li class:down={!feedOk(f)}>
											<span>{f.name}</span>
											<span class="n">{feedOk(f) ? `${f.items ?? 0} titulares` : (f.error ?? 'sin titulares')}</span>
										</li>
									{/each}
								</ul>
							</details>
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

	/* Canales RSS: una línea plegada por sección; al abrirla, cada canal con sus titulares. */
	.rss,
	.feeds {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.rss > li {
		border-top: 1px solid var(--line);
	}

	.rss > li:first-child {
		border-top: 0;
	}

	.rss summary {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 10px;
		padding: 6px 10px;
		font-family: var(--mono);
		font-size: var(--fs-s);
		cursor: pointer;
		list-style: none;
	}

	.rss summary::-webkit-details-marker {
		display: none;
	}

	.rss summary:hover,
	.rss details[open] summary {
		background: var(--raise);
	}

	.feeds {
		padding: 2px 10px 8px 22px;
	}

	.feeds li {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding: 2px 0;
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
