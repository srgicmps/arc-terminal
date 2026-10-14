import type { FuelData } from '#lib/fuel.ts';
import type { PageLoad } from './$types';

// Vite mete data/fuel.json dentro de la web al construirla. Si el archivo no existe
// (en local, antes de ejecutar `pnpm fuel`), devuelve un objeto vacío en vez de fallar.
const files = import.meta.glob<FuelData>('/data/fuel.json', { eager: true, import: 'default' });

export const load: PageLoad = () => {
	return { fuel: files['/data/fuel.json'] ?? null };
};
