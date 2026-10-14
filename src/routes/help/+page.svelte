<script lang="ts">
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { COMMANDS, TICKERS } from '#lib/commands.ts';
</script>

<ViewHeader code="HELP" title="Comandos y atajos" sub="Escribe un comando o un valor en la barra de arriba y pulsa Intro" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Comandos" meta="{COMMANDS.length} funciones">
			<div class="scroll">
				<table class="t">
					<thead><tr><th>Comando</th><th class="l">Qué abre</th><th class="l">Fuentes</th></tr></thead>
					<tbody>
						{#each COMMANDS as c (c.code)}
							<tr>
								<td><a class="code" href={resolve(c.route)}>{c.code}</a></td>
								<td class="l wrap">{c.desc}</td>
								<td class="l wrap mut">{c.sources}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Panel>
	</div>
	<div class="col">
		<Panel title="Atajos de teclado">
			<ul class="mini">
				<li><span class="l"><kbd>/</kbd> o empieza a escribir</span><b>Ir a la barra</b></li>
				<li><span class="l"><kbd>↑</kbd> <kbd>↓</kbd></span><b>Moverte por las sugerencias</b></li>
				<li><span class="l"><kbd>Intro</kbd></span><b>Abrir</b></li>
				<li><span class="l"><kbd>Esc</kbd></span><b>Volver a la portada</b></li>
			</ul>
		</Panel>
		<Panel title="Valores" meta="Escribe el código: abre su ficha">
			<ul class="tickers">
				{#each TICKERS as t (t.code)}
					<li><a href="{resolve('/s')}?sym={encodeURIComponent(t.code)}"><b>{t.code}</b> {t.name}</a></li>
				{/each}
			</ul>
			{#snippet note()}Cualquier otro código de TradingView también funciona: AAPL, BME:REP, FX:GBPUSD…{/snippet}
		</Panel>
	</div>
</div>

<style>
	.code {
		color: var(--amber);
		font-weight: 500;
		text-decoration: none;
	}

	.wrap {
		white-space: normal;
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	.tickers {
		list-style: none;
		margin: 0;
		padding: 8px 12px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 4px 12px;
	}

	.tickers a {
		color: var(--muted);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.tickers b {
		color: var(--amber);
		font-family: var(--mono);
		font-weight: 500;
	}

	.tickers a:hover {
		color: var(--fg);
	}
</style>
