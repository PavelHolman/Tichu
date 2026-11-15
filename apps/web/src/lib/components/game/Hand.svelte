<script lang="ts">
  import { cardKey, type Card } from "@tichu/engine";
  import PlayingCard from "./PlayingCard.svelte";

  let {
    cards,
    selected = $bindable([]),
    disabled = false,
  }: { cards: ReadonlyArray<Card>; selected?: Array<string>; disabled?: boolean } = $props();

  let width = $state(360);
  const CARD_WIDTH = 66;
  /** Overlap so the whole Hand fits in one row, never wider than a comfortable spread. */
  const step = $derived(
    cards.length <= 1
      ? 0
      : Math.min(40, Math.max(18, (width - CARD_WIDTH - 16) / (cards.length - 1))),
  );
  const offset = $derived((width - (CARD_WIDTH + step * Math.max(cards.length - 1, 0))) / 2);

  const toggle = (card: Card) => {
    if (disabled) return;
    const key = cardKey(card);
    selected = selected.includes(key)
      ? selected.filter((held) => held !== key)
      : [...selected, key];
  };
</script>

<div class="relative h-[118px] w-full" bind:clientWidth={width}>
  {#each cards as card, index (cardKey(card))}
    {@const lifted = selected.includes(cardKey(card))}
    <button
      type="button"
      class="absolute bottom-0 w-[66px] transition-transform duration-100 focus-visible:outline-2 focus-visible:outline-amber-300"
      class:lifted
      style:left="{offset + index * step}px"
      style:z-index={index}
      aria-pressed={lifted}
      onclick={() => toggle(card)}
    >
      <PlayingCard {card} />
    </button>
  {/each}
</div>

<style>
  .lifted {
    transform: translateY(-20px);
    filter: drop-shadow(0 0 6px var(--gold));
  }
</style>
