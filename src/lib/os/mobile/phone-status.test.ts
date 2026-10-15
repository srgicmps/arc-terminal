// La barra de estado del teléfono no inventa cobertura, wifi ni batería (en un iPhone duplicaban las del sistema).
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('PhoneStatus: solo la hora y el centro de control', () => {
	const src = readFileSync(new URL('./PhoneStatus.svelte', import.meta.url), 'utf8').split('<style>')[0];
	expect(src.match(/<svg/g)).toHaveLength(1);
	expect(src).not.toMatch(/class="bat"/);
	expect(src).toMatch(/aria-label="Centro de control"/);
});
