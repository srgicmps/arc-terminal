// Centro de paquetes en el navegador: el estado (un $state, como un ref() de Vue) guardado en arc-os-packages.
// La shell filtra sus listas con installedApps(); abrir por comando o ruta no mira esto.
import { APPS, type OsApp } from './apps.ts';
import * as pkg from './packages.ts';

export const packages = $state({ state: { removed: [] } as pkg.PackagesState });

// Se lee al cargar el módulo (no dentro de un $derived, donde Svelte no deja cambiar estado) y se escuchan los
// cambios de otra pestaña o de la cuenta.
if (typeof window !== 'undefined') {
	packages.state = pkg.parsePackages(read());
	addEventListener('storage', (e) => {
		if (e.key === pkg.PACKAGES_KEY) packages.state = pkg.parsePackages(e.newValue);
	});
}

function read() {
	try {
		return localStorage.getItem(pkg.PACKAGES_KEY);
	} catch {
		return null;
	}
}

function save(next: pkg.PackagesState) {
	if (next === packages.state) return;
	packages.state = next;
	try {
		localStorage.setItem(pkg.PACKAGES_KEY, JSON.stringify(next));
	} catch {
		// Sin sitio o en privado: vale para esta visita.
	}
}

export function isInstalled(id: string): boolean {
	return pkg.isInstalled(id, packages.state);
}

/** Las apps de la lista que están instaladas (para el menú Inicio, el lanzador, el buscador…). */
export function installedApps(list: OsApp[] = APPS): OsApp[] {
	return list.filter((a) => pkg.isInstalled(a.id, packages.state));
}

export function installApp(id: string) {
	save(pkg.install(id, packages.state));
}

export function removeApp(id: string) {
	save(pkg.remove(id, packages.state));
}

export { isEssential, ESSENTIAL } from './packages.ts';
