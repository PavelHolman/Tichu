import { env } from "$env/dynamic/public";
import {
  CreateTableResponse,
  HttpError,
  JoinResponse,
  TableView,
  paths,
  type TableSettings,
} from "@tichu/protocol";
import { Effect, Schema } from "effect";

/** The Table Worker's origin. Local `wrangler dev` of apps/table by default. */
export const tableOrigin = (): string => env.PUBLIC_TABLE_URL ?? "http://localhost:8787";

export class ApiError extends Schema.TaggedError<ApiError>()("ApiError", {
  status: Schema.Number,
  error: Schema.String,
  message: Schema.String,
}) {}

const request = <A, I>(schema: Schema.Codec<A, I>, path: string, init?: RequestInit) =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(`${tableOrigin()}${path}`, init),
      catch: () =>
        new ApiError({ status: 0, error: "Network", message: "The Table server is unreachable" }),
    });
    const body = yield* Effect.tryPromise({
      try: () => response.json() as Promise<unknown>,
      catch: () =>
        new ApiError({ status: response.status, error: "InvalidResponse", message: "Not JSON" }),
    });
    if (!response.ok) {
      const failure = Schema.decodeUnknownOption(HttpError)(body);
      return yield* new ApiError({
        status: response.status,
        error: failure._tag === "Some" ? failure.value.error : "Http",
        message: failure._tag === "Some" ? failure.value.message : response.statusText,
      });
    }
    return yield* Schema.decodeUnknownEffect(schema)(body).pipe(
      Effect.mapError(
        (error) =>
          new ApiError({
            status: response.status,
            error: "InvalidResponse",
            message: error.message,
          }),
      ),
    );
  });

const postJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const createTable = (settings: TableSettings) =>
  request(CreateTableResponse, paths.tables, postJson({ settings }));

export const getTable = (tableId: string) => request(TableView, paths.table(tableId));

export const joinTable = (tableId: string, nickname: string, seat: number) =>
  request(JoinResponse, paths.seats(tableId), postJson({ nickname, seat }));

export const socketUrl = (tableId: string, token: string): string => {
  const url = new URL(paths.socket(tableId), tableOrigin());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  return url.toString();
};
