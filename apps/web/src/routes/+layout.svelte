<script lang="ts">
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>Tichu</title>
</svelte:head>

<div class="min-h-dvh bg-[var(--felt)] text-neutral-100">
  {@render children()}
</div>
