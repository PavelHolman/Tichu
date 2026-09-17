<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { createTable } from "$lib/connection/api.js";
  import { defaultTableSettings } from "@tichu/protocol";
  import { Effect } from "effect";

  let targetScore = $state(1000);
  let creating = $state(false);
  let error = $state<string | null>(null);

  const create = async () => {
    creating = true;
    error = null;
    const result = await Effect.runPromise(
      Effect.result(createTable({ ...defaultTableSettings, match: { targetScore } })),
    );
    creating = false;
    if (result._tag === "Failure") error = result.failure.message;
    else await goto(`/t/${result.success.tableId}`);
  };
</script>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-10">
  <header class="flex flex-col items-center gap-3 text-center">
    <img src="/icon.svg" alt="" class="size-20" />
    <h1 class="text-4xl font-bold tracking-tight">Tichu</h1>
    <p class="text-sm text-neutral-300">
      Start a Table, share the link with three friends, and let Bots take any empty Seat.
    </p>
  </header>

  <section class="flex flex-col gap-4 rounded-xl bg-black/25 p-5">
    <h2 class="font-semibold">New Table</h2>
    <div class="flex flex-col gap-2">
      <Label for="target">Play to</Label>
      <div id="target" class="grid grid-cols-3 gap-2">
        {#each [500, 1000, 1500] as score (score)}
          <Button
            variant={targetScore === score ? "default" : "outline"}
            onclick={() => (targetScore = score)}
            aria-pressed={targetScore === score}
          >
            {score}
          </Button>
        {/each}
      </div>
    </div>
    <Button
      size="lg"
      class="bg-[var(--gold)] text-neutral-900 hover:bg-[var(--gold)]/90"
      disabled={creating}
      onclick={create}
    >
      {creating ? "Creating…" : "Create Table"}
    </Button>
    {#if error}<p class="text-sm text-red-300" role="alert">{error}</p>{/if}
  </section>
</main>
