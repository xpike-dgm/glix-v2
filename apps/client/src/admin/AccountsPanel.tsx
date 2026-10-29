import type {
  AdminAccountDetail,
  AdminAccountRow,
  AdminAccounts,
  AdminPlayerFilter,
  AdminPlayerRow,
  AdminPlayerSort,
} from "@glix/engine";
import { COSMETIC_ITEMS, cosmeticItem } from "@glix/engine";
import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import {
  type AccountAction,
  fetchAccounts,
  fetchDetail,
  fetchPlayerList,
  kickPlayer,
  runAccountAction,
  searchAccounts,
} from "./api.js";
import { Bars, HBars } from "./charts.js";
import {
  confirmMatches,
  failRatio,
  fmtAgo,
  fmtDateTime,
  fmtGlixDelta,
  fmtInt,
  fmtPct,
  fmtUntil,
  GLIX_REASON_LABEL,
  glixRefText,
  methodsLabel,
  parseGlixAmount,
  shortDay,
  USERNAME_OK,
} from "./format.js";
import {
  defaultDir,
  FILTER_OPTIONS,
  fmtRemaining,
  groupOwned,
  liveText,
  parseBalanceTarget,
  ROLE_LABEL,
  SORT_OPTIONS,
} from "./playerRules.js";

const MAIL_KINDS = [
  { id: "verify", label: "Doğrulama" },
  { id: "reset", label: "Şifre sıfırlama" },
  { id: "admin", label: "Yönetici kodu" },
] as const;

const DURATIONS = [
  { id: "1d", label: "1 gün" },
  { id: "7d", label: "7 gün" },
  { id: "forever", label: "Süresiz" },
] as const;

/** Ortak yükleme/hata/OTP davranışı olan küçük başlık satırı. */
function Banner(props: { text: string | null; kind?: "bad" | "ok" }) {
  return (
    <Show when={props.text}>
      {(t) => (
        <p
          class={props.kind === "ok" ? "adm-banner adm-banner--ok" : "adm-banner adm-banner--bad"}
          role="alert"
        >
          {t()}
        </p>
      )}
    </Show>
  );
}

function Overview(props: { data: AdminAccounts }) {
  const d = () => props.data;
  return (
    <>
      <div class="adm-tiles">
        <div class="adm-tile">
          <span class="adm-tile__label">Toplam hesap</span>
          <strong class="adm-tile__value">{fmtInt(d().total)}</strong>
        </div>
        <div class="adm-tile">
          <span class="adm-tile__label">E-postası doğrulanmış</span>
          <strong class="adm-tile__value">{d().total === 0 ? "—" : fmtPct(d().verified / d().total)}</strong>
          <span class="adm-tile__sub">{fmtInt(d().verified)} hesap</span>
        </div>
        <div class="adm-tile">
          <span class="adm-tile__label">Son 7 günde oynayan</span>
          <strong class="adm-tile__value">{fmtInt(d().active7)}</strong>
          <span class="adm-tile__sub">en az bir maç bitirdi</span>
        </div>
        <div class="adm-tile">
          <span class="adm-tile__label">Son 30 günde oynayan</span>
          <strong class="adm-tile__value">{fmtInt(d().active30)}</strong>
        </div>
        <div class="adm-tile" data-level={d().suspended > 0 ? "warn" : undefined}>
          <span class="adm-tile__label">Askıdaki hesap</span>
          <strong class="adm-tile__value">{fmtInt(d().suspended)}</strong>
        </div>
      </div>

      <div class="adm-grid">
        <div class="adm-card">
          <h3 class="adm-h3">Yeni hesap (son 30 gün)</h3>
          <Bars
            data={d().newPerDay.map((x) => ({ label: shortDay(x.day), value: x.count }))}
            unit="hesap"
            caption="Günlük yeni hesap sayısı"
            color="var(--lime)"
          />
        </div>
        <div class="adm-card">
          <h3 class="adm-h3">Giriş yöntemi</h3>
          <HBars
            rows={[
              { label: "Yalnız şifre", value: d().methods.password },
              { label: "Yalnız Google", value: d().methods.google },
              { label: "İkisi de", value: d().methods.both },
            ]}
          />
        </div>
      </div>

      <h3 class="adm-h3">E-posta gönderimi (son 30 gün)</h3>
      <Show
        when={d().mail.enabled}
        fallback={
          <p class="adm-banner adm-banner--warn">Gönderim sayacı kapalı (istatistik kaydı ayarlı değil).</p>
        }
      >
        <div class="adm-grid">
          <div class="adm-card">
            <div class="adm-table-wrap">
              <table class="adm-table adm-stack">
                <thead>
                  <tr>
                    <th>Tür</th>
                    <th class="num">Başarılı</th>
                    <th class="num">Başarısız</th>
                    <th class="num">Başarısızlık</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={MAIL_KINDS}>
                    {(k) => {
                      const c = () => d().mail.totals[k.id];
                      return (
                        <tr>
                          <td data-label="Tür">{k.label}</td>
                          <td class="num" data-label="Başarılı">
                            {fmtInt(c().ok)}
                          </td>
                          <td class="num" data-label="Başarısız" data-level={c().failed > 0 ? "bad" : "ok"}>
                            {fmtInt(c().failed)}
                          </td>
                          <td class="num" data-label="Başarısızlık">
                            {failRatio(c()) === null ? "—" : fmtPct(failRatio(c()) ?? 0)}
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
            <p class="adm-muted adm-note">Yalnız sayı tutulur; adres ve içerik saklanmaz.</p>
          </div>
          <div class="adm-card">
            <h3 class="adm-h3">Günlük başarısız e-posta</h3>
            <Bars
              data={d().mail.days.map((x) => ({
                label: shortDay(x.day),
                value: x.verify.failed + x.reset.failed + x.admin.failed,
              }))}
              unit="başarısız e-posta"
              caption="Günlük başarısız e-posta sayısı"
              color="var(--red)"
            />
            <h3 class="adm-h3 adm-gap">Günlük gönderilen e-posta</h3>
            <Bars
              data={d().mail.days.map((x) => ({
                label: shortDay(x.day),
                value: x.verify.ok + x.reset.ok + x.admin.ok,
              }))}
              unit="e-posta"
              caption="Günlük başarıyla gönderilen e-posta sayısı"
            />
          </div>
        </div>
      </Show>
    </>
  );
}

type Step =
  | { op: "rename"; username: string }
  | { op: "suspend"; duration: "1d" | "7d" | "forever"; reason: string }
  | { op: "unsuspend" }
  | { op: "delete" }
  | { op: "logout-all" }
  | { op: "glix"; amount: number; reason: string }
  | { op: "glix-set"; balance: number; reason: string }
  | { op: "kick"; code: string; playerId: string }
  | { op: "cosmetic-grant" | "cosmetic-revoke"; itemId: string }
  | { op: "cosmetic-unequip"; slot: string };

function stepText(step: Step, a: AdminAccountDetail): string {
  switch (step.op) {
    case "rename":
      return `"${a.username}" adı "${step.username}" olarak değiştirilecek. Oyuncunun kendi bekleme süresi etkilenmez.`;
    case "suspend": {
      const d = DURATIONS.find((x) => x.id === step.duration)?.label ?? "";
      return `"${a.username}" ${d.toLowerCase()} askıya alınacak: tüm oturumları kapanır, giriş yapamaz.`;
    }
    case "unsuspend":
      return `"${a.username}" hesabının askısı kaldırılacak.`;
    case "delete":
      return `"${a.username}" hesabı ve tüm verisi kalıcı olarak silinecek. Geri alınamaz.`;
    case "logout-all":
      return `"${a.username}" tüm cihazlardan çıkarılacak.`;
    case "cosmetic-grant":
      return `"${a.username}" hesabına "${cosmeticItem(step.itemId)?.name ?? step.itemId}" armağan edilecek (Glix düşmez).`;
    case "cosmetic-revoke":
      return `"${a.username}" hesabından "${cosmeticItem(step.itemId)?.name ?? step.itemId}" geri alınacak (Glix iade edilmez).`;
    case "glix-set":
      return `"${a.username}" bakiyesi ${a.glix.balance} -> ${step.balance} Glix olarak ayarlanacak (fark deftere yazılır). Sebep: ${step.reason}`;
    case "kick":
      return `"${a.username}" ${step.code} odasından çıkarılacak; o odaya 10 dakika giremez.`;
    case "cosmetic-unequip":
      return `"${a.username}" hesabında kuşanılı ürün çıkarılacak (ürün hesapta kalır, odadaki görünüm hemen güncellenir).`;
    case "glix":
      return `"${a.username}" bakiyesine ${fmtGlixDelta(step.amount)} Glix yazılacak (${a.glix.balance} -> ${a.glix.balance + step.amount}). Sebep: ${step.reason}`;
  }
}

export function Detail(props: { id: number; onClose: () => void; onChanged: () => void; onOtp: () => void }) {
  const [acc, setAcc] = createSignal<AdminAccountDetail | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [done, setDone] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [step, setStep] = createSignal<Step | null>(null);
  const [newName, setNewName] = createSignal("");
  const [duration, setDuration] = createSignal<"1d" | "7d" | "forever">("7d");
  const [reason, setReason] = createSignal("");
  const [typed, setTyped] = createSignal("");
  const [glixAmount, setGlixAmount] = createSignal("");
  const [glixReason, setGlixReason] = createSignal("");
  const [grantItem, setGrantItem] = createSignal("");
  const [balanceTarget, setBalanceTarget] = createSignal("");
  const [balanceReason, setBalanceReason] = createSignal("");

  async function load(): Promise<void> {
    const r = await fetchDetail(props.id);
    if (r.kind === "otp") props.onOtp();
    else if (r.kind === "error") setError(r.message);
    else {
      setError(null);
      setAcc(r.data);
    }
  }
  onMount(() => void load());

  const ask = (s: Step): void => {
    setDone(null);
    setError(null);
    setTyped("");
    setStep(s);
  };

  async function confirm(): Promise<void> {
    const a = acc();
    const s = step();
    if (!a || !s || busy()) return;
    let payload: AccountAction;
    if (s.op === "kick") {
      setBusy(true);
      const r = await kickPlayer(s.code, s.playerId);
      setBusy(false);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setStep(null);
      setDone(r.message);
      props.onChanged();
      await load();
      return;
    }
    switch (s.op) {
      case "rename":
        payload = { op: "rename", id: a.id, username: s.username };
        break;
      case "suspend":
        payload = { op: "suspend", id: a.id, duration: s.duration, reason: s.reason };
        break;
      case "delete":
        payload = { op: "delete", id: a.id, confirm: typed() };
        break;
      case "unsuspend":
        payload = { op: "unsuspend", id: a.id };
        break;
      case "logout-all":
        payload = { op: "logout-all", id: a.id };
        break;
      case "glix":
        payload = { op: "glix", id: a.id, amount: s.amount, reason: s.reason };
        break;
      case "glix-set":
        payload = { op: "glix-set", id: a.id, balance: s.balance, reason: s.reason };
        break;
      case "cosmetic-unequip":
        payload = { op: "cosmetic-unequip", id: a.id, slot: s.slot };
        break;
      case "cosmetic-grant":
      case "cosmetic-revoke":
        payload = { op: s.op, id: a.id, itemId: s.itemId };
        break;
    }
    setBusy(true);
    const r = await runAccountAction(payload);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setStep(null);
    setNewName("");
    setReason("");
    setGlixAmount("");
    setGlixReason("");
    setGrantItem("");
    setBalanceTarget("");
    setBalanceReason("");
    setDone(r.message);
    props.onChanged();
    if (s.op === "delete") {
      setAcc(null);
      return;
    }
    await load();
  }

  const canDelete = () => {
    const a = acc();
    return a !== null && confirmMatches(typed(), a.username);
  };

  return (
    <section class="adm-card adm-detail" aria-labelledby="adm-detail-h">
      <header class="adm-section__head">
        <h3 id="adm-detail-h" class="adm-h3">
          Hesap ayrıntısı
        </h3>
        <button type="button" class="adm-btn adm-btn--ghost adm-btn--small" onClick={props.onClose}>
          Kapat
        </button>
      </header>
      <Banner text={error()} />
      <Banner text={done()} kind="ok" />
      <Show
        when={acc()}
        fallback={
          <Show when={!error() && !done()}>
            <p class="adm-muted">Yükleniyor...</p>
          </Show>
        }
      >
        {(a) => (
          <>
            <Show when={a().suspension}>
              {(s) => (
                <p class="adm-banner adm-banner--warn" role="status">
                  Hesap askıda: {fmtUntil(s().until)} ({fmtRemaining(s().until, Date.now())}). Sebep:{" "}
                  {s().reason}
                </p>
              )}
            </Show>
            <dl class="adm-dl">
              <div>
                <dt>Kullanıcı adı</dt>
                <dd>{a().username}</dd>
              </div>
              <div>
                <dt>Kimlik</dt>
                <dd>{a().id}</dd>
              </div>
              <div>
                <dt>Şu an</dt>
                <dd data-level={a().live.online ? "ok" : undefined}>
                  <span class="adm-dot" classList={{ "adm-dot--on": a().live.online }} aria-hidden="true" />
                  {liveText(a().live)}
                </dd>
              </div>
              <div>
                <dt>E-posta</dt>
                <dd class="adm-wrap">
                  {a().email}{" "}
                  <span class="adm-muted">({a().verified ? "doğrulanmış" : "doğrulanmamış"})</span>
                </dd>
              </div>
              <div>
                <dt>Giriş yöntemi</dt>
                <dd>{methodsLabel(a())}</dd>
              </div>
              <div>
                <dt>Kayıt</dt>
                <dd>{fmtDateTime(a().createdAt)}</dd>
              </div>
              <div>
                <dt>Son görülme</dt>
                <dd>
                  {a().lastSeen === null
                    ? "—"
                    : `${fmtDateTime(a().lastSeen ?? 0)} (${fmtAgo(a().lastSeen ?? 0, Date.now())})`}
                </dd>
              </div>
              <div>
                <dt>Açık oturum</dt>
                <dd>{a().sessions}</dd>
              </div>
              <div>
                <dt>Maç / galibiyet</dt>
                <dd>
                  {fmtInt(a().matches)} / {fmtInt(a().wins)}
                </dd>
              </div>
              <div>
                <dt>Oynanan oyun</dt>
                <dd>{fmtInt(a().games)}</dd>
              </div>
              <div>
                <dt>Rozet / arkadaş</dt>
                <dd>
                  {a().badges} / {a().friends}
                </dd>
              </div>
              <div>
                <dt>Ad değiştirme</dt>
                <dd>{a().usernameChangedAt === null ? "hiç" : fmtDateTime(a().usernameChangedAt ?? 0)}</dd>
              </div>
              <div>
                <dt>Glix bakiyesi</dt>
                <dd>{fmtInt(a().glix.balance)}</dd>
              </div>
            </dl>
            <Show when={a().glix.ledger.length > 0}>
              <h4 class="adm-h4">Son Glix hareketleri</h4>
              <div class="adm-table-wrap">
                <table class="adm-table adm-stack">
                  <thead>
                    <tr>
                      <th>Zaman</th>
                      <th>Tutar</th>
                      <th>Neden</th>
                      <th>Ayrıntı</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={a().glix.ledger}>
                      {(g) => (
                        <tr>
                          <td data-label="Zaman">{fmtDateTime(g.at)}</td>
                          <td data-label="Tutar" data-level={g.amount < 0 ? "bad" : undefined}>
                            {fmtGlixDelta(g.amount)}
                          </td>
                          <td data-label="Neden">{GLIX_REASON_LABEL[g.reason] ?? g.reason}</td>
                          <td data-label="Ayrıntı" class="adm-wrap">
                            {glixRefText(g.reason, g.ref)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
            <h4 class="adm-h4">Mağaza ürünleri</h4>
            <Show
              when={a().cosmetics.owned.length > 0}
              fallback={<p class="adm-muted">Sahip olunan ürün yok.</p>}
            >
              <For each={groupOwned(a().cosmetics)}>
                {(g) => (
                  <div class="adm-group">
                    <h5 class="adm-group__h">{g.label}</h5>
                    <ul class="adm-items">
                      <For each={g.items}>
                        {(o) => (
                          <li class="adm-item" classList={{ "adm-item--on": o.equipped }}>
                            <div class="adm-item__main">
                              <span class="adm-item__name">
                                {o.name}
                                <Show when={o.equipped}>
                                  <span class="adm-badge adm-badge--added">Kuşanılı</span>
                                </Show>
                              </span>
                              <span class="adm-muted adm-item__sub">
                                {o.pricePaid === 0 ? "Armağan" : `${fmtInt(o.pricePaid)} Glix`} ·{" "}
                                {fmtDateTime(o.acquiredAt)}
                              </span>
                            </div>
                            <Show when={!a().protected}>
                              <div class="adm-item__acts">
                                <Show when={o.equipped}>
                                  <button
                                    type="button"
                                    class="adm-btn adm-btn--ghost adm-btn--small"
                                    onClick={() => ask({ op: "cosmetic-unequip", slot: g.slot })}
                                  >
                                    Çıkar
                                  </button>
                                </Show>
                                <button
                                  type="button"
                                  class="adm-btn adm-btn--ghost adm-btn--small"
                                  onClick={() => ask({ op: "cosmetic-revoke", itemId: o.itemId })}
                                >
                                  Geri al
                                </button>
                              </div>
                            </Show>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                )}
              </For>
            </Show>
            <Show when={!a().protected}>
              <form
                class="adm-inline"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (grantItem() !== "") ask({ op: "cosmetic-grant", itemId: grantItem() });
                }}
              >
                <label for="adm-grant">Ürün armağan et</label>
                <select
                  id="adm-grant"
                  class="adm-field"
                  value={grantItem()}
                  onChange={(e) => setGrantItem(e.currentTarget.value)}
                >
                  <option value="">Seç…</option>
                  <For
                    each={COSMETIC_ITEMS.filter((i) => !a().cosmetics.owned.some((o) => o.itemId === i.id))}
                  >
                    {(i) => (
                      <option value={i.id}>
                        {i.name} ({i.rarity})
                      </option>
                    )}
                  </For>
                </select>
                <button type="submit" class="adm-btn adm-btn--small" disabled={grantItem() === ""}>
                  Armağan et
                </button>
              </form>
            </Show>
            <p class="adm-muted adm-note">Bu ekranı açman işlem kaydına yazıldı.</p>

            <Show
              when={!a().protected}
              fallback={
                <p class="adm-banner adm-banner--warn">
                  Yönetici hesabı: değiştirme, askı, silme ve oturum kapatma kapalı.
                </p>
              }
            >
              <Show
                when={step()}
                fallback={
                  <div class="adm-actions">
                    <form
                      class="adm-inline"
                      onSubmit={(e) => {
                        e.preventDefault();
                        ask({ op: "rename", username: newName().trim() });
                      }}
                    >
                      <label for="adm-rename">Yeni kullanıcı adı</label>
                      <input
                        id="adm-rename"
                        class="adm-field"
                        maxlength="20"
                        autocomplete="off"
                        value={newName()}
                        onInput={(e) => setNewName(e.currentTarget.value)}
                      />
                      <button
                        type="submit"
                        class="adm-btn adm-btn--small"
                        disabled={!USERNAME_OK.test(newName().trim())}
                      >
                        Kullanıcı adını değiştir
                      </button>
                    </form>

                    <Show
                      when={a().suspension}
                      fallback={
                        <form
                          class="adm-inline"
                          onSubmit={(e) => {
                            e.preventDefault();
                            ask({ op: "suspend", duration: duration(), reason: reason().trim() });
                          }}
                        >
                          <label for="adm-reason">Askı sebebi (kayıt için, oyuncuya gösterilmez)</label>
                          <input
                            id="adm-reason"
                            class="adm-field"
                            maxlength="140"
                            autocomplete="off"
                            value={reason()}
                            onInput={(e) => setReason(e.currentTarget.value)}
                          />
                          <fieldset class="adm-seg">
                            <legend class="adm-sr">Askı süresi</legend>
                            <For each={DURATIONS}>
                              {(d) => (
                                <button
                                  type="button"
                                  aria-pressed={duration() === d.id}
                                  class="adm-seg__opt"
                                  classList={{ "adm-seg__opt--on": duration() === d.id }}
                                  onClick={() => setDuration(d.id)}
                                >
                                  {d.label}
                                </button>
                              )}
                            </For>
                          </fieldset>
                          <button
                            type="submit"
                            class="adm-btn adm-btn--small"
                            disabled={reason().trim() === ""}
                          >
                            Askıya al
                          </button>
                        </form>
                      }
                    >
                      <button
                        type="button"
                        class="adm-btn adm-btn--small"
                        onClick={() => ask({ op: "unsuspend" })}
                      >
                        Askıyı kaldır
                      </button>
                    </Show>

                    <form
                      class="adm-inline"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const amount = parseGlixAmount(glixAmount());
                        if (amount !== null) ask({ op: "glix", amount, reason: glixReason().trim() });
                      }}
                    >
                      <label for="adm-glix-amount">Glix düzeltmesi (örn. 50 ya da -20)</label>
                      <input
                        id="adm-glix-amount"
                        class="adm-field"
                        inputmode="numeric"
                        maxlength="7"
                        autocomplete="off"
                        value={glixAmount()}
                        onInput={(e) => setGlixAmount(e.currentTarget.value)}
                      />
                      <label for="adm-glix-reason">Sebep (kayıt için)</label>
                      <input
                        id="adm-glix-reason"
                        class="adm-field"
                        maxlength="140"
                        autocomplete="off"
                        value={glixReason()}
                        onInput={(e) => setGlixReason(e.currentTarget.value)}
                      />
                      <button
                        type="submit"
                        class="adm-btn adm-btn--small"
                        disabled={parseGlixAmount(glixAmount()) === null || glixReason().trim() === ""}
                      >
                        Glix düzelt
                      </button>
                    </form>

                    <form
                      class="adm-inline"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const balance = parseBalanceTarget(balanceTarget());
                        if (balance !== null)
                          ask({ op: "glix-set", balance, reason: balanceReason().trim() });
                      }}
                    >
                      <label for="adm-bal-target">Bakiyeyi şuna ayarla (fark deftere yazılır)</label>
                      <input
                        id="adm-bal-target"
                        class="adm-field"
                        inputmode="numeric"
                        maxlength="8"
                        autocomplete="off"
                        value={balanceTarget()}
                        onInput={(e) => setBalanceTarget(e.currentTarget.value)}
                      />
                      <label for="adm-bal-reason">Sebep (kayıt için)</label>
                      <input
                        id="adm-bal-reason"
                        class="adm-field"
                        maxlength="140"
                        autocomplete="off"
                        value={balanceReason()}
                        onInput={(e) => setBalanceReason(e.currentTarget.value)}
                      />
                      <button
                        type="submit"
                        class="adm-btn adm-btn--small"
                        disabled={
                          parseBalanceTarget(balanceTarget()) === null || balanceReason().trim() === ""
                        }
                      >
                        Bakiyeyi ayarla
                      </button>
                    </form>

                    <Show when={a().live.room}>
                      {(room) => (
                        <div class="adm-inline">
                          <span class="adm-muted">
                            {room().code} odasında: {ROLE_LABEL[room().role]}
                          </span>
                          <button
                            type="button"
                            class="adm-btn adm-btn--ghost adm-btn--small"
                            onClick={() => ask({ op: "kick", code: room().code, playerId: room().playerId })}
                          >
                            Odadan çıkar
                          </button>
                        </div>
                      )}
                    </Show>

                    <div class="adm-inline">
                      <button
                        type="button"
                        class="adm-btn adm-btn--ghost adm-btn--small"
                        onClick={() => ask({ op: "logout-all" })}
                      >
                        Oturumları kapat
                      </button>
                      <button
                        type="button"
                        class="adm-btn adm-btn--danger adm-btn--small"
                        onClick={() => ask({ op: "delete" })}
                      >
                        Hesabı sil
                      </button>
                    </div>
                  </div>
                }
              >
                {(s) => (
                  <div
                    class="adm-confirm adm-confirm--sheet"
                    role="alertdialog"
                    aria-labelledby="adm-confirm-h"
                  >
                    <h4 id="adm-confirm-h" class="adm-h4">
                      Emin misin?
                    </h4>
                    <p>{stepText(s(), a())}</p>
                    <Show when={s().op === "delete"}>
                      <label for="adm-typed">
                        Onaylamak için kullanıcı adını yaz: <b>{a().username}</b>
                      </label>
                      <input
                        id="adm-typed"
                        class="adm-field"
                        autocomplete="off"
                        value={typed()}
                        onInput={(e) => setTyped(e.currentTarget.value)}
                      />
                    </Show>
                    <div class="adm-inline">
                      <button
                        type="button"
                        class="adm-btn adm-btn--small"
                        classList={{
                          "adm-btn--danger": s().op === "delete" || s().op === "suspend" || s().op === "kick",
                        }}
                        disabled={busy() || (s().op === "delete" && !canDelete())}
                        onClick={() => void confirm()}
                      >
                        {busy() ? "İşleniyor..." : "Onayla"}
                      </button>
                      <button
                        type="button"
                        class="adm-btn adm-btn--ghost adm-btn--small"
                        disabled={busy()}
                        onClick={() => setStep(null)}
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                )}
              </Show>
            </Show>
          </>
        )}
      </Show>
    </section>
  );
}

function Results(props: { rows: AdminAccountRow[]; limit: number; onOpen: (id: number) => void }) {
  return (
    <>
      <div class="adm-table-wrap">
        <table class="adm-table adm-stack">
          <thead>
            <tr>
              <th>Kullanıcı adı</th>
              <th>Kimlik</th>
              <th>Kayıt</th>
              <th>E-posta</th>
              <th>Giriş</th>
              <th>Son görülme</th>
              <th class="num">Maç</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.rows}>
              {(r) => (
                <tr>
                  <td data-label="Kullanıcı adı">
                    <button type="button" class="adm-link" onClick={() => props.onOpen(r.id)}>
                      {r.username}
                    </button>
                  </td>
                  <td data-label="Kimlik" class="mono">
                    {r.id}
                  </td>
                  <td data-label="Kayıt">{fmtDateTime(r.createdAt)}</td>
                  <td data-label="E-posta">{r.verified ? "Doğrulanmış" : "Doğrulanmamış"}</td>
                  <td data-label="Giriş">{methodsLabel(r)}</td>
                  <td data-label="Son görülme">{r.lastSeen === null ? "—" : fmtDateTime(r.lastSeen)}</td>
                  <td data-label="Maç" class="num">
                    {fmtInt(r.matches)}
                  </td>
                  <td data-label="Durum" data-level={r.suspended ? "bad" : "ok"}>
                    {r.suspended ? "Askıda" : "Etkin"}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <Show when={props.rows.length >= props.limit}>
        <p class="adm-muted adm-note">En çok {props.limit} sonuç gösterilir; aramayı daralt.</p>
      </Show>
    </>
  );
}

function PlayerCard(props: { r: AdminPlayerRow; onOpen: (id: number) => void }) {
  const r = () => props.r;
  return (
    <li class="adm-pcard" classList={{ "adm-pcard--sus": r().suspended }}>
      <div class="adm-pcard__head">
        <button type="button" class="adm-link" onClick={() => props.onOpen(r().id)}>
          {r().username}
        </button>
        <span class="adm-pcard__state">
          <span class="adm-dot" classList={{ "adm-dot--on": r().live.online }} aria-hidden="true" />
          {r().live.online ? "Çevrimiçi" : "Çevrimdışı"}
        </span>
      </div>
      <div class="adm-pcard__badges">
        <Show when={r().live.room}>
          {(room) => (
            <span class="adm-badge adm-badge--added">
              Oda {room().code} · {ROLE_LABEL[room().role]}
            </span>
          )}
        </Show>
        <Show when={r().suspended}>
          <span class="adm-badge adm-badge--off">
            Askıda · {fmtRemaining(r().suspendedUntil, Date.now())}
          </span>
        </Show>
        <Show when={r().admin}>
          <span class="adm-badge">Yönetici</span>
        </Show>
      </div>
      <dl class="adm-pcard__meta">
        <div>
          <dt>Glix</dt>
          <dd>{fmtInt(r().glix)}</dd>
        </div>
        <div>
          <dt>Kayıt</dt>
          <dd>{fmtDateTime(r().createdAt)}</dd>
        </div>
        <div>
          <dt>Son görülme</dt>
          <dd>{r().lastSeen === null ? "—" : fmtDateTime(r().lastSeen ?? 0)}</dd>
        </div>
      </dl>
    </li>
  );
}

/** Tüm hesapların sayfalı listesi: süzgeç, sıralama, ad arama; e-posta araması eski uca gider. */
function PlayerList(props: { onOpen: (id: number) => void; onOtp: () => void; refreshKey: number }) {
  const [filter, setFilter] = createSignal<AdminPlayerFilter>("all");
  const [sort, setSort] = createSignal<AdminPlayerSort>("seen");
  const [dir, setDir] = createSignal<"asc" | "desc">("desc");
  const [query, setQuery] = createSignal("");
  const [rows, setRows] = createSignal<AdminPlayerRow[]>([]);
  const [emailRows, setEmailRows] = createSignal<{ rows: AdminAccountRow[]; limit: number } | null>(null);
  const [next, setNext] = createSignal<string | null>(null);
  const [total, setTotal] = createSignal<number | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  let seq = 0;

  async function load(append: boolean): Promise<void> {
    const mine = ++seq;
    const q = query().trim();
    setBusy(true);
    if (q.includes("@")) {
      const r = await searchAccounts(q);
      if (mine !== seq) return;
      setBusy(false);
      if (r.kind === "otp") return props.onOtp();
      if (r.kind === "error") {
        setError(r.message);
        return;
      }
      setError(null);
      setRows([]);
      setNext(null);
      setTotal(null);
      setEmailRows({ rows: r.data.results, limit: r.data.limit });
      return;
    }
    const r = await fetchPlayerList({
      filter: filter(),
      sort: sort(),
      dir: dir(),
      q,
      after: append ? next() : null,
    });
    if (mine !== seq) return;
    setBusy(false);
    if (r.kind === "otp") return props.onOtp();
    if (r.kind === "error") {
      setError(r.message);
      return;
    }
    setError(null);
    setEmailRows(null);
    setRows(append ? [...rows(), ...r.data.rows] : r.data.rows);
    setNext(r.data.next);
    setTotal(r.data.total);
  }

  // İlk yükleme ve dışarıdan yenileme (işlem sonrası).
  const refresh = (): void => {
    void load(false);
  };
  onMount(refresh);
  createEffect(on(() => props.refreshKey, refresh, { defer: true }));

  const pick = (f: AdminPlayerFilter): void => {
    setFilter(f);
    refresh();
  };
  const pickSort = (v: string): void => {
    const sorted = SORT_OPTIONS.find((o) => o.id === v);
    if (!sorted) return;
    setSort(sorted.id);
    setDir(defaultDir(sorted.id));
    refresh();
  };

  return (
    <div class="adm-card adm-search">
      <h3 class="adm-h3">Oyuncular</h3>
      <fieldset class="adm-seg adm-seg--wrap">
        <legend class="adm-sr">Süzgeç</legend>
        <For each={FILTER_OPTIONS}>
          {(f) => (
            <button
              type="button"
              aria-pressed={filter() === f.id}
              class="adm-seg__opt"
              classList={{ "adm-seg__opt--on": filter() === f.id }}
              onClick={() => pick(f.id)}
            >
              {f.label}
            </button>
          )}
        </For>
      </fieldset>
      <form
        class="adm-inline"
        onSubmit={(e) => {
          e.preventDefault();
          refresh();
        }}
      >
        <label for="adm-q">Ad ara</label>
        <input
          id="adm-q"
          class="adm-field"
          placeholder="Kullanıcı adının başı ya da tam e-posta"
          autocomplete="off"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <button type="submit" class="adm-btn adm-btn--small" disabled={busy()}>
          Ara
        </button>
      </form>
      <div class="adm-inline">
        <label for="adm-sort">Sırala</label>
        <select
          id="adm-sort"
          class="adm-field"
          value={sort()}
          onChange={(e) => pickSort(e.currentTarget.value)}
        >
          <For each={SORT_OPTIONS}>{(o) => <option value={o.id}>{o.label}</option>}</For>
        </select>
        <button
          type="button"
          class="adm-btn adm-btn--ghost adm-btn--small"
          onClick={() => {
            setDir(dir() === "asc" ? "desc" : "asc");
            refresh();
          }}
        >
          {dir() === "asc" ? "Artan ↑" : "Azalan ↓"}
        </button>
      </div>
      <p class="adm-muted adm-note">
        E-posta yalnız hesap ayrıntısında görünür; her ayrıntı görüntüleme işlem kaydına yazılır.
      </p>
      <Banner text={error()} />
      <Show when={emailRows()}>
        {(r) => (
          <Show when={r().rows.length > 0} fallback={<p class="adm-muted">Eşleşen hesap yok.</p>}>
            <Results rows={r().rows} limit={r().limit} onOpen={props.onOpen} />
          </Show>
        )}
      </Show>
      <Show when={!emailRows()}>
        <Show when={total() !== null}>
          <p class="adm-muted adm-note">{fmtInt(total() ?? 0)} hesap</p>
        </Show>
        <Show
          when={rows().length > 0}
          fallback={
            <Show when={!busy() && !error()}>
              <p class="adm-muted">Eşleşen hesap yok.</p>
            </Show>
          }
        >
          <ul class="adm-plist">
            <For each={rows()}>{(r) => <PlayerCard r={r} onOpen={props.onOpen} />}</For>
          </ul>
        </Show>
        <Show when={next() !== null}>
          <button
            type="button"
            class="adm-btn adm-btn--ghost"
            disabled={busy()}
            onClick={() => void load(true)}
          >
            {busy() ? "Yükleniyor..." : "Daha fazla göster"}
          </button>
        </Show>
        <Show when={busy() && rows().length === 0}>
          <p class="adm-muted">Yükleniyor...</p>
        </Show>
      </Show>
    </div>
  );
}

export function AccountsPanel(props: { onOtp: () => void }) {
  const [data, setData] = createSignal<AdminAccounts | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [open, setOpen] = createSignal<number | null>(null);
  const [refreshKey, setRefreshKey] = createSignal(0);
  // Dar ekranda (≤700 px) ayrıntı tam ekran ayrı görünümdür; liste ve özet gizlenir (silinmez: süzgeç ve kaydırma korunur).
  const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 700px)") : null;
  const [narrow, setNarrow] = createSignal(mq?.matches ?? false);
  let scrollBack = 0;
  onMount(() => {
    const onChange = (): void => {
      setNarrow(mq?.matches ?? false);
    };
    mq?.addEventListener("change", onChange);
    onCleanup(() => mq?.removeEventListener("change", onChange));
  });
  const openAccount = (id: number): void => {
    scrollBack = window.scrollY;
    setOpen(id);
    if (narrow()) window.scrollTo(0, 0);
  };
  const closeAccount = (): void => {
    setOpen(null);
    if (narrow()) requestAnimationFrame(() => window.scrollTo(0, scrollBack));
  };

  async function load(): Promise<void> {
    setLoading(true);
    const r = await fetchAccounts();
    setLoading(false);
    if (r.kind === "otp") props.onOtp();
    else if (r.kind === "error") setError(r.message);
    else {
      setError(null);
      setData(r.data);
    }
  }
  onMount(() => void load());

  return (
    <section class="adm-section" aria-labelledby="adm-acc-h">
      <header class="adm-section__head">
        <h2 id="adm-acc-h">Hesaplar</h2>
        <button
          type="button"
          class="adm-btn adm-btn--ghost"
          disabled={loading()}
          onClick={() => {
            void load();
            setRefreshKey(refreshKey() + 1);
          }}
        >
          {loading() ? "Yenileniyor..." : "Yenile"}
        </button>
      </header>
      <Banner text={error()} />

      <Show when={narrow() && open() !== null}>
        <button type="button" class="adm-btn adm-btn--ghost adm-back" onClick={closeAccount}>
          ‹ Hesaplar
        </button>
      </Show>

      <div class="adm-acc-list" hidden={narrow() && open() !== null}>
        <PlayerList onOpen={openAccount} onOtp={props.onOtp} refreshKey={refreshKey()} />
      </div>

      <Show when={open()} keyed>
        {(id) => (
          <Detail
            id={id}
            onClose={closeAccount}
            onOtp={props.onOtp}
            onChanged={() => {
              void load();
              setRefreshKey(refreshKey() + 1);
            }}
          />
        )}
      </Show>

      <div class="adm-acc-list" hidden={narrow() && open() !== null}>
        <Show
          when={data()}
          fallback={
            <Show when={!error()}>
              <p class="adm-muted">Yükleniyor...</p>
            </Show>
          }
        >
          {(d) => (
            <Show when={narrow()} fallback={<Overview data={d()} />}>
              <details class="adm-summary">
                <summary>Özet</summary>
                <Overview data={d()} />
              </details>
            </Show>
          )}
        </Show>
      </div>
    </section>
  );
}
