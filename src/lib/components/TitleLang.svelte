<!--
	Botón ES / EN de los titulares: en español (traducidos) o en el idioma original. La preferencia es
	común a todas las vistas y se guarda en el navegador (titles.svelte.ts).
-->
<script lang="ts">
	import Seg from './ui/Seg.svelte';
	import { setTitleLang, titles, type TitleLang } from '#lib/titles.svelte.ts';

	const options = [
		{ value: 'es', label: 'ES' },
		{ value: 'en', label: 'EN' }
	] as const satisfies readonly { value: TitleLang; label: string }[];
</script>

<!-- bind con funciones (get, set): como un v-model con computed get/set en Vue. -->
<Seg label="Idioma de los titulares" {options} bind:value={() => titles.lang, setTitleLang} />
