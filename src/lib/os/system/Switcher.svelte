<!--
	Alt+Tab visual de Arc OS: una fila de miniaturas (el escritorio en pequeño con la ventana en su sitio) con su
	icono y su nombre. Alt+º o Alt+Tab avanza, con ⇧ retrocede; al soltar Alt se va a la elegida. También con un
	clic. Escape cancela. Estado en switcher.svelte.ts; lo monta SystemLayer.
-->
<script lang="ts">
	import { findWin } from '../wm.ts';
	import { appOf, os } from '../os.svelte.ts';
	import { pick, sw } from './switcher.svelte.ts';
	import { thumbRect } from './switcher.ts';

	const wins = $derived(sw.uids.map((u) => findWin(os.state, u)).filter((w) => !!w));
</script>

<div class="scrim" aria-hidden="true"></div>
<!-- La lista no tiene el foco (lo tiene la ventana mientras se sujeta Alt): la elegida se anuncia aparte. -->
<p class="sr" aria-live="assertive">{wins[sw.idx] ? (appOf(wins[sw.idx])?.name ?? wins[sw.idx].app) : ''}</p>
<div class="sw" role="listbox" aria-label="Cambiar de ventana">
	{#each wins as w, i (w.uid)}
		{@const app = appOf(w)}
		{@const r = thumbRect(w, os.area)}
		<button
			type="button"
			id="sw-{w.uid}"
			role="option"
			class="card"
			aria-selected={i === sw.idx}
			onpointerdown={(e) => (e.preventDefault(), pick(i))}
		>
			<span class="thumb">
				{#each wins as o (o.uid)}
					{#if o.uid !== w.uid && !o.min}
						{@const q = thumbRect(o, os.area)}
						<i class="other" style:left="{q.left}%" style:top="{q.top}%" style:width="{q.width}%" style:height="{q.height}%"></i>
					{/if}
				{/each}
				<i class="me" style:left="{r.left}%" style:top="{r.top}%" style:width="{r.width}%" style:height="{r.height}%">
					<b>{app?.icon ?? '▢'}</b>
				</i>
			</span>
			<span class="name">{app?.name ?? w.app}{w.min ? ' · minimizada' : ''}</span>
		</button>
	{/each}
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: var(--z-system);
		background: var(--scrim);
	}

	.sw {
		position: fixed;
		z-index: var(--z-system);
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--sp-10);
		max-width: calc(100vw - 2 * var(--sp-16));
		padding: var(--sp-12);
		background: var(--os-win-bg);
		border: var(--border);
		border-radius: var(--os-win-radius);
		box-shadow: var(--shadow-pop);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		width: var(--os-thumb-w);
		padding: var(--sp-6);
		background: transparent;
		border: var(--hair) solid transparent;
		border-radius: var(--radius-s);
		color: var(--fg);
		font: inherit;
		cursor: pointer;
	}

	.card[aria-selected='true'] {
		border-color: var(--amber);
		background: var(--amber-soft);
	}

	.thumb {
		position: relative;
		display: block;
		aspect-ratio: 16 / 10;
		background: var(--os-desk);
		border: var(--border);
		overflow: hidden;
	}

	.thumb i {
		position: absolute;
		box-sizing: border-box;
	}

	.other {
		border: var(--hair) solid var(--line);
		background: var(--raise);
		opacity: 0.6;
	}

	.me {
		display: grid;
		place-items: center;
		border: var(--hair) solid var(--amber-dim);
		background: var(--os-win-bg);
	}

	.me b {
		font-size: var(--fs-l);
		font-weight: var(--fw-regular);
	}

	.name {
		font-family: var(--mono);
		font-size: var(--fs-xs);
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
