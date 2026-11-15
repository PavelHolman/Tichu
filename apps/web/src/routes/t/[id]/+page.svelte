<script lang="ts">
  import { page } from "$app/state";
  import GameTable from "$lib/components/game/GameTable.svelte";
  import SeigneurTable from "$lib/components/game/SeigneurTable.svelte";
  import JoinForm from "$lib/components/table/JoinForm.svelte";
  import Lobby from "$lib/components/table/Lobby.svelte";
  import { getTable } from "$lib/connection/api.js";
  import { forgetSeat, loadSeat } from "$lib/connection/seat-token.js";
  import { TableClient } from "$lib/connection/table-client.svelte.js";
  import type { TableView } from "@tichu/protocol";
  import { Effect, Option } from "effect";
  import { onDestroy, untrack } from "svelte";

  const tableId = $derived(page.params.id ?? "");

  let preview = $state<TableView | null>(null);
  let loadError = $state<string | null>(null);
  let client = $state<TableClient | null>(null);

  const load = async () => {
    const result = await Effect.runPromise(Effect.result(getTable(tableId)));
    if (result._tag === "Failure")
      loadError =
        result.failure.status === 404 ? "This Table does not exist." : result.failure.message;
    else preview = result.success;
  };

  const connect = () => {
    client?.close();
    client = null;
    const stored = loadSeat(tableId);
    if (Option.isSome(stored)) client = new TableClient(tableId, stored.value.token);
    else void load();
  };

  $effect(() => {
    const id = tableId;
    // Reconnect only when the Table changes, not when `client` itself does.
    if (id !== "") untrack(connect);
  });

  // A released Seat or unknown token: forget it and offer to join again.
  $effect(() => {
    if (client?.status === "refused") {
      forgetSeat(tableId);
      client.close();
      client = null;
      void load();
    }
  });

  onDestroy(() => client?.close());

  const noFreeSeat = $derived(
    preview !== null && preview.seats.every((occupant) => occupant !== null),
  );
</script>

{#if client !== null && client.status === "closed" && client.table?.status !== "closed"}
  <main class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4">
    <p>This Table is no longer available.</p>
    <a class="underline" href="/">Start a new one</a>
  </main>
{:else if client !== null && client.table !== null && client.you !== null}
  {#if client.table.status === "lobby"}
    <main class="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <h1 class="text-2xl font-bold">Table</h1>
      <Lobby {client} table={client.table} you={client.you} />
    </main>
  {:else if client.table.status === "closed"}
    <main class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4">
      <p>This Table was closed.</p>
      <a class="underline" href="/">Start a new one</a>
    </main>
  {:else if client.observation?.variant === "standard"}
    <GameTable {client} table={client.table} observation={client.observation} />
  {:else if client.observation?.variant === "grandSeigneur"}
    <SeigneurTable {client} table={client.table} observation={client.observation} />
  {/if}
{:else if client !== null}
  <main class="flex min-h-dvh items-center justify-center text-neutral-300">
    {client.status === "reconnecting" ? "Reconnecting…" : "Connecting…"}
  </main>
{:else}
  <main class="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
    <h1 class="text-2xl font-bold">Join the Table</h1>
    {#if loadError}
      <p class="text-red-300">{loadError}</p>
      <a class="underline" href="/">Start a new Table</a>
    {:else if preview === null}
      <p class="text-neutral-300">Loading…</p>
    {:else if preview.status === "closed" || preview.status === "finished"}
      <p>This Table is no longer taking Players.</p>
    {:else if noFreeSeat}
      <p>This Match is in progress and has no free Seat.</p>
    {:else}
      <JoinForm table={preview} onJoined={connect} />
    {/if}
  </main>
{/if}
