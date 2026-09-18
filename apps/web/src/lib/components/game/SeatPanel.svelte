<script lang="ts">
  import type { Occupant } from "@tichu/protocol";
  import CardBacks from "./CardBacks.svelte";

  let {
    name,
    occupant,
    count,
    turn,
    out = false,
    waiting = false,
    badge = null,
    badgeTone = "violet",
    status,
    now,
    compact = false,
    onFree,
    onHandToBot,
  }: {
    name: string;
    occupant: Occupant | null;
    count: number;
    turn: boolean;
    out?: boolean;
    waiting?: boolean;
    /** A short label beside the name: a Call, or a hierarchy title. */
    badge?: string | null;
    badgeTone?: "violet" | "red" | "gold" | "neutral";
    status: string;
    now: number;
    /** Drops the card backs for crowded Tables. */
    compact?: boolean;
    /** Offered while the Player is away: free the Seat for someone else, or let a Bot keep it. */
    onFree?: () => void;
    onHandToBot?: () => void;
  } = $props();

  const TONES = {
    violet: "bg-violet-700 text-white",
    red: "bg-red-800 text-white",
    gold: "bg-[var(--gold)] text-neutral-900",
    neutral: "bg-white/15 text-neutral-100",
  } as const;

  const away = $derived(occupant?._tag === "Player" && !occupant.connected);
  const takeoverIn = $derived(
    occupant?._tag === "Player" && occupant.takeoverAt !== null
      ? Math.max(0, Math.ceil((occupant.takeoverAt - now) / 1000))
      : null,
  );
</script>

<div class="flex flex-col items-center gap-1 text-xs" class:opacity-50={out}>
  {#if !compact}<CardBacks {count} />{/if}
  <div class="flex max-w-28 items-center gap-1">
    <span class="truncate font-semibold {turn ? 'text-[var(--gold)]' : ''}">
      {occupant?._tag === "Bot" ? "🤖 " : ""}{name}
    </span>
  </div>
  {#if badge !== null}
    <span class="rounded-full px-1.5 py-px text-[10px] {TONES[badgeTone]}">{badge}</span>
  {/if}
  <div class="flex flex-col items-center text-center text-neutral-300">
    <span>{status}</span>
    {#if turn}<span class="text-[var(--gold)]">to play</span>{/if}
    {#if waiting}<span class="text-neutral-400">deciding</span>{/if}
  </div>
  {#if away}
    <div class="text-[10px] text-red-300">
      away{takeoverIn !== null && takeoverIn > 0
        ? ` · Bot in ${takeoverIn}s`
        : takeoverIn === 0
          ? " · Bot playing"
          : ""}
    </div>
    {#if onFree || onHandToBot}
      <div class="flex gap-1">
        {#if onFree}
          <button
            type="button"
            class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] hover:bg-white/20"
            onclick={onFree}
          >
            Free Seat
          </button>
        {/if}
        {#if onHandToBot}
          <button
            type="button"
            class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] hover:bg-white/20"
            onclick={onHandToBot}
          >
            Bot plays
          </button>
        {/if}
      </div>
    {/if}
  {/if}
</div>
