<!--
	«Mandar»: en la línea de un titular, lo manda por ntfy a otro usuario de Arc que lo acepte (F15,
	src/lib/family.svelte.ts). No sale nada si no hay nadie a quien mandar (o sin cuenta).
	Uso: <FamilySend title={item.title} url={item.url} />
-->
<script lang="ts">
	import Disclosure from './ui/Disclosure.svelte';
	import { family, loadFamily, sendFamily, type Person } from '#lib/family.svelte.ts';

	let { title, url }: { title: string; url: string } = $props();
	let open = $state(false);
	let notice = $state('');

	$effect(() => void loadFamily());

	async function send(p: Person) {
		notice = 'Enviando…';
		notice = await sendFamily(p, title, url);
		setTimeout(() => {
			open = false;
			notice = '';
		}, 2000);
	}
</script>

{#if family.phase === 'ready' && family.people.length}
	<span class="fam">
		<Disclosure inline bind:open>
			{#snippet summary()}Mandar{/snippet}
			{#if notice}
				<span role="status"> {notice}</span>
			{:else}
				{#each family.people as p (p.id)}
					{' '}<button type="button" onclick={() => send(p)}>{p.name}</button>
				{/each}
			{/if}
		</Disclosure>
	</span>
{/if}

<style>
	/* En el móvil, por encima de la capa que hace pulsable toda la fila (NewsList). */
	.fam {
		position: relative;
		z-index: 1;
	}
	button {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		color: var(--muted);
		border-bottom: var(--hair) dotted var(--line);
		cursor: pointer;
	}
	button:hover {
		color: var(--amber);
	}
	@media (pointer: coarse) {
		button {
			min-height: var(--touch);
			padding: 0 var(--sp-4);
		}
	}
</style>
