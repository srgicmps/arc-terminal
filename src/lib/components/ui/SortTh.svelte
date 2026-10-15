<!--
	Cabecera ordenable de una <Table>: un botón dentro del <th>, con aria-sort y una flecha sutil (▲▼).
	Uso (con un Sorter de #lib/sorter.svelte.ts y sortBy de #lib/sort.ts):
	  const sort = new Sorter<'price' | 'name'>();
	  const shown = $derived(sort.key ? sortBy(rows, (r) => r[sort.key!], sort.dir) : rows);
	  <SortTh {sort} key="price">Precio</SortTh>
-->
<script lang="ts" generics="K extends string">
	import type { Snippet } from 'svelte';
	import type { Sorter } from '#lib/sorter.svelte.ts';
	import type { SortDir } from '#lib/sort.ts';

	interface Props {
		sort: Sorter<K>;
		key: K;
		/** Sentido al pulsarla por primera vez: de mayor a menor salvo que se diga otra cosa (los nombres, «asc»). */
		first?: SortDir;
		/** Clase del <th> («l» para alinearla a la izquierda, como las celdas de texto). */
		class?: string;
		title?: string;
		children: Snippet;
	}

	let { sort, key, first = 'desc', class: cls = '', title, children }: Props = $props();

	const active = $derived(sort.key === key);
</script>

<th class={cls} {title} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
	<button type="button" onclick={() => sort.toggle(key, first)}>
		{@render children()}<span class="arrow" aria-hidden="true">{active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
	</button>
</th>

<style>
	button {
		font: inherit;
		color: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
	}

	button:focus-visible {
		color: var(--fg);
	}

	@media (hover: hover) {
		button:hover {
			color: var(--fg);
		}
	}

	button:focus-visible {
		outline: var(--hair) solid var(--amber);
	}

	.arrow {
		margin-left: var(--sp-2);
		color: var(--muted);
	}
</style>
