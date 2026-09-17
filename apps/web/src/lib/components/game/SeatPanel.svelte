<script lang="ts">
  import type { Occupant } from "@tichu/protocol";
  import CardBacks from "./CardBacks.svelte";

  let {
    name,
    occupant,
    count,
    call,
    turn,
    place,
    waiting,
    now,
  }: {
    name: string;
    occupant: Occupant | null;
    count: number;
    call: "none" | "tichu" | "grandTichu";
    turn: boolean;
    place: number | null;
    waiting: boolean;
    now: number;
  } = $props();

  const away = $derived(occupant?._tag === "Player" && !occupant.connected);
  const takeoverIn = $derived(
    occupant?._tag === "Player" && occupant.takeoverAt !== null
      ? Math.max(0, Math.ceil((occupant.takeoverAt - now) / 1000))
      : null,
  );
</script>

<div class="flex flex-col items-center gap-1 text-xs">
  <CardBacks {count} />
  <div class="flex items-center gap-1">
    <span class="font-semibold {turn ? 'text-[var(--gold)]' : ''}">
      {occupant?._tag === "Bot" ? "🤖 " : ""}{name}
    </span>
    {#if call !== "none"}
      <span
        class="rounded-full px-1.5 py-px text-[10px] text-white {call === 'grandTichu'
          ? 'bg-red-800'
          : 'bg-violet-700'}"
      >
        {call === "grandTichu" ? "Grand Tichu" : "Tichu"}
      </span>
    {/if}
  </div>
  <div class="text-neutral-300">
    {#if place !== null}
      out {place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"}
    {:else}
      {count} cards
    {/if}
    {#if turn}<span class="text-[var(--gold)]"> · to play</span>{/if}
    {#if waiting}<span class="text-neutral-400"> · deciding</span>{/if}
  </div>
  {#if away}
    <div class="text-[10px] text-red-300">
      away{takeoverIn !== null && takeoverIn > 0
        ? ` · Bot in ${takeoverIn}s`
        : takeoverIn === 0
          ? " · Bot playing"
          : ""}
    </div>
  {/if}
</div>
