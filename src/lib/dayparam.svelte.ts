// M49: «CAL viernes» o «WX sábado» en la barra llegan como ?dia=2026-10-16. La vista marca con `class:hl`
// las filas de ese día (estilo en ui/Table.svelte) y aquí se lleva la primera a la vista.
// La URL solo se lee en el navegador ($effect): las vistas se prerenderizan sin búsqueda.
import { page } from '$app/state';

/** Se llama al iniciar el componente de la vista. `day` es «AAAA-MM-DD» o null. */
export function dayParam() {
	const state = $state({ day: null as string | null });
	$effect(() => {
		state.day = page.url.searchParams.get('dia');
	});
	$effect(() => {
		if (!state.day) return;
		const frame = requestAnimationFrame(() => document.querySelector('tr.hl')?.scrollIntoView({ block: 'center' }));
		return () => cancelAnimationFrame(frame);
	});
	return state;
}
