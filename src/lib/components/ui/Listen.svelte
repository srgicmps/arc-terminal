<!--
	«Escuchar» (lote 25): lee en voz alta unas líneas con la Web Speech API del navegador, cada una en su
	idioma (los titulares que siguen en inglés, con voz inglesa). Si el navegador no sabe hablar, no sale.
	Uso: <Listen lines={() => [{ text: 'Lo importante hoy.', lang: 'es' }, …]} />
	`lines` es una función: el texto se arma al pulsar, con lo que se ve en ese momento.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';

	interface Line {
		text: string;
		lang?: 'es' | 'en';
	}

	let { lines, label = 'Escuchar' }: { lines: () => Line[]; label?: string } = $props();

	let can = $state(false);
	let speaking = $state(false);

	$effect(() => {
		can = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
	});

	function stop() {
		speechSynthesis.cancel();
		speaking = false;
	}

	function play() {
		if (speaking) return stop();
		const all = lines().filter((l) => l.text.trim());
		if (!all.length) return;
		speechSynthesis.cancel();
		all.forEach((line, i) => {
			const u = new SpeechSynthesisUtterance(line.text);
			u.lang = line.lang === 'en' ? 'en-GB' : 'es-ES';
			u.rate = 1.05;
			if (i === all.length - 1) u.onend = u.onerror = () => (speaking = false);
			speechSynthesis.speak(u);
		});
		speaking = true;
	}

	onDestroy(() => {
		if (speaking) speechSynthesis.cancel();
	});
</script>

{#if can}
	<button class="listen" type="button" aria-pressed={speaking} onclick={play}>
		<span aria-hidden="true">{speaking ? '■' : '▶'}</span>
		{speaking ? 'Parar' : label}
	</button>
{/if}

<style>
	.listen {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-6);
		padding: 0;
		background: none;
		border: 0;
		color: var(--amber);
		font: inherit;
		cursor: pointer;
	}

	.listen span {
		font-size: var(--fs-xs);
	}

	.listen:focus-visible {
		text-decoration: underline var(--hair);
		text-underline-offset: var(--sp-3);
	}

	@media (hover: hover) {
		.listen:hover {
			text-decoration: underline var(--hair);
			text-underline-offset: var(--sp-3);
		}
	}

	@media (pointer: coarse) {
		.listen {
			min-height: var(--touch);
		}
	}
</style>
