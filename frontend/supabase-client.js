// Shared Supabase client — loaded by login.html, signup.html, and index.html
// (after the Supabase CDN script, before script.js/login logic run).
//
// The key below is a "publishable" (anon/public) key: it's meant to be
// visible in client-side code — Supabase's Row Level Security policies are
// what actually protect your data, not secrecy of this key. It is NOT the
// same kind of secret as the Groq/OpenRouter/Gemini keys in the backend's
// .env, so there's no need to hide this one behind a server.
const SUPABASE_URL = "https://bmaeckojpiukvecomlxe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7bsoGUbrcIUeaCuECa3hTw_abkMbt3p";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
