<script lang="ts">
	import { routeHref } from '#lib/routes.ts';
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { COMMANDS } from '#lib/commands.ts';
	import { TICKERS } from '#lib/tickers.ts';
	import { exampleTarget } from '#lib/cmdline.ts';
	import Table from '#lib/components/ui/Table.svelte';
	import { keyJoin, SHORTCUTS } from '#lib/shortcuts.ts';
</script>

<ViewHeader code="HELP" title="Comandos y atajos" sub="Escribe un comando o un valor en la barra de arriba y pulsa Intro" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Comandos" meta="{COMMANDS.length} funciones" jump={{ code: 'MANUAL', href: resolve('/manual') }}>
			<Table>
				<thead><tr><th>Comando</th><th class="l">Qué abre</th><th class="l">Fuentes</th></tr></thead>
				<tbody>
					{#each COMMANDS as c (c.code)}
						<tr>
							<td><a class="code" href={routeHref(c.route)}>{c.code}</a></td>
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
				{#each SHORTCUTS as s (s.id)}
					<li>
						<span class="l">{#each s.keys as k, i (i)}{#if i}{keyJoin(s)}{/if}<kbd>{k}</kbd>{/each}{#if 'how' in s}{s.keys.length ? ' ' : ''}{s.how}{/if}</span><b>{s.action}</b>
					</li>
				{/each}
			</ul>
		</Panel>
		<Panel title="Con texto detrás" meta="Comando, espacio y lo que buscas">
			<ul class="mini">
				{#each COMMANDS.filter((c) => c.arg) as c (c.code)}
					{@const ex = exampleTarget(c)}
					<li>
						<a class="l" href="{routeHref(ex.route)}{ex.search}">
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
