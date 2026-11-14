
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!url || !anon || !service) throw new Error("إعدادات الخادم غير مكتملة.");
    if (!authHeader) return response({ error: "Unauthorized" }, 401);

    const callerClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await callerClient.auth.getUser();

    if (authError || !authData.user) {
      return response({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (callerProfile?.role !== "admin") {
      return response({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const targetId = String(body.user_id ?? "").trim();

    if (!targetId || targetId === authData.user.id) {
      return response({ error: "معرّف الحساب غير صالح." }, 400);
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("user_id", targetId)
      .maybeSingle();

    if (targetError) throw targetError;

    if (!targetProfile || !["student", "teacher"].includes(targetProfile.role)) {
      return response({ error: "الحساب غير موجود أو لا يمكن حذفه." }, 404);
    }

    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(targetId);

    if (deleteError) throw deleteError;

    return response({
      success: true,
      message: "تم حذف حساب الدخول مع الاحتفاظ بالسجل الدراسي."
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return response({ error: message }, 400);
  }
});
