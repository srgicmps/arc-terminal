<!--
	Panel «Tus alertas» de AVISOS (F14): alertas de precio y palabras vigiladas, en tu cuenta. Las alertas se
	crean aquí o desde la barra («alerta NVDA > 150») y se borran solas al avisar. Recibe la configuración y el
	`set` de la vista, que es quien guarda.
-->
<script lang="ts">
	import Panel from './Panel.svelte';
	import ChipInput from './ui/ChipInput.svelte';
	import { newPrice, parseWordList, type AlertConfig } from '#lib/alertconfig.ts';
	import { alertText, LIMITS, parseAlert } from '#lib/useralerts.ts';

	let { config, set }: { config: AlertConfig; set: (patch: Partial<AlertConfig>) => void } = $props();
	let msg = $state('');

	function add(raw: string) {
		const a = parseAlert(raw);
		msg = '';
		if (!a) msg = 'No la entiendo. Ejemplos: NVDA > 150 · BTC -5% · diésel < 1,40';
		else if (config.prices.length >= LIMITS.alerts) msg = `Como mucho ${LIMITS.alerts}.`;
		else set({ prices: [...config.prices, newPrice(a)] });
	}
</script>

<Panel title="Tus alertas" meta="{config.prices.length} de {LIMITS.alerts}">
	<ChipInput
		label="Nueva alerta"
		placeholder="NVDA > 150"
		items={config.prices.map(alertText)}
		onadd={add}
		onremove={(t) => set({ prices: config.prices.filter((p) => alertText(p) !== t) })}
	/>
	<ChipInput
		label="Palabra vigilada"
		placeholder="aranceles"
		items={config.words}
		onadd={(w) => set({ words: parseWordList([...config.words, w]) })}
		onremove={(w) => set({ words: config.words.filter((x) => x !== w) })}
	/>
	{#snippet note()}
		Alertas de precio (valores de EE. UU., BTC, ETH y diésel): llegan una vez, siempre, y se borran solas. Palabras:
		titulares y BOE que las nombran. También desde la barra: «alerta NVDA > 150», «vigila aranceles». Son privadas.
		{msg}
	{/snippet}
</Panel>
