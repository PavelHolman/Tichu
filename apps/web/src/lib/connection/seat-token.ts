import { Effect, Option, Schema } from "effect";

/** What the browser remembers about its Seat at a Table: the token is the sole credential. */
const StoredSeat = Schema.Struct({
  seat: Schema.Int,
  token: Schema.String,
  nickname: Schema.String,
});
export type StoredSeat = typeof StoredSeat.Type;

const key = (tableId: string) => `tichu:seat:${tableId}`;
const decode = Schema.decodeUnknownOption(Schema.fromJsonString(StoredSeat));

export const loadSeat = (tableId: string): Option.Option<StoredSeat> =>
  Effect.runSync(
    Effect.try(() => localStorage.getItem(key(tableId))).pipe(
      Effect.map((text) => (text === null ? Option.none() : decode(text))),
      Effect.orElseSucceed(() => Option.none()),
    ),
  );

export const saveSeat = (tableId: string, seat: StoredSeat): void =>
  Effect.runSync(
    Effect.try(() => localStorage.setItem(key(tableId), JSON.stringify(seat))).pipe(Effect.ignore),
  );

export const forgetSeat = (tableId: string): void =>
  Effect.runSync(Effect.try(() => localStorage.removeItem(key(tableId))).pipe(Effect.ignore));

export const rememberNickname = (nickname: string): void =>
  Effect.runSync(
    Effect.try(() => localStorage.setItem("tichu:nickname", nickname)).pipe(Effect.ignore),
  );

export const lastNickname = (): string =>
  Effect.runSync(
    Effect.try(() => localStorage.getItem("tichu:nickname") ?? "").pipe(
      Effect.orElseSucceed(() => ""),
    ),
  );
