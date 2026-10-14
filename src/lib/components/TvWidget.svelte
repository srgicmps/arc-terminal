<!--
	Widget de TradingView (gratis y sin clave). TradingView los distribuye como un <script> que lee su
	configuración del propio texto del script: aquí se crea ese script al montar el componente.
	Solo funciona en el navegador; en el HTML generado al construir queda el hueco vacío.
-->
<script lang="ts">
	interface Props {
		/** Nombre del widget: «stock-heatmap», «symbol-overview», «events»… */
		widget: string;
		config: Record<string, unknown>;
		height?: number;
		/** Muestra «Datos y gráficos de TradingView» debajo. */
		credit?: boolean;
	}

	let { widget, config, height = 500, credit = true }: Props = $props();

	let box: HTMLDivElement;

	$effect(() => {
		const script = document.createElement('script');
		script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;
		script.async = true;
		script.textContent = JSON.stringify({
			colorTheme: 'dark',
			isTransparent: true,
			locale: 'es',
			width: '100%',
			height: '100%',
			...config
		});
		const inner = document.createElement('div');
		inner.className = 'tradingview-widget-container__widget';
		box.replaceChildren(inner, script);
		return () => box.replaceChildren();
	});
</script>

<div class="tv tradingview-widget-container" style:height="{height}px" bind:this={box}></div>
{#if credit}
	<p class="pnote">
		Datos y gráficos de <a href="https://es.tradingview.com/" target="_blank" rel="noopener">TradingView</a>.
	</p>
{/if}

<style>
	.tv {
		width: 100%;
	}
</style>
