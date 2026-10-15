<!--
	Icono de app de Arc OS: azulejo con degradado, brillo sutil arriba y dibujo blanco (glyphs.ts). Las esquinas y la
	sombra las pone el aspecto (--os-icon-radius, --os-icon-shadow). Sin label es decorativo (aria-hidden).
-->
<script lang="ts">
	import { iconOf, INK } from './glyphs.ts';

	let { id, size = 48, label }: { id: string; size?: number; label?: string } = $props();

	const uid = $props.id();
	const g = $derived(iconOf(id));
	// En tamaños pequeños el dibujo ocupa más del azulejo y el trazo es algo más grueso, para que se lea.
	const small = $derived(size <= 24);
	const scale = $derived(small ? 0.74 : 0.62);
	const shift = $derived((24 - 24 * scale) / 2);
	const stroke = $derived(small ? 2 : 1.7);
</script>

<span
	class="os-icon"
	class:bare={g.bare}
	style:width={`${size}px`}
	style:height={`${size}px`}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	<span class="tile"><svg viewBox="0 0 24 24" width={size} height={size} focusable="false">
		<defs>
			<linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0.35" y2="1">
				<stop offset="0" stop-color={g.hue[0]} />
				<stop offset="1" stop-color={g.hue[1]} />
			</linearGradient>
			<linearGradient id={`${uid}-sh`} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color={INK} stop-opacity="0.18" />
				<stop offset="1" stop-color={INK} stop-opacity="0" />
			</linearGradient>
		</defs>
		{#if g.bare}
			<path d={g.d} fill={g.hue[1]} />
			{#if g.f}<path d={g.f} fill={`url(#${uid}-bg)`} />{/if}
			{#if g.f}<path d={g.f} fill={`url(#${uid}-sh)`} />{/if}
		{:else}
			<rect width="24" height="24" fill={`url(#${uid}-bg)`} />
			<rect width="24" height="12" fill={`url(#${uid}-sh)`} />
			<g transform={`translate(${shift} ${shift}) scale(${scale})`}>
				{#if g.d}<path d={g.d} fill="none" stroke={INK} stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" />{/if}
				{#if g.f}<path d={g.f} fill={INK} />{/if}
			</g>
		{/if}
	</svg></span>
</span>

<style>
	.os-icon {
		display: inline-block;
		flex: none;
		line-height: 0;
		filter: drop-shadow(var(--os-icon-shadow));
		vertical-align: middle;
	}
	.tile {
		display: block;
		overflow: hidden;
		border-radius: var(--os-icon-radius, var(--radius));
	}
	.bare .tile {
		overflow: visible;
		border-radius: 0;
	}
	svg {
		display: block;
	}
</style>
