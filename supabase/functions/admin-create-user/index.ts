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
    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !caller) throw new Error("Unauthorized");

    const adminClient = createClient(url, service);
    const { data: callerProfile } = await adminClient.from("profiles").select("role,is_active").eq("id", caller.id).single();
    if (callerProfile?.role !== "admin" || !callerProfile.is_active) throw new Error("Forbidden");

    const body = await req.json();
    const { full_name, email, password, role, student_code } = body;
    if (!full_name || !email || !password || password.length < 8 || !["student", "teacher"].includes(role)) {
      return Response.json({ error: "بيانات غير مكتملة أو غير صحيحة" }, { status: 400, headers: cors });
    }
    const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const { error: profileError } = await adminClient.from("profiles").insert({
      id: data.user.id, full_name, email, role, student_code: student_code || null, is_active: true
    });
    if (profileError) {
      await adminClient.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
    return Response.json({ success: true, user_id: data.user.id }, { headers: cors });
  } catch (e) {
    return Response.json({ error: e.message || "Server error" }, { status: 400, headers: cors });
  }
});