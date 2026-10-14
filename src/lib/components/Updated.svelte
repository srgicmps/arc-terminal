<!-- «Actualizado hace 5 min»: cuándo se descargaron los datos de una fuente. -->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { when } from '#lib/format.ts';

	let { at }: { at: string | null | undefined } = $props();
</script>

{#if at}<span>Act. {when(at, clock.now)}</span>{/if}
