<div class="w-full space-y-1">
	{#each Array(5) as _, i (i)}
		<div class="w-full px-3 py-2 rounded-md animate-pulse">
			<div class="flex flex-col gap-1">
				<div class="h-4 bg-muted rounded w-3/4"></div>
				<div class="flex items-center justify-between">
					<div class="h-3 bg-muted rounded w-16"></div>
					<div class="flex gap-1">
						<div class="h-5 bg-muted rounded w-12"></div>
						<div class="h-5 bg-muted rounded w-12"></div>
					</div>
				</div>
			</div>
		</div>
	{/each}
</div>

