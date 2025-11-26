import { writable } from 'svelte/store';
import { lockVault, activeVault } from './vault';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

interface InactivityState {
	lastActivity: number;
	timeoutMinutes: number;
	isMonitoring: boolean;
}

const initialState: InactivityState = {
	lastActivity: Date.now(),
	timeoutMinutes: 0,
	isMonitoring: false
};

const inactivityState = writable<InactivityState>(initialState);

let checkInterval: ReturnType<typeof setInterval> | null = null;
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds

/**
 * Reset activity timestamp
 */
export function resetActivity(): void {
	inactivityState.update((state) => ({
		...state,
		lastActivity: Date.now()
	}));
}

/**
 * Start monitoring inactivity
 * @param timeoutMinutes Minutes until auto-lock (0 = disabled)
 */
export function startMonitoring(timeoutMinutes: number): void {
	// Stop existing monitoring first
	stopMonitoring();

	// If timeout is 0 (disabled), don't start monitoring
	if (timeoutMinutes <= 0) {
		return;
	}

	inactivityState.set({
		lastActivity: Date.now(),
		timeoutMinutes,
		isMonitoring: true
	});

	// Setup interval to check for inactivity
	checkInterval = setInterval(() => {
		inactivityState.update((state) => {
			if (!state.isMonitoring || state.timeoutMinutes <= 0) {
				return state;
			}

			const now = Date.now();
			const inactiveMs = now - state.lastActivity;
			const timeoutMs = state.timeoutMinutes * 60 * 1000;

			if (inactiveMs >= timeoutMs) {
				// Inactivity timeout reached - lock vault
				handleInactivityLock();
			}

			return state;
		});
	}, CHECK_INTERVAL_MS);
}

/**
 * Stop monitoring inactivity
 */
export function stopMonitoring(): void {
	if (checkInterval) {
		clearInterval(checkInterval);
		checkInterval = null;
	}

	inactivityState.set({
		...initialState,
		isMonitoring: false
	});
}

/**
 * Handle inactivity lock
 */
function handleInactivityLock(): void {
	stopMonitoring();

	// Get current vault before locking
	let currentVaultId: string | null = null;
	const unsubscribe = activeVault.subscribe((vault) => {
		currentVaultId = vault?.id || null;
	});
	unsubscribe();

	// Lock the vault
	lockVault();

	// Redirect to unlock page with vault pre-selected
	if (currentVaultId) {
		goto(resolve('/vault/unlock'));
	} else {
		goto(resolve('/vault/select'));
	}
}

export const inactivity = {
	subscribe: inactivityState.subscribe,
	resetActivity,
	startMonitoring,
	stopMonitoring
};
