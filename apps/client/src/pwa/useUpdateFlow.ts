import { type Accessor, createEffect, createMemo } from "solid-js";
import { state } from "../net/store.js";
import type { ScreenId } from "../screens/route.js";
import { applyUpdate, updateWaiting } from "./pwa.js";
import { decideUpdate, type UpdateDecision } from "./updatePolicy.js";

/**
 * Güncelleme akışı: kararı ekrandan türetir; güvenli anda bekleyen sürümü sormadan uygular.
 * Uyumsuz sürümde (`block-required`) uygulamayı çağıran taraf tam ekran engel gösterir.
 */
export function useUpdateFlow(screen: Accessor<ScreenId>): Accessor<UpdateDecision> {
  const decision = createMemo(() =>
    decideUpdate({ waiting: updateWaiting(), screen: screen(), serverProtocol: state.serverProtocol }),
  );
  createEffect(() => {
    if (decision() === "apply-now-silently") applyUpdate();
  });
  return decision;
}
