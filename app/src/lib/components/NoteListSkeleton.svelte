<div class="w-full space-y-1">
	{#each Array.from({ length: 5 }, (_, i) => i) as i (i)}
		<div class="w-full animate-pulse rounded-md px-3 py-2">
			<div class="flex flex-col gap-1">
				<div class="h-4 w-3/4 rounded bg-muted"></div>
				<div class="flex items-center justify-between">
					<div class="h-3 w-16 rounded bg-muted"></div>
					<div class="flex gap-1">
						<div class="h-5 w-12 rounded bg-muted"></div>
						<div class="h-5 w-12 rounded bg-muted"></div>
					</div>
				</div>
			</div>
		</div>
	{/each}
</div>
