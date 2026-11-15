import { Schema } from "effect";

export const Seat = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
export type Seat = number;

/** Seat count and the partition of Seats into Teams. Teams list Seats in play order. */
export const Layout = Schema.Struct({
  seats: Schema.Int,
  teams: Schema.Array(Schema.Array(Seat)),
});
export type Layout = typeof Layout.Type;

export const fourSeatsTwoTeams: Layout = {
  seats: 4,
  teams: [
    [0, 2],
    [1, 3],
  ],
};

export const individualLayout = (seats: number): Layout => ({
  seats,
  teams: Array.from({ length: seats }, (_, seat) => [seat]),
});

export const teamOf = (layout: Layout, seat: Seat): number =>
  layout.teams.findIndex((team) => team.includes(seat));

export const areTeammates = (layout: Layout, a: Seat, b: Seat): boolean =>
  teamOf(layout, a) === teamOf(layout, b);

export const opponentsOf = (layout: Layout, seat: Seat): Array<Seat> =>
  seatsInOrderAfter(layout, seat).filter((other) => !areTeammates(layout, seat, other));

/** The first teammate after `seat` in play order, if any. */
export const partnerOf = (layout: Layout, seat: Seat): Seat | undefined =>
  seatsInOrderAfter(layout, seat).find((other) => areTeammates(layout, seat, other));

/** Every other Seat, starting with the one after `seat`. */
export const seatsInOrderAfter = (layout: Layout, seat: Seat): Array<Seat> =>
  Array.from({ length: layout.seats - 1 }, (_, offset) => (seat + offset + 1) % layout.seats);

/** The first Seat from `seat` (inclusive when `inclusive`) in play order that satisfies `holds`. */
export const nextSeatWhere = (
  layout: Layout,
  seat: Seat,
  holds: (seat: Seat) => boolean,
  inclusive = false,
): Seat | undefined => {
  const order = inclusive
    ? [seat, ...seatsInOrderAfter(layout, seat)]
    : seatsInOrderAfter(layout, seat);
  return order.find(holds);
};
