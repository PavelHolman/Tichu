<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import type { TableClient } from "$lib/connection/table-client.svelte.js";
  import { ovalPositions, rankTitles } from "$lib/game/hierarchy.js";
  import { cardCount, seatName } from "$lib/game/names.js";
  import { cardKey, type SeigneurObservation } from "@tichu/engine";
  import type { TableView } from "@tichu/protocol";
  import { onDestroy } from "svelte";
  import ConnectionBanner from "./ConnectionBanner.svelte";
  import PlayControls from "./PlayControls.svelte";
  import SeatPanel from "./SeatPanel.svelte";
  import TrickArea from "./TrickArea.svelte";

  let {
    client,
    table,
    observation,
  }: { client: TableClient; table: TableView; observation: SeigneurObservation } = $props();

  const me = $derived(observation.seat);
  const round = $derived(observation.round);
  const decision = $derived(observation.decision);
  const seats = $derived(observation.layout.seats);
  const titles = $derived(rankTitles(seats));
  const name = (seat: number) => seatName(table, seat, me);
  const isCreator = $derived(table.creator === me);

  /** Rank from 1 (Great Lord), or null before the first Round ends. */
  const rankOf = (seat: number): number | null => {
    const index = observation.hierarchy?.indexOf(seat) ?? -1;
    return index === -1 ? null : index + 1;
  };
  const titleOf = (seat: number): string | null => {
    const rank = rankOf(seat);
    return rank === null ? null : (titles[rank - 1] ?? null);
  };

  // The other Seats in play order, starting after me, around the upper oval.
  const others = $derived.by(() => {
    const order = round?.order ?? Array.from({ length: seats }, (_, seat) => seat);
    const start = order.indexOf(me);
    return Array.from(
      { length: order.length - 1 },
      (_, offset) => order[(start + offset + 1) % order.length] ?? 0,
    );
  });
  const positions = $derived(ovalPositions(others.length));

  let now = $state(Temporal.Now.instant().epochMilliseconds);
  const clock = setInterval(() => (now = Temporal.Now.instant().epochMilliseconds), 1000);
  onDestroy(() => clearInterval(clock));

  let selected = $state<Array<string>>([]);
  const hand = $derived(round?.hand ?? []);

  // The forced give is confirm-only: pre-select the engine's pick and highlight it.
  $effect(() => {
    if (decision?._tag === "ForcedGive") selected = decision.suggested.map(cardKey);
  });
  const returnReady = $derived(
    decision?._tag === "ReturnCards" && selected.length === decision.count,
  );
  const selectedCards = $derived(hand.filter((card) => selected.includes(cardKey(card))));

  const idle = $derived.by(() => {
    if (round === null) return "";
    if (round.phase === "giving") return "The lowest ranks give their best cards.";
    if (round.phase === "returning") return "The highest ranks return cards.";
    if (round.turn !== null) return round.turn === me ? "Your lead" : `${name(round.turn)} leads`;
    return "";
  });

  let hierarchy = $state<ReadonlyArray<number> | null>(null);
  $effect(() =>
    client.onEvent((event) => {
      if (event._tag === "HierarchySet") hierarchy = event.finishingOrder;
    }),
  );
</script>

<div class="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden select-none">
  <ConnectionBanner status={client.status} graceSeconds={table.settings.takeoverGraceSeconds} />

  <header class="flex items-center justify-between gap-2 bg-black/25 px-3 py-2 text-sm">
    <span>Round {round?.number ?? "-"}</span>
    <span class="font-semibold text-[var(--gold)]">{titleOf(me) ?? "Grand Seigneur"}</span>
    {#if isCreator}
      <Button size="xs" variant="ghost" onclick={() => client.send({ _tag: "Close" })}
        >Close Table</Button
      >
    {:else}
      <span class="text-neutral-400">{seats} Seats</span>
    {/if}
  </header>

  {#if round !== null}
    <div class="relative flex-1">
      {#each others as seat, index (seat)}
        {@const position = positions[index] ?? { left: 50, top: 10 }}
        {@const rank = rankOf(seat)}
        <div
          class="absolute -translate-x-1/2"
          style:left="{position.left}%"
          style:top="{position.top}%"
        >
          <SeatPanel
            name={name(seat)}
            occupant={table.seats[seat] ?? null}
            count={round.handCounts[seat] ?? 0}
            turn={round.turn === seat}
            out={round.finished.includes(seat)}
            waiting={(round.phase === "giving" || round.phase === "returning") &&
              round.pairs.some((pair) =>
                round.phase === "giving" ? pair.from === seat : pair.to === seat,
              ) &&
              round.submitted[seat] === false}
            badge={titleOf(seat)}
            badgeTone={rank === 1 ? "gold" : rank === seats ? "red" : "neutral"}
            status={round.finished.includes(seat)
              ? `out ${round.finished.indexOf(seat) + 1}.`
              : cardCount(round.handCounts[seat] ?? 0)}
            compact={seats > 6}
            {now}
          />
        </div>
      {/each}

      <div class="absolute inset-x-16 top-[58%]">
        <TrickArea trick={round.trick} wish={round.wish} {name} {idle} />
      </div>
    </div>

    <PlayControls
      {client}
      seat={me}
      {hand}
      {decision}
      reactions={observation.reactions}
      wish={round.wish}
      bind:selected
      handDisabled={decision?._tag === "ForcedGive"}
    >
      {#snippet sheet()}
        {#if decision?._tag === "ForcedGive"}
          <div class="mb-2 flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-neutral-900">
            <span class="text-sm font-semibold">
              Give your {decision.count} best {decision.count === 1 ? "card" : "cards"} to
              {name(decision.to)} ({titleOf(decision.to)}).
            </span>
            <Button
              onclick={() =>
                client.send({
                  _tag: "Answer",
                  decisionId: decision.id,
                  command: { _tag: "GiveBest", seat: me, cards: decision.suggested },
                })}
            >
              Give to {name(decision.to)}
            </Button>
          </div>
        {:else if decision?._tag === "ReturnCards"}
          <div class="mb-2 flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-neutral-900">
            <span class="text-sm font-semibold">
              Pick {decision.count}
              {decision.count === 1 ? "card" : "cards"} to return to
              {name(decision.to)} ({titleOf(decision.to)}). Selected {selected.length}.
            </span>
            <Button
              disabled={!returnReady}
              onclick={() =>
                client.send({
                  _tag: "Answer",
                  decisionId: decision.id,
                  command: { _tag: "ReturnCards", seat: me, cards: selectedCards },
                })}
            >
              Return {decision.count}
            </Button>
          </div>
        {:else if round.received.length > 0 && round.phase !== "playing"}
          <p class="mb-2 text-center text-xs text-neutral-300">
            You received {round.received.length}
            {round.received.length === 1 ? "card" : "cards"}.
          </p>
        {/if}
      {/snippet}
    </PlayControls>
  {/if}
</div>

<Dialog.Root
  open={hierarchy !== null}
  onOpenChange={(open) => {
    if (!open) hierarchy = null;
  }}
>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>The new hierarchy</Dialog.Title>
      <Dialog.Description>From the order in which everyone went out.</Dialog.Description>
    </Dialog.Header>
    <ol class="flex flex-col gap-1 text-sm">
      {#each hierarchy ?? observation.hierarchy ?? [] as seat, index (seat)}
        <li class="flex justify-between">
          <span class={seat === me ? "font-semibold text-[var(--gold)]" : ""}>{name(seat)}</span>
          <span class="text-neutral-400">{titles[index]}</span>
        </li>
      {/each}
    </ol>
    <Button onclick={() => (hierarchy = null)}>Next Round</Button>
  </Dialog.Content>
</Dialog.Root>
