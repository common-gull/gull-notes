<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { activeVault } from '$lib/stores/vault';
	import { t } from '$lib/i18n';
	import Button from '$lib/components/ui/button/button.svelte';
	import {
		ShieldCheckIcon,
		LockIcon,
		EyeOffIcon,
		DatabaseIcon,
		ArrowRightIcon
	} from 'lucide-svelte';

	// If already unlocked, redirect to vault
	onMount(() => {
		if ($activeVault) {
			goto(resolve('/vault'));
		}
	});
</script>

<div class="flex min-h-screen flex-col bg-background">
	<!-- Hero Section -->
	<div class="flex flex-1 flex-col items-center justify-center px-6 py-12">
		<div class="w-full max-w-2xl text-center">
			<div class="mb-4 inline-flex items-center gap-3">
				<h1
					class="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl"
				>
					{$t('common.appName')}
				</h1>
				<span
					class="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
				>
					{$t('landing.beta')}
				</span>
			</div>
			<p class="mb-8 text-xl text-muted-foreground">
				{$t('landing.tagline')}
			</p>

			<Button href={resolve('/vault/select')} size="lg" class="group mb-12 text-lg">
				{$t('landing.getStarted')}
				<ArrowRightIcon class="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
			</Button>
		</div>

		<!-- Feature Cards -->
		<div class="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
			<div class="rounded-xl border border-border bg-card/50 p-6">
				<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
					<LockIcon class="h-5 w-5 text-primary" />
				</div>
				<h3 class="mb-1 font-semibold">{$t('landing.features.encrypted.title')}</h3>
				<p class="text-sm text-muted-foreground">{$t('landing.features.encrypted.description')}</p>
			</div>

			<div class="rounded-xl border border-border bg-card/50 p-6">
				<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
					<DatabaseIcon class="h-5 w-5 text-primary" />
				</div>
				<h3 class="mb-1 font-semibold">{$t('landing.features.local.title')}</h3>
				<p class="text-sm text-muted-foreground">{$t('landing.features.local.description')}</p>
			</div>

			<div class="rounded-xl border border-border bg-card/50 p-6">
				<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
					<EyeOffIcon class="h-5 w-5 text-primary" />
				</div>
				<h3 class="mb-1 font-semibold">{$t('landing.features.zeroKnowledge.title')}</h3>
				<p class="text-sm text-muted-foreground">
					{$t('landing.features.zeroKnowledge.description')}
				</p>
			</div>
		</div>
	</div>

	<!-- Footer with encryption details -->
	<footer class="border-t border-border bg-muted/30 px-6 py-6">
		<div class="mx-auto max-w-4xl space-y-3">
			<div class="flex items-start gap-3">
				<ShieldCheckIcon class="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
				<div class="text-sm text-muted-foreground">
					<p class="mb-1 font-medium text-foreground">{$t('landing.encryption.title')}</p>
					<p>{$t('landing.encryption.description')}</p>
				</div>
			</div>
			<p class="text-center text-xs text-muted-foreground/70">
				{$t('landing.disclaimer')}
			</p>
		</div>
	</footer>
</div>
