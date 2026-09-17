<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import type { TableClient } from "$lib/connection/table-client.svelte.js";
  import { describeCombination, matchingOptions, rankLabel } from "$lib/game/play.js";
  import { WISH_RANKS, cardKey, type Card, type Decision, type Reactions } from "@tichu/engine";
  import type { Snippet } from "svelte";
  import Hand from "./Hand.svelte";

  let {
    client,
    seat,
    hand,
    decision,
    reactions,
    wish: pendingWish,
    selected = $bindable([]),
    handDisabled = false,
    sheet,
    actions,
  }: {
    client: TableClient;
    seat: number;
    hand: ReadonlyArray<Card>;
    decision: Decision | null;
    reactions: Reactions;
    /** The pending Wish, if any. */
    wish: number | null;
    selected?: Array<string>;
    handDisabled?: boolean;
    /** A Variant's own prompt above the Hand, shown when no Play needs a choice. */
    sheet?: Snippet;
    /** Extra buttons before Pass and Play, such as a Call. */
    actions?: Snippet;
  } = $props();

  const turnHint = $derived.by(() => {
    if (decision?._tag !== "Play") return "";
    const bound =
      pendingWish !== null &&
      decision.plays.length > 0 &&
      decision.plays.every((option) =>
        option.cards.some((card) => card._tag === "Normal" && card.rank === pendingWish),
      );
    if (bound) return `Your turn: you must play the wished ${rankLabel(pendingWish)}`;
    return decision.canPass ? "Your turn" : "Your lead";
  });

  const selectedCards = $derived(hand.filter((card) => selected.includes(cardKey(card))));
  // Forget selections of cards that left the Hand.
  $effect(() => {
    const held = new Set(hand.map(cardKey));
    if (selected.some((key) => !held.has(key))) selected = selected.filter((key) => held.has(key));
  });

  const playOptions = $derived(
    decision?._tag === "Play" ? matchingOptions(selectedCards, decision.plays) : [],
  );
  const bombOptions = $derived(
    decision?._tag === "Play" ? [] : matchingOptions(selectedCards, reactions.bombs),
  );
  let reading = $state(0);
  $effect(() => {
    if (reading >= playOptions.length) reading = 0;
  });
  const chosen = $derived(playOptions[reading]);
  const holdsMahJong = $derived(chosen?.cards.some((card) => card._tag === "MahJong") ?? false);
  let wish = $state<number | null>(null);

  const play = () => {
    if (decision?._tag !== "Play" || chosen === undefined) return;
    client.send({
      _tag: "Answer",
      decisionId: decision.id,
      command: {
        _tag: "Play",
        seat,
        cards: chosen.cards,
        ...(chosen.phoenixAs === undefined ? {} : { phoenixAs: chosen.phoenixAs }),
        ...(holdsMahJong && wish !== null ? { wish } : {}),
      },
    });
    selected = [];
    wish = null;
  };

  const pass = () => {
    if (decision?._tag !== "Play") return;
    client.send({ _tag: "Answer", decisionId: decision.id, command: { _tag: "Pass", seat } });
    selected = [];
  };

  const bomb = () => {
    const option = bombOptions[0];
    if (option === undefined) return;
    client.send({
      _tag: "React",
      seenSeq: client.seq,
      command: { _tag: "Play", seat, cards: option.cards },
    });
    selected = [];
  };
</script>

<div class="px-3">
  {#if decision?._tag === "Play" && (holdsMahJong || playOptions.length > 1)}
    <div class="mb-2 flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-neutral-900">
      {#if playOptions.length > 1}
        <span class="text-sm font-semibold">The Phoenix counts as:</span>
        <div class="flex flex-wrap gap-1">
          {#each playOptions as option, index (index)}
            <Button
              size="sm"
              variant={index === reading ? "default" : "outline"}
              onclick={() => (reading = index)}
            >
              {option.phoenixAs === undefined
                ? describeCombination(option)
                : rankLabel(option.phoenixAs)}
            </Button>
          {/each}
        </div>
      {/if}
      {#if holdsMahJong}
        <span class="text-sm font-semibold">Make a Wish:</span>
        <div class="flex flex-wrap gap-1">
          <Button
            size="xs"
            variant={wish === null ? "default" : "outline"}
            onclick={() => (wish = null)}
          >
            none
          </Button>
          {#each WISH_RANKS as rank (rank)}
            <Button
              size="xs"
              variant={wish === rank ? "default" : "outline"}
              onclick={() => (wish = rank)}
            >
              {rankLabel(rank)}
            </Button>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    {@render sheet?.()}
  {/if}
  {#if decision?._tag === "Play"}
    <p class="mb-1 text-center text-xs font-semibold text-[var(--gold)]">{turnHint}</p>
  {/if}
  {#if client.rejection}
    <p class="mb-1 text-center text-xs text-red-300" role="alert">{client.rejection}</p>
  {/if}
</div>

<div class="px-2">
  <Hand cards={hand} bind:selected disabled={handDisabled} />
</div>

<div class="flex gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
  {@render actions?.()}
  {#if bombOptions.length > 0}
    <Button class="flex-1 bg-red-700 text-white" onclick={bomb}>Bomb!</Button>
  {:else}
    <Button
      class="flex-1"
      variant="secondary"
      disabled={decision?._tag !== "Play" || !decision.canPass}
      onclick={pass}
    >
      Pass
    </Button>
    <Button
      class="flex-1 bg-[var(--gold)] text-neutral-900 hover:bg-[var(--gold)]/90"
      disabled={chosen === undefined}
      onclick={play}
    >
      {chosen === undefined ? "Play" : `Play ${describeCombination(chosen)}`}
    </Button>
  {/if}
</div>
