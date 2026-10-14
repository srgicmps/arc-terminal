<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { lastRuns } from '#lib/data.ts';
	import { when } from '#lib/format.ts';
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

	/* Una raya de 1 px de alto por pasada, la más reciente a la derecha. */
	.strip {
		display: flex;
		justify-content: flex-end;
		gap: 1px;
		margin-top: 4px;
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
</style>
