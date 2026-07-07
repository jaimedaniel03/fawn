/* FAWN admin — PIN login + all data through session-gated Edge Functions.
   No PIN, password, hash, or service key lives in this file. The PIN is verified
   server-side; this page only ever holds a short-lived session token. */
const cfg = window.FAWN_SUPABASE;
const $ = (id) => document.getElementById(id);
const FN = (n) => `${cfg.url}/functions/v1/${n}`;
const TOKEN_KEY = "fawn_admin_token";
let autoLockTimer = null;
let products = [];

async function callFn(name, body) {
  try {
    const res = await fetch(FN(name), {
      method: "POST",
      headers: { apikey: cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* ignore */ }
    return { ok: res.ok, status: res.status, data };
  } catch (_) {
    // Network failure / server unreachable (e.g. backend paused): never throw, so the
    // page always reaches a usable state and shows a clear message instead of "Invalid PIN".
    return { ok: false, status: 0, data: { error: "Can't reach the server. Check your connection and try again." } };
  }
}
const getToken = () => sessionStorage.getItem(TOKEN_KEY) || "";
const setToken = (t) => sessionStorage.setItem(TOKEN_KEY, t);
const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
function msg(el, text, kind) { el.innerHTML = text ? `<p class="msg ${kind || ""}">${text}</p>` : ""; }

function show(view) {
  $("pinView").hidden = view !== "pin";
  $("dashView").hidden = view !== "dash";
  $("lockBtn").hidden = view !== "dash";
}

/* ---- session lifecycle ---- */
async function boot() {
  const t = getToken();
  if (t) {
    const r = await callFn("admin-api", { action: "session", token: t });
    if (r.ok && r.data.valid) { unlock(r.data.expires_at); return; }
    clearToken();
  }
  show("pin");
  $("pin").focus();
}
function scheduleAutoLock(expiresAt) {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms > 0) autoLockTimer = setTimeout(() => lock("your session expired — please unlock again."), ms);
}
function unlock(expiresAt) {
  show("dash");
  scheduleAutoLock(expiresAt);
  loadItems(); loadOrders(); loadSignups();
}
function lock(note) {
  clearToken();
  if (autoLockTimer) clearTimeout(autoLockTimer);
  show("pin");
  msg($("pinMsg"), note || "", note ? "info" : "");
  $("pin").value = "";
}

/* ---- PIN unlock ---- */
$("pinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pin = $("pin").value.trim();
  msg($("pinMsg"), `<span class="spin"></span>verifying…`, "info");
  $("unlockBtn").disabled = true;
  const r = await callFn("verify-admin-pin", { pin });
  $("unlockBtn").disabled = false;
  if (r.ok && r.data.token) {
    setToken(r.data.token);
    msg($("pinMsg"), "", "");
    unlock(r.data.expires_at);
  } else if (r.status === 429) {
    msg($("pinMsg"), "Too many attempts. Try again later.", "err");
    $("pin").value = "";
  } else if (r.status === 0 || r.status >= 500) {
    msg($("pinMsg"), r.data.error || "Can't reach the server right now. Try again in a moment.", "err");
  } else {
    msg($("pinMsg"), "Invalid PIN", "err");
    $("pin").value = ""; $("pin").focus();
  }
});

$("lockBtn").addEventListener("click", () => {
  const t = getToken();
  if (t) callFn("admin-api", { action: "logout", token: t });
  lock();
});

/* admin-api call that auto-locks on an expired/invalid session */
async function api(action, extra) {
  const r = await callFn("admin-api", { action, token: getToken(), ...(extra || {}) });
  if (r.status === 401) { lock("your session expired — please unlock again."); throw new Error("session"); }
  return r;
}

/* ---- photo downscale → base64 (no data: prefix) ---- */
function downscale(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img; const MAX = 1024;
      if (Math.max(width, height) > MAX) { const r = MAX / Math.max(width, height); width = Math.round(width * r); height = Math.round(height * r); }
      const c = document.createElement("canvas"); c.width = width; c.height = height;
      c.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve({ b64: c.toDataURL("image/jpeg", 0.85).split(",")[1], type: "image/jpeg" });
    };
    img.onerror = reject; img.src = url;
  });
}

/* ---- add / edit item ---- */
function resetForm() {
  $("itemForm").reset(); $("iEditId").value = "";
  $("cancelEdit").hidden = true; $("saveBtn").textContent = "add to shop ✨"; $("addTitle").textContent = "add an item";
}
$("cancelEdit").addEventListener("click", resetForm);

$("itemForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("saveBtn"); btn.disabled = true;
  msg($("itemMsg"), `<span class="spin"></span>saving…`, "info");
  try {
    const brand = $("iBrand").value.trim(), size = $("iSize").value.trim(), condition = $("iCondition").value.trim();
    const product = {
      title: $("iTitle").value.trim(), size, condition, brand, category: $("iCategory").value.trim(),
      blurb: [brand, size, condition].filter(Boolean).join(" · "),
      description: $("iDesc").value.trim(),
      price: Number($("iPrice").value) || 0, resale: Number($("iResale").value) || 0,
      flag: $("iFlag").value, sold: $("iSold").checked, hidden: $("iHidden").checked,
      pay_link: $("iPayLink").value.trim(),
    };
    let img = {};
    const file = $("iPhoto").files[0];
    if (file) { const d = await downscale(file); img = { image_b64: d.b64, image_type: d.type }; }
    const editId = $("iEditId").value;
    const r = await api(editId ? "update_product" : "create_product", { product, id: editId || undefined, ...img });
    if (!r.ok) throw new Error(r.data.error || "save failed");
    resetForm();
    msg($("itemMsg"), editId ? "saved ✓" : "added to your shop 🌿", "ok");
    loadItems();
  } catch (err) {
    if (err.message !== "session") msg($("itemMsg"), err.message, "err");
  } finally { btn.disabled = false; }
});

/* ---- items ---- */
async function loadItems() {
  const list = $("itemList"); list.innerHTML = '<p class="muted">loading…</p>';
  try {
    const r = await api("list_products");
    products = r.data.products || [];
    $("itemCount").textContent = products.length ? `(${products.length})` : "";
    list.innerHTML = products.length ? products.map(itemRow).join("") : '<p class="muted">no items yet — add your first above.</p>';
  } catch (e) { if (e.message !== "session") list.innerHTML = '<p class="msg err">couldn\'t load items.</p>'; }
}
function itemRow(r) {
  const thumb = r.image_url ? `<img class="item-thumb" src="${esc(r.image_url)}" alt="" />` : `<div class="item-ph">FAWN</div>`;
  const meta = esc(r.blurb || [r.brand, r.size, r.condition].filter(Boolean).join(" · "));
  return `<div class="item">
    ${thumb}
    <div class="item-info">
      <h4>${esc(r.title)}</h4>
      <div class="meta">${meta}${r.flag ? " · " + esc(r.flag) : ""}${r.hidden ? ' · <span style="color:#855a0f">draft</span>' : ""}${r.pay_link ? " · 💳" : ""}</div>
      <div class="price">$${Math.round(r.price)}${r.resale ? ` <s style="color:var(--ink-soft)">$${Math.round(r.resale)}</s>` : ""}</div>
    </div>
    <div class="item-actions">
      <button class="pill" data-edit="${r.id}">edit</button>
      <button class="pill ${r.sold ? "sold" : ""}" data-sold="${r.id}">${r.sold ? "sold ✓" : "mark sold"}</button>
      <button class="pill del" data-del="${r.id}">delete</button>
    </div>
  </div>`;
}
$("itemList").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-edit]"), sd = e.target.closest("[data-sold]"), dl = e.target.closest("[data-del]");
  if (ed) { startEdit(products.find((p) => p.id === ed.dataset.edit)); return; }
  if (sd) {
    const p = products.find((x) => x.id === sd.dataset.sold); if (!p) return;
    sd.disabled = true;
    try { await api("update_product", { id: p.id, product: { ...p, sold: !p.sold } }); loadItems(); } catch (_) { /* handled */ }
    return;
  }
  if (dl) {
    if (!confirm("Delete this item for good?")) return;
    try { await api("delete_product", { id: dl.dataset.del }); loadItems(); } catch (_) { /* handled */ }
  }
});
function startEdit(p) {
  if (!p) return;
  $("iEditId").value = p.id; $("iTitle").value = p.title || ""; $("iSize").value = p.size || ""; $("iCondition").value = p.condition || "";
  $("iBrand").value = p.brand || ""; $("iCategory").value = p.category || ""; $("iPrice").value = p.price || ""; $("iResale").value = p.resale || "";
  $("iFlag").value = p.flag || ""; $("iDesc").value = p.description || ""; $("iPayLink").value = p.pay_link || "";
  $("iSold").checked = !!p.sold; $("iHidden").checked = !!p.hidden;
  $("cancelEdit").hidden = false; $("saveBtn").textContent = "save changes"; $("addTitle").textContent = "edit item";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---- orders ---- */
async function loadOrders() {
  const list = $("orderList");
  try {
    const r = await api("list_orders");
    const data = r.data.orders || [];
    $("orderCount").textContent = data.length ? `(${data.length})` : "";
    list.innerHTML = data.length ? data.map(orderRow).join("") : '<p class="muted">no orders yet.</p>';
  } catch (e) { if (e.message !== "session") list.innerHTML = '<p class="msg err">couldn\'t load orders.</p>'; }
}
function orderRow(o) {
  const when = new Date(o.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const items = Array.isArray(o.items) ? o.items.map((i) => esc(i.title || i.t || "item")).join(", ") : "";
  const ship = o.delivery === "ship" ? `ship → ${esc(o.address || "")}` : "local pickup";
  return `<div class="item" style="align-items:flex-start">
    <div class="item-info">
      <h4>${esc(o.code || "order")} · $${Math.round(o.total || 0)}</h4>
      <div class="meta">${esc(o.name || "")} · ${esc(o.email || "")}</div>
      <div class="meta">${items}</div>
      <div class="meta">${ship} · paid via ${esc(o.payment || "?")} · ${when}</div>
    </div>
    <div class="item-actions">
      <button class="pill ${o.status === "done" ? "sold" : ""}" data-order-done="${o.id}" data-cur="${o.status === "done" ? 1 : 0}">${o.status === "done" ? "done ✓" : "mark done"}</button>
    </div>
  </div>`;
}
$("orderList").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-order-done]");
  if (!b) return;
  b.disabled = true;
  try { await api("mark_order", { id: b.dataset.orderDone, status: b.dataset.cur === "1" ? "new" : "done" }); loadOrders(); } catch (_) { /* handled */ }
});

/* ---- signups ---- */
async function loadSignups() {
  const list = $("signupList");
  try {
    const r = await api("list_signups");
    const data = r.data.signups || [];
    $("signupCount").textContent = data.length ? `(${data.length})` : "";
    list.innerHTML = data.length ? `<p class="muted" style="word-break:break-word">${data.map((s) => esc(s.email)).join(", ")}</p>` : '<p class="muted">no signups yet.</p>';
  } catch (e) { if (e.message !== "session") list.innerHTML = '<p class="msg err">couldn\'t load signups.</p>'; }
}

/* ---- change PIN ---- */
$("pinChangeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cp = $("curPin").value.trim();
  const np = $("newPin").value.trim();
  if (!/^\d{4}$/.test(cp) || !/^\d{4}$/.test(np)) { msg($("pinChangeMsg"), "Both PINs must be exactly 4 digits.", "err"); return; }
  try {
    const r = await api("change_pin", { current_pin: cp, new_pin: np });
    if (r.ok) { msg($("pinChangeMsg"), "PIN updated ✓ — other devices were signed out.", "ok"); $("curPin").value = ""; $("newPin").value = ""; }
    else msg($("pinChangeMsg"), r.data.error || "couldn't update PIN.", "err");
  } catch (_) { /* handled */ }
});

boot();
