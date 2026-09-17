<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { createTable } from "$lib/connection/api.js";
  import { defaultSeigneurSettings, type GameSettings } from "@tichu/engine";
  import { defaultTableSettings } from "@tichu/protocol";
  import { Effect } from "effect";

  let variant = $state<"Standard" | "GrandSeigneur">("Standard");
  let targetScore = $state(1000);
  let seats = $state(6);
  let decks = $state<1 | 2>(1);
  let creating = $state(false);
  let error = $state<string | null>(null);

  // Two Decks become the default from seven Seats, whenever the Seat count changes.
  const chooseSeats = (count: number) => {
    seats = count;
    decks = defaultSeigneurSettings(count).decks;
  };

  const game = $derived<GameSettings>(
    variant === "Standard"
      ? { _tag: "Standard", match: { targetScore } }
      : { _tag: "GrandSeigneur", match: { seats, decks } },
  );

  const create = async () => {
    creating = true;
    error = null;
    const result = await Effect.runPromise(
      Effect.result(createTable({ ...defaultTableSettings, game })),
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
      Start a Table, share the link with your friends, and let Bots take any empty Seat.
    </p>
  </header>

  <section class="flex flex-col gap-4 rounded-xl bg-black/25 p-5">
    <h2 class="font-semibold">New Table</h2>

    <div class="grid grid-cols-2 gap-2">
      <Button
        variant={variant === "Standard" ? "default" : "outline"}
        aria-pressed={variant === "Standard"}
        onclick={() => (variant = "Standard")}
      >
        Tichu (4)
      </Button>
      <Button
        variant={variant === "GrandSeigneur" ? "default" : "outline"}
        aria-pressed={variant === "GrandSeigneur"}
        onclick={() => (variant = "GrandSeigneur")}
      >
        Grand Seigneur
      </Button>
    </div>

    {#if variant === "Standard"}
      <div class="flex flex-col gap-2">
        <Label>Play to</Label>
        <div class="grid grid-cols-3 gap-2">
          {#each [500, 1000, 1500] as score (score)}
            <Button
              variant={targetScore === score ? "default" : "outline"}
              aria-pressed={targetScore === score}
              onclick={() => (targetScore = score)}
            >
              {score}
            </Button>
          {/each}
        </div>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        <Label>Seats</Label>
        <div class="grid grid-cols-4 gap-2">
          {#each [5, 6, 7, 8, 9, 10, 11, 12] as count (count)}
            <Button
              size="sm"
              variant={seats === count ? "default" : "outline"}
              aria-pressed={seats === count}
              onclick={() => chooseSeats(count)}
            >
              {count}
            </Button>
          {/each}
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <Label>Decks</Label>
        <div class="grid grid-cols-2 gap-2">
          {#each [1, 2] as const as count (count)}
            <Button
              size="sm"
              variant={decks === count ? "default" : "outline"}
              aria-pressed={decks === count}
              onclick={() => (decks = count)}
            >
              {count === 1 ? "One Deck" : "Two Decks"}
            </Button>
          {/each}
        </div>
      </div>
    {/if}

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
