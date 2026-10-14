<!--
	Marca «trad. auto» junto al medio de un titular traducido: siempre visible y discreta. Al pasar el
	ratón, el original y quién lo ha traducido (titles.svelte.ts). Uso: {#if traducido}<AutoTag {item} />{/if}
-->
<script lang="ts">
	import { original } from '#lib/titles.svelte.ts';

	let { item }: { item: { title: string; titleEs?: string } } = $props();
</script>

<span class="auto" title={original(item)}>trad. auto</span>

<style>
	.auto {
		color: var(--faint);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-tight);
	}
</style>
