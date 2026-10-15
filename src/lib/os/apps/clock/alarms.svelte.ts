// Las alarmas en el navegador: la lista (un $state, como un ref() de Vue) y un reloj que mira cada 5 s (y al volver
// a la pestaña) si tocaba alguna desde la última vez (dueBetween: no se pierden si el navegador frena el reloj).
// Arranca con Arc OS (reloj.ts), no solo al abrir el Reloj. Al sonar: un pitido (Web Audio, sin archivos), una notificación del sistema si se ha dado permiso y el
// aviso de Arc OS (os.notice). Solo suenan con Arc OS abierto, como en cualquier web.
import { os } from '../../os.svelte.ts';
import { readJson, writeJson } from '../kit/store.ts';
import { ALARMS_KEY, dueBetween, isAlarms, MAX_ALARMS, type Alarm } from './alarms.ts';

export const alarms = $state({ list: [] as Alarm[], ringing: null as Alarm | null });

let started = false;
let last = new Date();

export function startAlarms() {
	if (started || typeof window === 'undefined') return;
	started = true;
	alarms.list = readJson(ALARMS_KEY, [], isAlarms);
	// Si otro dispositivo (o la nube) cambia la lista, se vuelve a leer.
	addEventListener('storage', (e) => {
		if (e.key === ALARMS_KEY) alarms.list = readJson(ALARMS_KEY, [], isAlarms);
	});
	last = new Date();
	setInterval(tick, 5_000);
	document.addEventListener('visibilitychange', tick);
}

function tick() {
	const now = new Date();
	// Si el reloj del sistema va hacia atrás (cambio de hora a mano), se empieza a contar desde ahora.
	const from = now < last ? now : last;
	last = now;
	for (const a of dueBetween(alarms.list, from, now)) ring(a);
}

function save() {
	writeJson(ALARMS_KEY, $state.snapshot(alarms.list));
}

export function addAlarm(time: string, label: string, days: number[]) {
	if (alarms.list.length >= MAX_ALARMS) return;
	alarms.list.push({ id: Math.random().toString(36).slice(2, 10), time, label: label.slice(0, 60), on: true, days: [...days] });
	alarms.list.sort((x, y) => x.time.localeCompare(y.time));
	save();
}

export function toggleAlarm(id: string) {
	const a = alarms.list.find((x) => x.id === id);
	if (a) (a.on = !a.on), save();
}

export function removeAlarm(id: string) {
	alarms.list = alarms.list.filter((x) => x.id !== id);
	save();
}

export function beep(times = 3) {
	try {
		const ctx = new AudioContext();
		for (let i = 0; i < times; i++) {
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.frequency.value = 880;
			g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.5);
			g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.5 + 0.35);
			o.connect(g).connect(ctx.destination);
			o.start(ctx.currentTime + i * 0.5);
			o.stop(ctx.currentTime + i * 0.5 + 0.4);
		}
		setTimeout(() => void ctx.close(), times * 500 + 200);
	} catch {
		// Sin audio: queda el aviso.
	}
}

export function notifySystem(text: string) {
	try {
		if ('Notification' in window && Notification.permission === 'granted') new Notification('Arc OS', { body: text });
	} catch {}
}

function ring(a: Alarm) {
	const text = `⏰ ${a.time}${a.label ? ` · ${a.label}` : ''}`;
	alarms.ringing = a;
	os.notice = { text, at: Date.now() };
	beep();
	notifySystem(text);
	if (!a.days.length) toggleAlarm(a.id);
}
