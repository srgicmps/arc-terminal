<!--
	NOVEDADES: lo que ha cambiado en Arc Terminal la última semana, día a día. Cada cambio es un PR fusionado
	en GitHub; si el título empieza por un comando («LUZ: …»), sale a la derecha y lleva a esa vista.
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { byDay, changeCommand } from '#lib/changes.ts';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { hm } from '#lib/format.ts';
	import { routeHref } from '#lib/routes.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const items = $derived(data.changes?.data.items ?? []);
	// «Hoy» y «Ayer» dependen de la fecha: hasta que arranca el reloj, la de cuando se construyó la página.
	const days = $derived(byDay(items, clock.now || Date.parse(data.changes?.fetchedAt ?? '') || Date.now()));
</script>

<ViewHeader
	code="NOVEDADES"
	title="Novedades"
	sub="Lo que ha cambiado en Arc Terminal esta semana · {items.length} cambios"
/>

{#if !days.length}
	<div class="grid">
		<Panel title="Novedades">
			<p class="empty">{data.changes ? 'Nada nuevo esta semana.' : 'Sin datos todavía.'}</p>
		</Panel>
	</div>
{:else}
	{#snippet source()}
		PR fusionados en
		<a href="https://github.com/srgicmps/arc-terminal/pulls?q=is%3Apr+is%3Amerged" target="_blank" rel="noopener"
			>GitHub</a
		>
		· <Updated at={data.changes?.fetchedAt} source="changes" />
	{/snippet}
	<div class="grid grid-2e">
		{#each days as d, i (d.day)}
			<div class="col">
				<!-- La fuente, una sola vez: al pie del primer día. -->
				<Panel
					title={d.label}
					meta="{d.items.length} {d.items.length === 1 ? 'cambio' : 'cambios'}"
					note={i === 0 ? source : undefined}
				>
					<ul class="mini">
						{#each d.items as c (c.number)}
							{@const cmd = changeCommand(c.title)}
							<li>
								<a class="l" href={c.url} target="_blank" rel="noopener"
									>{c.title}<small>#{c.number} · {hm(c.mergedAt)}</small></a
								>
								{#if cmd}<a class="cmd" href={routeHref(cmd.route)}>{cmd.code}</a>{/if}
							</li>
						{/each}
					</ul>
				</Panel>
			</div>
		{/each}
	</div>
{/if}

<style>
	.cmd {
		color: var(--amber);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
		text-decoration: none;
	}

	.cmd:hover {
		text-decoration: underline;
	}
</style>
