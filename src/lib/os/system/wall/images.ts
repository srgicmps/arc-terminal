// Imágenes propias de los fondos de Arc OS: se guardan comprimidas en IndexedDB (base «arc-os-images»), solo en
// este navegador. No se sincronizan con la cuenta: una foto pesa cientos de KB y los ajustes de D1 van con topes
// pequeños (la app lo dice). Todo falla en silencio: sin IndexedDB (modo privado), simplemente no hay imágenes.
import { fitSize } from './wall.ts';

const DB = 'arc-os-images';
const STORE = 'images';
/** Tope por imagen ya comprimida y número máximo de imágenes guardadas. */
export const MAX_BYTES = 3_000_000;
export const MAX_IMAGES = 24;

export interface StoredImage {
	id: string;
	name: string;
	blob: Blob;
	/** Miniatura pequeña para la galería. */
	thumb: Blob;
	w: number;
	h: number;
	added: string;
}

function db(): Promise<IDBDatabase> {
	return new Promise((ok, ko) => {
		const r = indexedDB.open(DB, 1);
		r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
		r.onsuccess = () => ok(r.result);
		r.onerror = () => ko(r.error);
	});
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const d = await db();
	return new Promise((ok, ko) => {
		const t = d.transaction(STORE, mode);
		const r = run(t.objectStore(STORE));
		r.onsuccess = () => ok(r.result);
		r.onerror = () => ko(r.error);
		// Cerrar al acabar: si no, borrar la base (otro usuario entra en este navegador, cloud.svelte.ts) se queda esperando.
		t.oncomplete = t.onabort = t.onerror = () => d.close();
	});
}

export const listImages = () => tx<StoredImage[]>('readonly', (s) => s.getAll()).catch(() => [] as StoredImage[]);
export const getImage = (id: string) => tx<StoredImage | undefined>('readonly', (s) => s.get(id)).catch(() => undefined);
export const deleteImage = (id: string) => tx('readwrite', (s) => s.delete(id)).catch(() => undefined);

/** Redibuja la imagen en un canvas al tamaño dado y la saca como WebP (o JPEG si el navegador no sabe). */
async function encode(bmp: ImageBitmap, w: number, h: number, quality: number): Promise<Blob> {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
	const as = (type: string) => new Promise<Blob | null>((ok) => c.toBlob(ok, type, quality));
	const blob = (await as('image/webp')) ?? (await as('image/jpeg'));
	if (!blob) throw new Error('No se pudo comprimir la imagen');
	return blob;
}

/** Comprime y guarda una imagen elegida o arrastrada. Devuelve su id, o un error legible. */
export async function addImage(file: File): Promise<{ id: string } | { error: string }> {
	if (!file.type.startsWith('image/')) return { error: 'Eso no es una imagen.' };
	try {
		const list = await listImages();
		if (list.length >= MAX_IMAGES) return { error: `Caben ${MAX_IMAGES} imágenes: borra alguna antes.` };
		const bmp = await createImageBitmap(file);
		const size = fitSize(bmp.width, bmp.height);
		let blob = await encode(bmp, size.w, size.h, 0.82);
		if (blob.size > MAX_BYTES) blob = await encode(bmp, Math.round(size.w * 0.7), Math.round(size.h * 0.7), 0.7);
		const t = fitSize(bmp.width, bmp.height, 320);
		const thumb = await encode(bmp, t.w, t.h, 0.7);
		bmp.close();
		const id = `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
		const img: StoredImage = { id, name: file.name.slice(0, 80), blob, thumb, w: size.w, h: size.h, added: new Date().toISOString() };
		await tx('readwrite', (s) => s.put(img));
		return { id };
	} catch {
		return { error: 'No se pudo guardar la imagen en este navegador.' };
	}
}

/** URLs de las imágenes (object URLs), una por id y reutilizadas. */
const urls = new Map<string, string>();
export async function imageUrl(id: string, thumb = false): Promise<string | null> {
	const key = thumb ? `${id}:t` : id;
	const hit = urls.get(key);
	if (hit) return hit;
	const img = await getImage(id);
	if (!img) return null;
	const u = URL.createObjectURL(thumb ? img.thumb : img.blob);
	urls.set(key, u);
	return u;
}
export function forgetUrl(id: string) {
	for (const k of [id, `${id}:t`]) {
		const u = urls.get(k);
		if (u) URL.revokeObjectURL(u);
		urls.delete(k);
	}
}
