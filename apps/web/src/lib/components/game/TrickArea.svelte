<script lang="ts">
  import { describeCombination, rankLabel } from "$lib/game/play.js";
  import { trickHistory, type TrickEntry } from "$lib/game/names.js";
  import { cardKey } from "@tichu/engine";
  import PlayingCard from "./PlayingCard.svelte";

  let {
    trick,
    wish,
    name,
    idle,
  }: {
    trick: ReadonlyArray<TrickEntry>;
    wish: number | null;
    name: (seat: number) => string;
    /** What to show while the Trick is empty. */
    idle: string;
  } = $props();

  const top = $derived(trick.findLast((entry) => entry._tag === "Play"));
</script>

<div class="flex flex-col items-center gap-2 text-center text-xs">
  {#if wish !== null}
    <span class="rounded-full bg-violet-700 px-2 py-0.5 text-white">Wish: {rankLabel(wish)}</span>
  {/if}
  {#if top !== undefined}
    <div class="text-neutral-200">{name(top.seat)}: {describeCombination(top)}</div>
    <div class="flex">
      {#each top.cards as card, index (cardKey(card))}
        <PlayingCard {card} class="w-14 {index > 0 ? '-ml-6' : ''}" />
      {/each}
    </div>
    <div class="line-clamp-2 text-neutral-400">{trickHistory(trick, name)}</div>
  {:else}
    <div class="text-neutral-300">{idle}</div>
  {/if}
</div>
