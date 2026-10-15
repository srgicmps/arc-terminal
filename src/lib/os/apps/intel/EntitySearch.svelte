<!--
	Buscador de entidades del Centro de mando (Grafo y Expediente): el Search común y, debajo, la lista de lo que
	encaja. ↑ ↓ eligen, Intro abre, Escape vacía. onpick recibe el id del nodo («country:ES»).
-->
<script lang="ts">
	import Search from '#lib/components/ui/Search.svelte';
	import { searchNodes } from './graph.ts';
	import { kindLabel, type Graph } from './model.ts';

	let { graph, onpick, placeholder = 'Buscar: España, Lagarde, NVDA…' }: { graph: Graph | null; onpick: (id: string) => void; placeholder?: string } = $props();

	let query = $state('');
	let active = $state(0);
	const results = $derived(graph && query.trim() ? searchNodes(graph, query, 10) : []);
	$effect(() => {
		void results;
		active = 0;
	});

	function pick(id: string) {
		query = '';
		onpick(id);
	}

	function keys(e: KeyboardEvent) {
		if (!results.length) return;
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			active = (active + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			pick(results[active].id);
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="find" onkeydown={keys}>
	<Search label="Buscar una entidad" {placeholder} bind:value={query} />
	{#if results.length}
		<ul class="results" role="listbox" aria-label="Entidades que encajan">
			{#each results as n, i (n.id)}
				<li role="option" aria-selected={i === active}>
					<button type="button" class:on={i === active} onclick={() => pick(n.id)} onpointerenter={() => (active = i)}>
						<span class="dot" data-cmd-kind={n.kind} aria-hidden="true"></span>
						<span class="label">{n.label}</span>
						<span class="kind">{kindLabel(n.kind)}{n.mentions ? ` · ${n.mentions}` : ''}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.find {
		position: relative;
		display: flex;
		flex: 1 1 240px;
		min-width: 0;
	}

	.results {
		position: absolute;
		top: calc(100% + var(--hair));
		left: 0;
		right: 0;
		z-index: var(--z-popover);
		max-height: var(--cmd-results);
		overflow: auto;
		margin: 0;
		padding: 0;
		list-style: none;
		background: var(--panel);
		border: var(--border);
		box-shadow: var(--shadow-pop);
	}

	button {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		width: 100%;
		min-height: var(--control-h);
		padding: 0 var(--sp-10);
		border: 0;
		background: none;
		color: var(--fg);
		font-family: var(--sans);
		font-size: var(--fs-m);
		text-align: left;
		cursor: pointer;
	}

	button.on {
		background: var(--raise);
	}

	.label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.kind {
		color: var(--faint);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}

	.dot {
		flex: none;
		width: var(--swatch);
		height: var(--swatch);
		border-radius: 50%;
		background: var(--kc);
	}

	:global([data-cmd-kind='country']) { --kc: var(--cmd-country); }
	:global([data-cmd-kind='leader']) { --kc: var(--cmd-leader); }
	:global([data-cmd-kind='bank']) { --kc: var(--cmd-bank); }
	:global([data-cmd-kind='ticker']) { --kc: var(--cmd-ticker); }
	:global([data-cmd-kind='sanction']) { --kc: var(--cmd-sanction); }
	:global([data-cmd-kind='event']) { --kc: var(--cmd-event); }
	:global([data-cmd-kind='story']) { --kc: var(--cmd-story); }
</style>
