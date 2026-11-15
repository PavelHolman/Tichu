<script lang="ts">
  import type { Card } from "@tichu/engine";
  import { rankLabel } from "$lib/game/play.js";

  let { card, class: className = "" }: { card: Card; class?: string } = $props();

  const SUIT_COLOURS = {
    jade: "var(--suit-jade)",
    sword: "var(--suit-sword)",
    pagoda: "var(--suit-pagoda)",
    star: "var(--suit-star)",
  } as const;

  const colour = $derived(card._tag === "Normal" ? SUIT_COLOURS[card.suit] : "var(--suit-special)");
  const corner = $derived.by(() => {
    switch (card._tag) {
      case "Normal":
        return rankLabel(card.rank);
      case "MahJong":
        return "1";
      case "Dog":
        return "D";
      case "Phoenix":
        return "P";
      case "Dragon":
        return "Dr";
    }
  });
  const title = $derived.by(() => {
    switch (card._tag) {
      case "Normal":
        return `${rankLabel(card.rank)} of ${card.suit}`;
      case "MahJong":
        return "Mah Jong";
      default:
        return card._tag;
    }
  });
</script>

<svg class="block {className}" viewBox="0 0 100 140" role="img" aria-label={title}>
  <rect
    x="2"
    y="2"
    width="96"
    height="136"
    rx="12"
    fill={colour}
    stroke="rgb(0 0 0 / 0.25)"
    stroke-width="2"
  />
  <text x="10" y="30" font-size={corner.length > 1 ? 21 : 25} font-weight="800" fill="#fff"
    >{corner}</text
  >
  {#if card._tag === "Normal"}
    <text
      x="58"
      y="104"
      text-anchor="middle"
      font-size="46"
      font-weight="800"
      fill="#fff"
      opacity="0.95"
    >
      {rankLabel(card.rank)}
    </text>
  {:else}
    <g transform="translate(58,84) scale(1.6)" fill="#fff" stroke="#fff">
      {#if card._tag === "MahJong"}
        <circle r="14" fill="none" stroke-width="3" />
        <path d="M-8 3 L-2 -6 L4 2 L9 -4" fill="none" stroke-width="3" stroke-linecap="round" />
      {:else if card._tag === "Dog"}
        <circle cx="-7" cy="-8" r="3.5" stroke="none" />
        <circle cx="0" cy="-11" r="3.5" stroke="none" />
        <circle cx="7" cy="-8" r="3.5" stroke="none" />
        <ellipse cx="0" cy="4" rx="9" ry="7" stroke="none" />
      {:else if card._tag === "Phoenix"}
        <path d="M0 14 C-14 6 -10 -8 -2 -14 C-1 -6 4 -6 4 -12 C12 -4 10 8 0 14 Z" stroke="none" />
      {:else}
        <path d="M-12 8 C-12 -6 -2 -14 10 -10 L6 -4 L12 0 L4 2 L8 10 L-2 6 Z" stroke="none" />
      {/if}
    </g>
  {/if}
</svg>
