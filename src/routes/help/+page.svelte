<script lang="ts">
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { COMMANDS, TICKERS } from '#lib/commands.ts';
	import Table from '#lib/components/ui/Table.svelte';
</script>

<ViewHeader code="HELP" title="Comandos y atajos" sub="Escribe un comando o un valor en la barra de arriba y pulsa Intro" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Comandos" meta="{COMMANDS.length} funciones">
			<Table>
				<thead><tr><th>Comando</th><th class="l">Qué abre</th><th class="l">Fuentes</th></tr></thead>
				<tbody>
					{#each COMMANDS as c (c.code)}
						<tr>
							<td><a class="code" href={resolve(c.route)}>{c.code}</a></td>
							<td class="l wrap">
								{c.desc}
								{#if c.aliases}<small class="mut">También: {c.aliases.join(', ')}</small>{/if}
							</td>
							<td class="l wrap mut">{c.sources}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		</Panel>
	</div>
	<div class="col">
		<Panel title="Atajos de teclado">
			<ul class="mini">
				<li><span class="l"><kbd>/</kbd> o empieza a escribir</span><b>Ir a la barra</b></li>
				<li><span class="l">Barra vacía</span><b>Tus 5 últimos comandos</b></li>
				<li><span class="l"><kbd>↑</kbd> <kbd>↓</kbd></span><b>Moverte por las sugerencias</b></li>
				<li><span class="l"><kbd>Intro</kbd></span><b>Abrir</b></li>
				<li><span class="l"><kbd>Esc</kbd></span><b>Volver a la portada</b></li>
				<li><span class="l">Pulsa el título de un panel, o <kbd>M</kbd> con el foco en él</span><b>Ampliar el panel</b></li>
				<li><span class="l"><kbd>Esc</kbd> o <kbd>✕</kbd> con un panel ampliado</span><b>Cerrarlo</b></li>
				<li><span class="l"><kbd>⇧</kbd> <kbd>F</kbd></span><b>Pantalla completa</b></li>
			</ul>
		</Panel>
		<Panel title="Con texto detrás" meta="Comando, espacio y lo que buscas">
			<ul class="mini">
				{#each COMMANDS.filter((c) => c.arg) as c (c.code)}
					{@const text = c.arg!.example.slice(c.code.length + 1)}
					<li>
						<a class="l" href="{resolve(c.route)}?{c.arg!.param}={encodeURIComponent(text)}">
							<b class="code">{c.arg!.example}</b>
						</a>
						<b>{c.arg!.label}</b>
					</li>
				{/each}
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
		font-weight: var(--fw-medium);
		text-decoration: none;
	}

	.wrap {
		white-space: normal;
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	.wrap small {
		display: block;
		font-size: var(--fs-s);
	}

	.tickers {
		list-style: none;
		margin: 0;
		padding: var(--row-y) var(--pad-x);
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--sp-4) var(--sp-12);
	}

	/* Cada enlace ocupa 24 px de alto (mínimo de WCAG 2.2) y las filas solo se separan 4 px más. */
	.tickers a {
		display: block;
		padding-block: var(--sp-4);
		margin-block: calc(-1 * var(--sp-2));
		color: var(--muted);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.tickers b {
		color: var(--amber);
		font-family: var(--mono);
		font-weight: var(--fw-medium);
	}

	.tickers a:hover {
		color: var(--fg);
	}

	/* Pantallas táctiles: 44 px de alto pulsable. */
	@media (pointer: coarse) {
		.tickers a {
			display: flex;
			align-items: center;
			min-height: var(--touch);
			margin-block: 0;
		}
	}
</style>
