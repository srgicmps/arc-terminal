<!--
	Termómetro de riesgo (WS, y módulo para TOP): una barra fina de risk-off a risk-on con una aguja y, al
	tocarla, el desglose de cada indicador con su valor y su z-score. El cálculo está en src/lib/risk.ts.
	Uso: en el +page.server.ts, risk: computeRisk({ fred, ecb, crypto, predictions }) (así al navegador solo
	llega el resultado), y en la vista <RiskGauge risk={data.risk} />.
-->
<script lang="ts">
	import Panel from './Panel.svelte';
	import Table from './ui/Table.svelte';
	import RiskLights from './RiskLights.svelte';
	import { riskLabel, type Risk } from '#lib/risk.ts';
	import type { Light } from '#lib/risk-lights.ts';

	/** `id`: el del panel en la vista modular (TOP). `lights`: el semáforo de TOP, encima de la barra. */
	let { risk, id, lights = [] }: { risk: Risk; id?: string; lights?: Light[] } = $props();

	let expanded = $state(false);

	const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');
	const z = (v: number) => `${sign(v)}${Math.abs(v).toFixed(1).replace('.', ',')}`;
	/** De −3…+3 a la mitad de la barra (50 %). */
	const half = (v: number) => (Math.min(3, Math.abs(v)) / 3) * 50;
</script>

<Panel {id} title="Termómetro de riesgo" meta={risk.parts.length ? `${risk.parts.length} indicadores` : undefined}>
	<RiskLights {lights} />
	{#if risk.parts.length}
		<button type="button" class="gauge" aria-expanded={expanded} onclick={() => (expanded = !expanded)}>
			<span class="head">
				<b class="score">{sign(risk.score)}{Math.abs(risk.score)}</b>
				<span class="lbl">{riskLabel(risk.score)}</span>
				<span class="more" aria-hidden="true">{expanded ? '▴' : '▾'} desglose</span>
			</span>
			<span class="scale" aria-hidden="true">
				<i class="mid"></i>
				<i class="needle" style:left="{(risk.score + 100) / 2}%"></i>
			</span>
			<span class="ends" aria-hidden="true"><span>Risk-off · −100</span><span>+100 · Risk-on</span></span>
		</button>
		{#if expanded}
			<Table>
				<thead><tr><th>Indicador</th><th>Último</th><th>z</th><th class="l zcol">Frente a su año</th></tr></thead>
				<tbody>
					{#each risk.parts as p (p.id)}
						<tr>
							<td class="name">{p.label}<small>{p.reading}</small></td>
							<td>{p.value}</td>
							<td>{z(p.z)}</td>
							<td class="l zcol">
								<span class="zb" aria-hidden="true">
									<i class:neg={p.z < 0} style:left="{p.z < 0 ? 50 - half(p.z) : 50}%" style:width="{half(p.z)}%"></i>
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		{/if}
	{:else}
		<p class="empty">Sin datos suficientes para el termómetro.</p>
	{/if}
	{#snippet note()}
		{#if lights.length}
			Semáforo: nivel de cada indicador con umbrales fijos (punto gris, calma; ámbar tenue, vigilancia; ámbar,
			tensión); toca o pasa el ratón por uno para ver sus umbrales. Barra: cada indicador
		{:else}
			Cada indicador
		{/if} frente a su último año (z-score), con signo: + apetito por el riesgo, − miedo. La media va de −100 a
		+100. Fuentes: {[...new Set(risk.parts.map((p) => p.source))].join(', ') || '—'}.
	{/snippet}
</Panel>

<style>
	.gauge {
		display: flex;
		flex-direction: column;
		gap: var(--sp-8);
		width: 100%;
		padding: var(--sp-12) var(--pad-x);
		background: none;
		border: 0;
		text-align: left;
		cursor: pointer;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: var(--sp-10);
	}

	.score {
		font-size: var(--fs-xl);
		font-weight: var(--fw-medium);
		color: var(--amber);
	}

	.lbl {
		font-family: var(--sans);
		color: var(--fg);
	}

	.more {
		margin-left: auto;
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	.gauge:hover .more {
		color: var(--amber);
	}

	.scale {
		position: relative;
		display: block;
		height: var(--bar-h-thin);
		background: var(--raise);
	}

	.scale .mid {
		position: absolute;
		left: 50%;
		top: calc(-1 * var(--sp-2));
		bottom: calc(-1 * var(--sp-2));
		width: var(--hair);
		background: var(--line);
	}

	/* La aguja: 1 px de ancho, algo más alta que la barra. */
	.needle {
		position: absolute;
		top: calc(-1 * var(--sp-4));
		bottom: calc(-1 * var(--sp-4));
		width: var(--hair);
		background: var(--amber);
		transform: translateX(-50%);
	}

	.ends {
		display: flex;
		justify-content: space-between;
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	/* El motivo, debajo del nombre y en gris; así la tabla no se ensancha. */
	td small {
		display: block;
		color: var(--muted);
		font-size: var(--fs-xs);
		white-space: normal;
	}

	td.name {
		white-space: normal;
	}

	/* En paneles estrechos (móvil), sin la barra: el z ya va escrito. */
	@container (max-width: 480px) {
		.zcol {
			display: none;
		}
	}

	.zb {
		position: relative;
		display: block;
		min-width: var(--bar-min);
		height: var(--bar-h-thin);
		background: var(--raise);
	}

	.zb i {
		position: absolute;
		top: 0;
		bottom: 0;
		background: var(--amber);
	}

	.zb i.neg {
		background: var(--muted);
	}
</style>
