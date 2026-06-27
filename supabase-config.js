/* Supabase connection for FAWN.
   The publishable key is meant to be public — it only allows what the
   database's Row-Level Security policies permit (public can READ products;
   only Jessica's signed-in account can WRITE). The real security is the RLS
   policies on the server, not hiding this key. */
window.FAWN_SUPABASE = {
  url: "https://zutihcvdczoumrydrdmw.supabase.co",
  key: "sb_publishable_EQ4oj2MAlVQ0W9R4auGxEA_uFKL0vi_",
  ownerEmail: "jessicapotterrr@gmail.com",
  bucket: "item-photos",
};

window.fawnClient =
  (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(window.FAWN_SUPABASE.url, window.FAWN_SUPABASE.key)
    : null;
