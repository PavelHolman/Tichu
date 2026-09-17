<script lang="ts">
  import type { ConnectionStatus } from "$lib/connection/table-client.svelte.js";

  let { status, graceSeconds }: { status: ConnectionStatus; graceSeconds: number } = $props();
</script>

{#if status === "reconnecting"}
  <div class="absolute inset-x-0 top-0 z-20 bg-red-800 px-2 py-1 text-center text-xs text-white">
    Connection lost, reconnecting… A Bot plays for you after {graceSeconds} s.
  </div>
{/if}
