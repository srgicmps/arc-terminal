<!-- Próximas elecciones: fecha, país (en ámbar tenue si es del G20 o de la UE) y tipo. -->
<script lang="ts">
	import { isMajor, KIND_LABEL } from '#lib/elections.ts';
	import { dm, weekday } from '#lib/format.ts';
	import type { Election } from '#lib/types.ts';
	import Table from './ui/Table.svelte';

	let { items }: { items: Election[] } = $props();
</script>

<Table>
	<thead>
		<tr><th>Fecha</th><th class="l">País</th><th>Tipo</th></tr>
	</thead>
	<tbody>
		{#each items as e (`${e.date}-${e.url}`)}
			<tr>
				<td title={weekday(e.date)}>{dm(`${e.date}T12:00:00Z`)}</td>
				<td class="l">
					<a class="name" class:major={isMajor(e)} href={e.url} target="_blank" rel="noopener" title={e.name}>{e.country}</a>
				</td>
				<td class="mut">{KIND_LABEL[e.kind]}</td>
			</tr>
		{/each}
	</tbody>
</Table>

<style>
	td.l {
		width: 100%;
		white-space: normal;
	}

	a.name.major {
		color: var(--amber-dim);
	}

	a.name:hover {
		color: var(--amber);
	}
</style>
