<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import type { TableClient } from "$lib/connection/table-client.svelte.js";
  import type { TableView } from "@tichu/protocol";

  let { client, table, you }: { client: TableClient; table: TableView; you: number } = $props();

  const isCreator = $derived(table.creator === you);
  const full = $derived(table.seats.every((occupant) => occupant !== null));
  let copied = $state(false);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "Tichu", url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      copied = true;
    }
  };
</script>

<section class="flex flex-col gap-4">
  <div class="flex items-center justify-between gap-3 rounded-xl bg-black/25 p-4">
    <div class="text-sm">
      <div class="font-semibold">Invite friends</div>
      <div class="text-neutral-400">Anyone with the link can take a free Seat.</div>
    </div>
    <Button variant="outline" onclick={share}>{copied ? "Copied" : "Share link"}</Button>
  </div>

  <ul class="grid grid-cols-2 gap-3">
    {#each table.seats as occupant, seat (seat)}
      <li
        class="flex min-h-24 flex-col justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3"
        class:ring-2={seat === you}
        class:ring-amber-300={seat === you}
      >
        <div class="text-xs text-neutral-400">
          Seat {seat + 1} · Team {(seat % 2) + 1}{seat === you ? " · you" : ""}
        </div>
        {#if occupant === null}
          {#if isCreator}
            <div class="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="secondary"
                onclick={() => client.send({ _tag: "FillSeat", seat, tier: "heuristic" })}
              >
                + Bot
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onclick={() => client.send({ _tag: "FillSeat", seat, tier: "random" })}
              >
                + Easy Bot
              </Button>
            </div>
          {:else}
            <div class="text-sm text-neutral-400">Waiting for a Player…</div>
          {/if}
        {:else if occupant._tag === "Bot"}
          <div class="flex items-center justify-between">
            <span class="font-medium">🤖 {occupant.tier === "random" ? "Easy Bot" : "Bot"}</span>
            {#if isCreator}
              <Button
                size="xs"
                variant="ghost"
                onclick={() => client.send({ _tag: "EmptySeat", seat })}>Remove</Button
              >
            {/if}
          </div>
        {:else}
          <div class="flex items-center justify-between">
            <span class="font-medium">{occupant.nickname}</span>
            <span class="text-xs {occupant.connected ? 'text-emerald-300' : 'text-neutral-500'}">
              {occupant.connected ? "here" : "away"}
            </span>
          </div>
          {#if !occupant.connected && seat !== you}
            <Button
              size="xs"
              variant="ghost"
              onclick={() => client.send({ _tag: "ReleaseSeat", seat })}>Free this Seat</Button
            >
          {/if}
        {/if}
      </li>
    {/each}
  </ul>

  {#if isCreator}
    <Button
      size="lg"
      class="bg-[var(--gold)] text-neutral-900 hover:bg-[var(--gold)]/90"
      disabled={!full}
      onclick={() => client.send({ _tag: "Start" })}
    >
      {full ? "Start the Match" : "Fill every Seat to start"}
    </Button>
    <p class="text-center text-xs text-neutral-400">
      Playing to {table.settings.match.targetScore}.
    </p>
  {:else}
    <p class="text-center text-sm text-neutral-300">Waiting for the creator to start.</p>
  {/if}
</section>
