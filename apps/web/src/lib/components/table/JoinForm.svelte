<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { joinTable } from "$lib/connection/api.js";
  import { lastNickname, rememberNickname, saveSeat } from "$lib/connection/seat-token.js";
  import type { TableView } from "@tichu/protocol";
  import { Effect } from "effect";

  let { table, onJoined }: { table: TableView; onJoined: () => void } = $props();

  let nickname = $state(lastNickname());
  let error = $state<string | null>(null);
  let joining = $state(false);

  const partnerOf = (seat: number) => (seat + 2) % table.seats.length;
  const occupantName = (seat: number) => {
    const occupant = table.seats[seat];
    if (occupant === null || occupant === undefined) return null;
    return occupant._tag === "Player" ? occupant.nickname : `${occupant.tier} Bot`;
  };

  const take = async (seat: number) => {
    const name = nickname.trim();
    if (name.length === 0) {
      error = "Pick a nickname first";
      return;
    }
    joining = true;
    const result = await Effect.runPromise(Effect.result(joinTable(table.id, name, seat)));
    joining = false;
    if (result._tag === "Failure") {
      error = result.failure.message;
      return;
    }
    rememberNickname(name);
    saveSeat(table.id, { seat, token: result.success.token, nickname: result.success.nickname });
    onJoined();
  };
</script>

<section class="flex flex-col gap-5 rounded-xl bg-black/25 p-5">
  <div class="flex flex-col gap-2">
    <Label for="nickname">Your nickname</Label>
    <Input id="nickname" maxlength={24} bind:value={nickname} autocomplete="nickname" />
  </div>
  <div class="flex flex-col gap-2">
    <h2 class="text-sm font-medium">Choose a Seat</h2>
    <p class="text-xs text-neutral-400">Your partner sits opposite you.</p>
    <div class="grid grid-cols-2 gap-2">
      {#each table.seats as occupant, seat (seat)}
        {@const partner = occupantName(partnerOf(seat))}
        <Button
          variant="outline"
          class="h-auto flex-col items-start gap-0.5 py-3 text-left"
          disabled={occupant !== null || joining}
          onclick={() => take(seat)}
        >
          <span class="font-semibold">Seat {seat + 1}</span>
          <span class="text-xs font-normal text-neutral-400">
            {occupant === null ? (partner ? `partner: ${partner}` : "free") : occupantName(seat)}
          </span>
        </Button>
      {/each}
    </div>
  </div>
  {#if error}<p class="text-sm text-red-300" role="alert">{error}</p>{/if}
</section>
