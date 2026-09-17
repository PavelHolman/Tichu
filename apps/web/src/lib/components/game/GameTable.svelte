<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import type { TableClient } from "$lib/connection/table-client.svelte.js";
  import { cardCount, seatName } from "$lib/game/names.js";
  import { ringPositions } from "$lib/game/play.js";
  import { cardKey, type Card, type RoundEnded, type StandardObservation } from "@tichu/engine";
  import type { TableView } from "@tichu/protocol";
  import { onDestroy } from "svelte";
  import ConnectionBanner from "./ConnectionBanner.svelte";
  import PlayControls from "./PlayControls.svelte";
  import PlayingCard from "./PlayingCard.svelte";
  import SeatPanel from "./SeatPanel.svelte";
  import TrickArea from "./TrickArea.svelte";

  let {
    client,
    table,
    observation,
  }: { client: TableClient; table: TableView; observation: StandardObservation } = $props();

  const me = $derived(observation.seat);
  const round = $derived(observation.round);
  const decision = $derived(observation.decision);
  const ring = $derived(ringPositions(observation.layout.seats, me));
  const myTeam = $derived(observation.layout.teams.findIndex((team) => team.includes(me)));
  const name = (seat: number) => seatName(table, seat, me);
  const isCreator = $derived(table.creator === me);
  const teamLabel = (team: number) => (team === myTeam ? "Us" : "Them");

  // A ticking clock for takeover countdowns.
  let now = $state(Temporal.Now.instant().epochMilliseconds);
  const clock = setInterval(() => (now = Temporal.Now.instant().epochMilliseconds), 1000);
  onDestroy(() => clearInterval(clock));

  let selected = $state<Array<string>>([]);
  const hand = $derived(round?.hand ?? []);

  // Exchange: tap a card, then the Seat that receives it.
  let gives = $state<Record<number, string>>({});
  $effect(() => {
    if (decision?._tag !== "Exchange" && Object.keys(gives).length > 0) gives = {};
  });
  const cardByKey = (key: string | undefined): Card | undefined =>
    hand.find((card) => cardKey(card) === key);
  const assign = (seat: number) => {
    const key = selected[0];
    if (key === undefined) return;
    const others = Object.fromEntries(Object.entries(gives).filter(([, held]) => held !== key));
    gives = { ...others, [seat]: key };
    selected = [];
  };
  const exchangeReady = $derived(
    decision?._tag === "Exchange" &&
      decision.to.every((seat) => cardByKey(gives[seat]) !== undefined),
  );
  const exchange = () => {
    if (decision?._tag !== "Exchange" || !exchangeReady) return;
    client.send({
      _tag: "Answer",
      decisionId: decision.id,
      command: {
        _tag: "Exchange",
        seat: me,
        gives: decision.to.map((to) => ({ to, card: cardByKey(gives[to]) as Card })),
      },
    });
  };

  const idle = $derived.by(() => {
    if (round === null) return "";
    if (round.pendingGift !== null) {
      return `${name(round.pendingGift)} won with the Dragon and is giving the Trick away.`;
    }
    if (round.phase === "grandTichu") return "Eight cards dealt. Grand Tichu?";
    if (round.phase === "exchange") return "Exchange: give one card to each Player.";
    if (round.turn !== null) return round.turn === me ? "Your lead" : `${name(round.turn)} leads`;
    return "";
  });

  let summary = $state<RoundEnded | null>(null);
  $effect(() =>
    client.onEvent((event) => {
      if (event._tag === "RoundEnded") summary = event;
    }),
  );
</script>

<div class="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden select-none">
  <ConnectionBanner status={client.status} graceSeconds={table.settings.takeoverGraceSeconds} />

  <header class="flex items-center justify-between bg-black/25 px-3 py-2 text-sm">
    <span>Round {round?.number ?? "-"}</span>
    <span>
      {#each observation.totals as total, team (team)}
        <span class={team === myTeam ? "font-bold text-[var(--gold)]" : ""}>
          {teamLabel(team)}
          {total}
        </span>
        {#if team < observation.totals.length - 1}<span class="text-neutral-500"> · </span>{/if}
      {/each}
    </span>
    <span class="text-neutral-400">to {observation.settings.targetScore}</span>
  </header>

  {#if round !== null}
    <div class="relative flex-1">
      {#each [["top", ring.top], ["left", ring.left], ["right", ring.right]] as const as [position, seat] (position)}
        {@const call = round.calls[seat] ?? "none"}
        <div
          class="absolute"
          class:top-2={position === "top"}
          class:left-1={position === "left"}
          class:right-1={position === "right"}
          class:top-24={position !== "top"}
          class:inset-x-0={position === "top"}
          class:flex={position === "top"}
          class:justify-center={position === "top"}
        >
          <SeatPanel
            name={name(seat)}
            occupant={table.seats[seat] ?? null}
            count={round.handCounts[seat] ?? 0}
            turn={round.turn === seat || round.pendingGift === seat}
            out={round.finished.includes(seat)}
            waiting={(round.phase === "grandTichu" || round.phase === "exchange") &&
              round.decided[seat] === false}
            badge={call === "none" ? null : call === "grandTichu" ? "Grand Tichu" : "Tichu"}
            badgeTone={call === "grandTichu" ? "red" : "violet"}
            status={round.finished.includes(seat)
              ? `out ${["1st", "2nd", "3rd"][round.finished.indexOf(seat)]}`
              : cardCount(round.handCounts[seat] ?? 0)}
            {now}
          />
        </div>
      {/each}

      <div class="absolute inset-x-20 top-44">
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
      handDisabled={decision?._tag === "GrandTichu"}
    >
      {#snippet sheet()}
        {#if decision?._tag === "GrandTichu"}
          <div
            class="mb-2 flex items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-neutral-900"
          >
            <span class="text-sm font-semibold">Call Grand Tichu for 200?</span>
            <div class="flex gap-2">
              <Button
                variant="outline"
                class="text-neutral-900"
                onclick={() =>
                  client.send({
                    _tag: "Answer",
                    decisionId: decision.id,
                    command: { _tag: "GrandTichu", seat: me, call: false },
                  })}
              >
                No
              </Button>
              <Button
                class="bg-red-800 text-white"
                onclick={() =>
                  client.send({
                    _tag: "Answer",
                    decisionId: decision.id,
                    command: { _tag: "GrandTichu", seat: me, call: true },
                  })}
              >
                Grand Tichu!
              </Button>
            </div>
          </div>
        {:else if decision?._tag === "Exchange"}
          <div class="mb-2 flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-neutral-900">
            <span class="text-sm font-semibold">Tap a card, then who gets it.</span>
            <div class="grid grid-cols-3 gap-2">
              {#each [ring.left, ring.top, ring.right].filter( (seat) => decision.to.includes(seat) ) as seat (seat)}
                {@const card = cardByKey(gives[seat])}
                <button
                  type="button"
                  class="flex h-24 flex-col items-center justify-between rounded-lg border border-neutral-300 bg-white p-1 text-xs"
                  onclick={() => assign(seat)}
                >
                  <span class="font-medium">
                    {name(seat)}{seat === ring.top ? " (partner)" : ""}
                  </span>
                  {#if card}
                    <PlayingCard {card} class="w-10" />
                  {:else}
                    <span class="text-neutral-400">empty</span>
                  {/if}
                </button>
              {/each}
            </div>
            <Button disabled={!exchangeReady} onclick={exchange}>Give these cards</Button>
          </div>
        {:else if decision?._tag === "DragonGift"}
          <div class="mb-2 flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-neutral-900">
            <span class="text-sm font-semibold">You won the Trick with the Dragon. Give it to:</span
            >
            <div class="flex gap-2">
              {#each decision.to as seat (seat)}
                <Button
                  class="flex-1"
                  variant="outline"
                  onclick={() =>
                    client.send({
                      _tag: "Answer",
                      decisionId: decision.id,
                      command: { _tag: "GiftDragon", seat: me, to: seat },
                    })}
                >
                  {name(seat)} ({round.handCounts[seat]} cards)
                </Button>
              {/each}
            </div>
          </div>
        {:else if round.phase === "playing" && hand.length === 14 && round.received.length > 0}
          <div class="mb-2 flex items-center gap-2 rounded-xl bg-black/30 p-2 text-xs">
            <span>Received:</span>
            {#each round.received as gift (cardKey(gift.card))}
              <span class="flex items-center gap-1">
                <PlayingCard card={gift.card} class="w-6" />{name(gift.from)}
              </span>
            {/each}
          </div>
        {/if}
      {/snippet}
      {#snippet actions()}
        {#if observation.reactions.callTichu}
          <Button
            variant="secondary"
            class="bg-violet-700 text-white"
            onclick={() =>
              client.send({
                _tag: "React",
                seenSeq: client.seq,
                command: { _tag: "CallTichu", seat: me },
              })}
          >
            Tichu!
          </Button>
        {/if}
      {/snippet}
    </PlayControls>
  {/if}
</div>

<Dialog.Root
  open={summary !== null || observation.winningTeam !== null}
  onOpenChange={(open) => {
    if (!open) summary = null;
  }}
>
  <Dialog.Content>
    {#if observation.winningTeam !== null}
      <Dialog.Header>
        <Dialog.Title>
          {observation.winningTeam === myTeam ? "You won the Match!" : "The Match is over"}
        </Dialog.Title>
        <Dialog.Description>
          {observation.totals.map((total, team) => `${teamLabel(team)} ${total}`).join(" · ")}
        </Dialog.Description>
      </Dialog.Header>
      {#if isCreator}
        <Button onclick={() => client.send({ _tag: "Rematch" })}>Play again</Button>
      {:else}
        <p class="text-sm text-neutral-400">The creator can start a rematch.</p>
      {/if}
    {:else if summary !== null}
      <Dialog.Header>
        <Dialog.Title>Round {summary.round}</Dialog.Title>
        <Dialog.Description>
          Finishing order: {summary.finishingOrder.map(name).join(", ")}{summary.oneTwo
            ? " (one-two!)"
            : ""}
        </Dialog.Description>
      </Dialog.Header>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-neutral-400">
            <th class="text-left font-normal"></th>
            {#each summary.points as _, team (team)}
              <th class="text-right font-normal">{teamLabel(team)}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cards</td>
            {#each summary.cardPoints as points, team (team)}
              <td class="text-right">{points}</td>
            {/each}
          </tr>
          {#each summary.calls as call (call.seat)}
            <tr>
              <td>
                {name(call.seat)}: {call.call === "grandTichu" ? "Grand Tichu" : "Tichu"}
                {call.succeeded ? "made" : "failed"}
              </td>
              {#each summary.points as _, team (team)}
                <td class="text-right">
                  {observation.layout.teams[team]?.includes(call.seat) ? call.points : ""}
                </td>
              {/each}
            </tr>
          {/each}
          <tr class="font-semibold">
            <td>Round</td>
            {#each summary.points as points, team (team)}
              <td class="text-right">{points}</td>
            {/each}
          </tr>
          <tr class="text-[var(--gold)]">
            <td>Total</td>
            {#each summary.totals as total, team (team)}
              <td class="text-right">{total}</td>
            {/each}
          </tr>
        </tbody>
      </table>
      <Button onclick={() => (summary = null)}>Next Round</Button>
    {/if}
  </Dialog.Content>
</Dialog.Root>
