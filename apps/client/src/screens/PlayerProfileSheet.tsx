import { createEffect, createSignal, on, Show } from "solid-js";
import { type ProfileInfo, parseProfile } from "../net/profileRules.js";
import { Avatar } from "../ui/Avatar.js";
import { BottomSheet } from "../ui/BottomSheet.js";

type Load = { kind: "loading" } | { kind: "ready"; profile: ProfileInfo } | { kind: "error" };

/**
 * Lobide bir arkadaşın kısa profili (odadan çıkmadan): toplam maç, galibiyet, oran, favori oyun.
 * Sunucu yalnız kabul edilmiş arkadaşlara verir; başkası için 404 döner ve "göremezsin" yazılır.
 */
export function PlayerProfileSheet(props: {
  open: boolean;
  onClose: () => void;
  username: string | null;
  avatar: number;
}) {
  const [load, setLoad] = createSignal<Load>({ kind: "loading" });
  let seq = 0;

  createEffect(
    on(
      () => [props.open, props.username] as const,
      ([open, name]) => {
        if (!open || !name) return;
        const mine = ++seq;
        setLoad({ kind: "loading" });
        void (async () => {
          try {
            const res = await fetch(`/api/profile/${encodeURIComponent(name)}`, {
              credentials: "same-origin",
            });
            let body: unknown = null;
            try {
              body = await res.json();
            } catch {
              // gövde okunamadı
            }
            const profile = res.ok ? parseProfile(body) : null;
            if (mine === seq) setLoad(profile ? { kind: "ready", profile } : { kind: "error" });
          } catch {
            if (mine === seq) setLoad({ kind: "error" });
          }
        })();
      },
    ),
  );

  return (
    <BottomSheet
      open={props.open}
      onClose={props.onClose}
      title={props.username ?? "Profil"}
      header={
        <div class="pmenu__who">
          <Avatar index={props.avatar} size={52} />
          <div class="pmenu__text">
            <span class="pmenu__name">{props.username}</span>
            <span class="pmenu__tag">Arkadaşın</span>
          </div>
        </div>
      }
    >
      {(() => {
        const l = load();
        if (l.kind === "loading")
          return (
            <p class="sheet__text" role="status">
              Yükleniyor…
            </p>
          );
        if (l.kind === "error")
          return (
            <p class="sheet__text" role="alert">
              Profil şu an yüklenemedi.
            </p>
          );
        const t = l.profile.totals;
        return (
          <div class="pprof">
            <div class="pprof__tile">
              <b>{t.matches}</b>
              <span>Maç</span>
            </div>
            <div class="pprof__tile">
              <b>{t.wins}</b>
              <span>Galibiyet</span>
            </div>
            <div class="pprof__tile">
              <b>%{Math.round(t.winRate * 100)}</b>
              <span>Oran</span>
            </div>
            <Show when={l.profile.favoriteGame}>
              {(g) => <p class="pprof__fav">Favori oyunu: {g().name}</p>}
            </Show>
          </div>
        );
      })()}
    </BottomSheet>
  );
}
