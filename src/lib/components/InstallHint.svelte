<script lang="ts">
	// «Instalar en tu móvil»: un aviso pequeño, encima de la barra inferior, solo en el móvil y si la web
	// aún no está en la pantalla de inicio. Con «Ahora no» no vuelve a salir (arc-install-hint).
	import { installPlatform, iosSafari, type InstallPlatform } from '#lib/install.ts';

	const KEY = 'arc-install-hint';

	/** Android/Chrome ofrece su propio diálogo: se guarda el evento para abrirlo con «Instalar». */
	type PromptEvent = Event & { prompt: () => Promise<void> };

	let platform = $state<InstallPlatform | null>(null);
	let safari = $state(true);
	let prompt = $state<PromptEvent | null>(null);
	let open = $state(false);

	$effect(() => {
		try {
			if (localStorage.getItem(KEY)) return;
		} catch {
			return;
		}
		const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
		platform = installPlatform(navigator.userAgent, standalone, navigator.maxTouchPoints);
		safari = iosSafari(navigator.userAgent);
		if (!platform) return;
		const onPrompt = (e: Event) => {
			e.preventDefault();
			prompt = e as PromptEvent;
		};
		addEventListener('beforeinstallprompt', onPrompt);
		// Unos segundos después de entrar, para no tapar lo primero que se mira.
		const id = setTimeout(() => (open = true), 4000);
		return () => {
			removeEventListener('beforeinstallprompt', onPrompt);
			clearTimeout(id);
		};
	});

	function close() {
		open = false;
		try {
			localStorage.setItem(KEY, 'no');
		} catch {
			// Sin localStorage, solo se cierra por ahora.
		}
	}

	async function install() {
		await prompt?.prompt();
		close();
	}
</script>

{#if open && platform}
	<aside class="install" aria-label="Instalar en tu móvil">
		<p>
			<b>Instálala en tu móvil</b>
			{#if prompt}
				y ábrela como una app, a pantalla completa.
			{:else if platform === 'ios' && safari}
				Toca
				<svg class="share" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v9M5 4.5l3-3 3 3M4.5 7H3v7.5h10V7h-1.5" /></svg>
				Compartir y luego «Añadir a pantalla de inicio».
			{:else if platform === 'ios'}
				Ábrela en Safari y, desde Compartir, «Añadir a pantalla de inicio».
			{:else}
				Menú <span class="ico">⋮</span> del navegador → «Instalar app» o «Añadir a pantalla de inicio».
			{/if}
		</p>
		<div class="act">
			{#if prompt}<button type="button" class="go" onclick={install}>Instalar</button>{/if}
			<button type="button" onclick={close}>Ahora no</button>
		</div>
	</aside>
{/if}

<style>
	.install {
		position: fixed;
		left: var(--sp-8);
		right: var(--sp-8);
		bottom: calc(var(--tabbar-h) + var(--sp-8) + env(safe-area-inset-bottom, 0px));
		z-index: 36;
		display: flex;
		align-items: center;
		gap: var(--sp-10);
		background: var(--raise);
		border: var(--hair) solid var(--amber-edge);
		padding: var(--sp-8) var(--pad-x);
		font-family: var(--sans);
		font-size: var(--fs-s);
		color: var(--muted);
	}

	p {
		flex: 1;
		margin: 0;
		line-height: var(--lh);
	}

	b {
		color: var(--fg);
		font-weight: var(--fw-medium);
	}

	.ico {
		color: var(--amber);
		font-family: var(--mono);
	}

	.share {
		width: 1em;
		height: 1em;
		vertical-align: -0.1em;
		fill: none;
		stroke: var(--amber);
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.act {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}

	button {
		min-height: var(--control-h);
		padding-inline: var(--sp-10);
		background: none;
		border: var(--border);
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}

	.go {
		color: var(--amber);
		border-color: var(--amber-edge);
	}
</style>
