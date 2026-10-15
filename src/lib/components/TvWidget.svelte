<!--
	Widget de TradingView (gratis y sin clave). TradingView los distribuye como un <script> que lee su
	configuración del propio texto del script: aquí se crea ese script en el navegador.
	Carga perezosa: el script (y el iframe que crea) solo se pide cuando el widget está a ~200 px de verse.
	Mientras tanto se reserva el hueco con su altura para que el diseño no salte.
	En el HTML generado al construir queda el hueco con el aviso «Cargando TradingView…».
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { rgba, token } from '#lib/color.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import { paint, watchPaint } from '#lib/tvpaint.svelte.ts';
	import Note from './ui/Note.svelte';

	interface Props {
		/** Nombre del widget: «stock-heatmap», «symbol-overview», «events»… */
		widget: string;
		config: Record<string, unknown>;
		height?: number;
		/** Muestra «Datos y gráficos de TradingView» debajo. */
		credit?: boolean;
	}

	let { widget, config, height = 500, credit = true }: Props = $props();

	let frame: HTMLDivElement;
	let box: HTMLDivElement;
	/** El widget ya está cerca de la vista: se puede cargar. */
	let near = $state(false);
	/** El script de TradingView ya ha llegado (o ha fallado): se quita el aviso. */
	let ready = $state(false);
	/** No ha llegado (sin red o con un bloqueador): se dice, en vez de dejar el hueco vacío. */
	let failed = $state(false);

	// 1) Vigila cuándo se acerca a la vista. Una sola vez: al verlo, desconecta.
	$effect(() => {
		if (near) return;
		if (typeof IntersectionObserver === 'undefined') {
			near = true;
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					near = true;
					io.disconnect();
				}
			},
			{ rootMargin: '200px 0px' }
		);
		io.observe(frame);
		return () => io.disconnect();
	});

	// 2) Cuando está cerca, crea el script. Se rehace si cambian widget, config (p. ej. otro símbolo)
	//    o los colores (tema, acento o estética), porque TradingView solo los lee al crearse.
	$effect(() => {
		watchPaint();
		if (!near) return;
		void paint.n;
		ready = false;
		failed = false;
		const script = document.createElement('script');
		script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;
		script.async = true;
		// Fondo y rejilla con los tokens del tema, en los widgets que los admiten (los demás ignoran las claves).
		const panel = rgba(token('--panel'));
		const line = rgba(token('--line'));
		script.textContent = JSON.stringify({
			// Sin depender de theme.resolved: paint ya cambia con data-theme (si no, se rehacía dos veces).
			colorTheme: untrack(() => theme.resolved),
			isTransparent: true,
			backgroundColor: panel,
			gridColor: line,
			gridLineColor: line,
			locale: 'es',
			width: '100%',
			height: '100%',
			...config
		});
		script.onload = () => (ready = true);
		script.onerror = () => (failed = ready = true);
		const inner = document.createElement('div');
		inner.className = 'tradingview-widget-container__widget';
		box.replaceChildren(inner, script);
		return () => {
			script.onload = script.onerror = null;
			box.replaceChildren();
		};
	});
</script>

<div class="tv" data-widget={widget} style:height="{height}px" bind:this={frame}>
	{#if failed}
		<span class="wait" role="status">No se ha podido cargar TradingView (sin conexión o con un bloqueador).</span>
	{:else if !ready}
		<span class="wait" aria-hidden="true">Cargando TradingView…</span>
	{/if}
	<div class="box tradingview-widget-container" bind:this={box}></div>
</div>
{#if credit}
	<Note>Datos y gráficos de <a href="https://es.tradingview.com/" target="_blank" rel="noopener">TradingView</a>.</Note>
{/if}

<style>
	.tv {
		position: relative;
		width: 100%;
	}
	/* El iframe de TradingView declara un esquema de color claro. Si hereda el «dark» de la página, Chrome lo
	   pinta con un fondo blanco opaco y deja de ser transparente: con «normal» los dos coinciden y se ve el panel. */
	.box {
		position: relative;
		width: 100%;
		height: 100%;
		color-scheme: normal;
	}
	/* Aviso discreto mientras llega el widget: mismo fondo y borde de 1 px que el resto de paneles. */
	.wait {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--panel);
		box-shadow: inset 0 0 0 var(--hair) var(--line);
		color: var(--faint);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-tight);
		text-align: center;
		padding: 0 var(--pad-x);
		pointer-events: none;
	}

	/* En papel no hay TradingView (son iframes en directo). */
	@media print {
		.tv {
			display: none;
		}
	}
</style>
