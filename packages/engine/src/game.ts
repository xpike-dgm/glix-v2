import type { Rng } from "./rng.js";

export interface Rejected {
  rejected: string;
}

export interface GameDefinition<State, Action, View> {
  id: string;
  minPlayers: number;
  maxPlayers: number;
  setup(players: readonly string[], rng: Rng): State;
  reduce(state: State, playerId: string, action: Action): State | Rejected;
  view(state: State, playerId: string | null): View;
  score(state: State): Record<string, number>;
  isFinished(state: State): boolean;
}
