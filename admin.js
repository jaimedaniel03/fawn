/* FAWN owner dashboard — login + manage inventory via Supabase. */
const cfg = window.FAWN_SUPABASE;
const c = window.fawnClient;
const $ = (s) => document.querySelector(s);

let mode = "signin"; // or "signup"

function show(view) {
  ["authView", "notOwnerView", "dashView"].forEach((v) => {
    $("#" + v).hidden = v !== view;
  });
  $("#signOutBtn").hidden = view === "authView";
}
function msg(el, text, type) {
  el.innerHTML = text ? `<div class="msg ${type}">${text}</div>` : "";
}

if (!c) {
  document.querySelector(".admin").innerHTML =
    '<div class="panel"><h2>Couldn\'t connect</h2><p class="muted">The Supabase client failed to load. Check your connection and refresh.</p></div>';
}

/* ---------- auth ---------- */
async function refreshAuth() {
  const { data: { session } } = await c.auth.getSession();
  const user = session?.user || null;
  if (!user) { show("authView"); return; }
  if ((user.email || "").toLowerCase() !== cfg.ownerEmail.toLowerCase()) {
    $("#whoEmail").textContent = user.email;
    show("notOwnerView");
    return;
  }
  show("dashView");
  loadItems();
}

$("#toggleMode").addEventListener("click", () => {
  mode = mode === "signin" ? "signup" : "signin";
  const signup = mode === "signup";
  $("#authTitle").textContent = signup ? "create your account" : "welcome back, jess";
  $("#authSub").textContent = signup
    ? "set the password you'll use to manage your shop."
    : "sign in to manage your shop.";
  $("#authBtn").textContent = signup ? "create account" : "sign in";
  $("#password").autocomplete = signup ? "new-password" : "current-password";
  $("#toggleHint").textContent = signup ? "already set up?" : "first time?";
  $("#toggleMode").textContent = signup ? "sign in" : "create your account";
  msg($("#authMsg"), "", "");
});

$("#authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const btn = $("#authBtn");
  btn.disabled = true;
  msg($("#authMsg"), '<span class="spin"></span>working…', "info");
  try {
    if (mode === "signup") {
      const { data, error } = await c.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) {
        msg($("#authMsg"), "you're in!", "ok");
      } else {
        msg($("#authMsg"), "account created — check your email to confirm, then sign in. (check spam too)", "info");
        mode = "signin";
      }
    } else {
      const { error } = await c.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    msg($("#authMsg"), err.message || "Something went wrong.", "err");
  } finally {
    btn.disabled = false;
  }
});

$("#signOutBtn").addEventListener("click", async () => {
  await c.auth.signOut();
});

if (c) c.auth.onAuthStateChange(() => refreshAuth());

/* ---------- photos ---------- */
function downscale(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const MAX = 1100;
      if (Math.max(width, height) > MAX) {
        const r = MAX / Math.max(width, height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const cv = document.createElement("canvas");
      cv.width = width; cv.height = height;
      cv.getContext("2d").drawImage(img, 0, 0, width, height);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error("image error"))), "image/jpeg", 0.85);
    };
    img.onerror = () => reject(new Error("couldn't read that image"));
    img.src = url;
  });
}
async function uploadPhoto(file) {
  const blob = await downscale(file);
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await c.storage.from(cfg.bucket).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return c.storage.from(cfg.bucket).getPublicUrl(path).data.publicUrl;
}

/* ---------- add item ---------- */
$("#itemForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#saveBtn");
  btn.disabled = true;
  msg($("#itemMsg"), '<span class="spin"></span>saving…', "info");
  try {
    const size = $("#iSize").value.trim();
    const condition = $("#iCondition").value.trim();
    const file = $("#iPhoto").files[0];
    let image_url = "";
    if (file) image_url = await uploadPhoto(file);
    const { error } = await c.from("products").insert({
      title: $("#iTitle").value.trim(),
      size, condition,
      blurb: [size, condition].filter(Boolean).join(" · "),
      price: Number($("#iPrice").value) || 0,
      resale: Number($("#iResale").value) || 0,
      flag: $("#iFlag").value,
      sold: $("#iSold").checked,
      image_url,
    });
    if (error) throw error;
    $("#itemForm").reset();
    msg($("#itemMsg"), "added to your shop 🌿", "ok");
    loadItems();
  } catch (err) {
    msg($("#itemMsg"), err.message || "Couldn't save.", "err");
  } finally {
    btn.disabled = false;
  }
});

/* ---------- list / edit / delete ---------- */
async function loadItems() {
  const list = $("#itemList");
  list.innerHTML = '<p class="muted">loading…</p>';
  const { data, error } = await c
    .from("products").select("*")
    .order("sold", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) { list.innerHTML = `<p class="msg err">${error.message}</p>`; return; }
  $("#itemCount").textContent = data.length ? `(${data.length})` : "";
  if (!data.length) { list.innerHTML = '<p class="muted">no items yet — add your first above.</p>'; return; }
  list.innerHTML = data.map(itemRow).join("");
}
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function itemRow(r) {
  const thumb = r.image_url
    ? `<img class="item-thumb" src="${esc(r.image_url)}" alt="" />`
    : `<div class="item-ph">FAWN</div>`;
  const meta = esc(r.blurb || [r.size, r.condition].filter(Boolean).join(" · "));
  return `<div class="item" data-id="${r.id}">
    ${thumb}
    <div class="item-info">
      <h4>${esc(r.title)}</h4>
      <div class="meta">${meta}${r.flag ? " · " + esc(r.flag) : ""}</div>
      <div class="price">$${Math.round(r.price)}${r.resale ? ` <s style="color:var(--ink-soft)">$${Math.round(r.resale)}</s>` : ""}</div>
    </div>
    <div class="item-actions">
      <button class="pill ${r.sold ? "sold" : ""}" data-sold="${r.id}" data-cur="${r.sold ? 1 : 0}">${r.sold ? "sold ✓" : "mark sold"}</button>
      <button class="pill del" data-del="${r.id}">delete</button>
    </div>
  </div>`;
}

$("#itemList").addEventListener("click", async (e) => {
  const soldBtn = e.target.closest("[data-sold]");
  const delBtn = e.target.closest("[data-del]");
  if (soldBtn) {
    const id = soldBtn.dataset.sold;
    const next = soldBtn.dataset.cur === "1" ? false : true;
    soldBtn.disabled = true;
    const { error } = await c.from("products").update({ sold: next }).eq("id", id);
    if (error) alert(error.message);
    loadItems();
  }
  if (delBtn) {
    if (!confirm("Delete this item for good?")) return;
    const { error } = await c.from("products").delete().eq("id", delBtn.dataset.del);
    if (error) alert(error.message);
    loadItems();
  }
});

/* ---------- go ---------- */
if (c) refreshAuth();
