import { onDestroy } from 'svelte';

export function onInterval(callback, milliseconds) {
	const interval = setInterval(callback, milliseconds);

	onDestroy(() => {
		clearInterval(interval);
	});
}

export function toggle(bool) {
  bool = !bool;
}

export function range(n){
  return Array(n).fill().map((_, i) => i);
}
