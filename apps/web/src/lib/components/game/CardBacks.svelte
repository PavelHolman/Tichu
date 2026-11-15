<script lang="ts">
  let { count, max = 6 }: { count: number; max?: number } = $props();
</script>

<div class="flex" aria-hidden="true">
  {#each Array.from({ length: Math.min(count, max) }) as _, index (index)}
    <div
      class="h-10 w-7 rounded-md border-2 border-amber-50 bg-[repeating-linear-gradient(45deg,#7a1f3d_0_4px,#5c1730_4px_8px)] shadow"
      style:margin-left={index === 0 ? "0" : "-18px"}
    ></div>
  {/each}
</div>
