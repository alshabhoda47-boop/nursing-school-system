import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) throw new Error("Unauthorized");
    const adminClient = createClient(url, service);
    const { data: p } = await adminClient.from("profiles").select("role,is_active").eq("id", caller.id).single();
    if (p?.role !== "admin" || !p.is_active) throw new Error("Forbidden");
    const { user_id } = await req.json();
    if (!user_id || user_id === caller.id) throw new Error("Invalid user");
    const { error } = await adminClient.auth.admin.deleteUser(user_id);
    if (error) throw error;
    return Response.json({ success: true }, { headers: cors });
  } catch (e) {
    return Response.json({ error: e.message || "Server error" }, { status: 400, headers: cors });
  }
});