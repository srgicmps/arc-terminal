<!-- La Terminal dentro de una ventana de Arc OS: lo que abre va a otra ventana (openPath del núcleo). -->
<script lang="ts">
	import { base } from '$app/paths';
	import type { AppProps } from '../apps.ts';
	import { openPath } from '../os.svelte.ts';
	import Terminal from './Terminal.svelte';

	let { win }: AppProps = $props();
	const open = (href: string) => {
		// href lleva la base de la web delante (resolve); el núcleo trabaja con la ruta de la app.
		openPath(base && href.startsWith(base) ? href.slice(base.length) || '/' : href);
	};
</script>

<div class="tw" data-win={win}><Terminal onopen={open} /></div>

<style>
	.tw {
		height: 100%;
	}
</style>
