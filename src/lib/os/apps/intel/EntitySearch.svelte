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
	/** La lista se cierra si el foco sale del buscador (y vuelve a salir al escribir o al entrar otra vez). */
	let open = $state(true);
	let box: HTMLDivElement;
	const uid = $props.id();
	const listId = `${uid}-list`;
	const optId = (i: number) => `${uid}-opt-${i}`;
	const results = $derived(graph && query.trim() ? searchNodes(graph, query, 10) : []);
	const shown = $derived(open && results.length > 0);
	$effect(() => {
		void results;
		active = 0;
	});

	// El campo es el de Search (común): el papel de combobox y la opción activa se le ponen desde aquí.
	$effect(() => {
		const input = box?.querySelector('input');
		if (!input) return;
		input.setAttribute('role', 'combobox');
		input.setAttribute('aria-autocomplete', 'list');
		input.setAttribute('aria-controls', listId);
		input.setAttribute('aria-expanded', String(shown));
		if (shown) input.setAttribute('aria-activedescendant', optId(active));
		else input.removeAttribute('aria-activedescendant');
	});

	function pick(id: string) {
		query = '';
		onpick(id);
	}

	function leave(e: FocusEvent) {
		const to = e.relatedTarget as Node | null;
		if (!to || !box.contains(to)) open = false;
	}

	function keys(e: KeyboardEvent) {
		open = true;
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
<div class="find" bind:this={box} onkeydown={keys} onfocusin={() => (open = true)} onfocusout={leave} oninput={() => (open = true)}>
	<Search label="Buscar una entidad" {placeholder} bind:value={query} />
	{#if shown}
		<ul class="results" id={listId} role="listbox" aria-label="Entidades que encajan">
			{#each results as n, i (n.id)}
				<li role="option" id={optId(i)} aria-selected={i === active}>
					<button type="button" tabindex="-1" class:on={i === active} onpointerdown={(e) => e.preventDefault()} onclick={() => pick(n.id)} onpointerenter={() => (active = i)}>
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
