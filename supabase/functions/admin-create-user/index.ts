
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

  let adminClient: ReturnType<typeof createClient> | null = null;
  let createdUserId: string | null = null;
  let createdRecord: { table: "students" | "teachers"; id: string } | null = null;

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
    if (authError || !authData.user) return response({ error: "Unauthorized" }, 401);

    adminClient = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (callerProfile?.role !== "admin") return response({ error: "Forbidden" }, 403);

    const body = await req.json();
    const full_name = String(body.full_name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "");
    const code = String(
      role === "student" ? body.student_code ?? "" : body.teacher_code ?? ""
    ).trim();

    if (!full_name || !email || !email.includes("@") || password.length < 8) {
      return response({ error: "الاسم والبريد وكلمة مرور من 8 أحرف على الأقل مطلوبة." }, 400);
    }

    if (role !== "student" && role !== "teacher") {
      return response({ error: "نوع الحساب غير مسموح." }, 400);
    }

    if (!code) return response({ error: "كود الطالب أو المدرس مطلوب." }, 400);

    const { data: newAuth, error: createAuthError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role },
      });

    if (createAuthError) throw createAuthError;
    if (!newAuth.user) throw new Error("لم يتم إنشاء مستخدم المصادقة.");

    createdUserId = newAuth.user.id;

    const { error: addProfileError } = await adminClient
      .from("user_profiles")
      .insert({
        user_id: createdUserId,
        role,
      });

    if (addProfileError) throw addProfileError;

    if (role === "student") {
      const { data, error } = await adminClient
        .from("students")
        .insert({
          student_code: code,
          full_name,
          phone: body.phone || null,
          guardian_phone: body.guardian_phone || null,
          student_number: body.student_number || null,
          grade: body.grade || null,
          class_name: body.class_name || null,
          status: "active",
          auth_user_id: createdUserId,
        })
        .select("id")
        .single();

      if (error) throw error;
      createdRecord = { table: "students", id: data.id };
    } else {
      const { data, error } = await adminClient
        .from("teachers")
        .insert({
          teacher_code: code,
          full_name,
          email,
          subject: body.subject || null,
          status: "active",
          auth_user_id: createdUserId,
        })
        .select("id")
        .single();

      if (error) throw error;
      createdRecord = { table: "teachers", id: data.id };
    }

    return response({ success: true, user_id: createdUserId, role });

  } catch (error) {
    if (adminClient && createdUserId) {
      if (createdRecord) {
        await adminClient
          .from(createdRecord.table)
          .delete()
          .eq("id", createdRecord.id);
      }

      await adminClient.auth.admin.deleteUser(createdUserId);
    }

    const message = error instanceof Error ? error.message : "Server error";
    return response({ error: message }, 400);
  }
});
