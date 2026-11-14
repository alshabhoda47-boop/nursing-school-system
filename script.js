/* School system frontend - schema aligned */
(() => {
  "use strict";
  const cfg = window.SCHOOL_CONFIG || {};
  const $ = id => document.getElementById(id);
  let db, user, profile, record, tab = "home";

  const roles = {
    admin: "مدير النظام",
    teacher: "عضو هيئة التدريس",
    student: "طالب"
  };

  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const message = (s, bad) => {
    if (!$("appMessage")) return;
    $("appMessage").textContent = s;
    $("appMessage").style.color = bad === false ? "#26704f" : "#9b4a32";
  };

  const run = async q => {
    const r = await q;
    if (r.error) throw r.error;
    return r.data;
  };

  const fmt = d => d ? new Date(d).toLocaleString("ar-EG") : "—";
  const date = d => d ? new Date(d).toLocaleDateString("ar-EG") : "—";

  function tabs() {
    const list = profile.role === "admin"
      ? [["home", "الرئيسية"], ["people", "المستخدمون"], ["decisions", "القرارات"], ["exams", "الاختبارات"], ["results", "النتائج"]]
      : profile.role === "teacher"
      ? [["home", "الرئيسية"], ["exams", "الاختبارات"], ["results", "النتائج"]]
      : [["home", "الرئيسية"], ["decisions", "قراراتي"], ["exams", "الاختبارات"], ["results", "نتائجي"]];

    $("tabs").innerHTML = list.map(x =>
      '<button class="tab ' + (tab === x[0] ? "active" : "") + '" data-tab="' + x[0] + '">' + x[1] + "</button>"
    ).join("");

    $("tabs").querySelectorAll("[data-tab]").forEach(b => {
      b.onclick = () => {
        tab = b.dataset.tab;
        tabs();
        render();
      };
    });
  }

  async function render() {
    $("appMessage").textContent = "";
    try {
      if (tab === "home") home();
      if (tab === "people") await people();
      if (tab === "decisions") await decisions();
      if (tab === "exams") await exams();
      if (tab === "results") await results();
    } catch (e) {
      $("content").innerHTML = '<p class="message">' + esc(e.message) + "</p>";
    }
  }

  function home() {
    $("content").innerHTML =
      "<h2>مرحبًا " + esc(record?.full_name || user.email) + "</h2>" +
      '<p class="muted">أنت مسجل بصفتك ' + roles[profile.role] + "</p>" +
      '<div class="grid">' +
      '<div class="card"><h3>البريد الإلكتروني</h3><p>' + esc(user.email) + "</p></div>" +
      '<div class="card"><h3>الحالة</h3><p>' + esc(record?.status || "نشط") + "</p></div>" +
      "</div>";
  }

  async function people() {
    const [ss, ts] = await Promise.all([
      run(db.from("students").select("id,student_code,full_name,grade,class_name,status,auth_user_id").order("full_name")),
      run(db.from("teachers").select("id,teacher_code,full_name,subject,status,auth_user_id").order("full_name"))
    ]);

    let rows = ss.map(x => ({
      ...x, role: "student", code: x.student_code,
      extra: [x.grade, x.class_name].filter(Boolean).join(" / ")
    })).concat(ts.map(x => ({
      ...x, role: "teacher", code: x.teacher_code, extra: x.subject || ""
    })));

    $("content").innerHTML =
      "<h2>إدارة المستخدمين</h2>" +
      '<form id="createUserForm" class="card">' +
      "<h3>إنشاء حساب طالب أو مدرس</h3>" +
      '<div class="grid">' +
      '<label>الاسم بالكامل<input name="full_name" required></label>' +
      '<label>البريد الإلكتروني<input name="email" type="email" required></label>' +
      '<label>كلمة المرور المؤقتة<input name="password" type="password" minlength="8" required></label>' +
      '<label>الصفة<select name="role"><option value="student">طالب</option><option value="teacher">مدرس</option></select></label>' +
      '<label>الكود<input name="code" required></label>' +
      '<label>الصف<input name="grade"></label>' +
      '<label>الفصل<input name="class_name"></label>' +
      '<label>المادة<input name="subject"></label>' +
      '<label>الهاتف<input name="phone"></label>' +
      '<label>هاتف ولي الأمر<input name="guardian_phone"></label>' +
      '<label>رقم الطالب<input name="student_number"></label>' +
      '</div><button class="btn primary">إنشاء الحساب</button></form>' +
      "<h3>سجلات الطلاب والمدرسين</h3>" +
      '<div class="table-wrap"><table><thead><tr>' +
      "<th>الاسم</th><th>الصفة</th><th>الكود</th><th>بيانات إضافية</th><th>الحالة</th><th>الحساب</th><th>إجراء</th>" +
      "</tr></thead><tbody>" +
      rows.map(p =>
        "<tr><td>" + esc(p.full_name) + "</td><td>" + roles[p.role] + "</td><td>" +
        esc(p.code) + "</td><td>" + esc(p.extra) + "</td><td>" +
        esc(p.status || "active") + "</td><td>" +
        (p.auth_user_id ? "مرتبط" : "غير مرتبط") + "</td><td>" +
        (p.auth_user_id ? '<button class="btn danger" data-delete="' + p.auth_user_id + '">حذف حساب الدخول</button>' : "—") +
        "</td></tr>"
      ).join("") +
      "</tbody></table></div>" +
      '<p class="muted">حذف حساب الدخول لا يحذف السجل الدراسي. إيقاف الدخول مؤقتًا يحتاج وظيفة منفصلة.</p>';

    $("createUserForm").onsubmit = createUser;
    $("content").querySelectorAll("[data-delete]").forEach(b => {
      b.onclick = () => deleteUser(b.dataset.delete);
    });
  }

  async function createUser(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));

    const body = {
      full_name: f.full_name,
      email: f.email,
      password: f.password,
      role: f.role,
      student_code: f.role === "student" ? f.code : undefined,
      teacher_code: f.role === "teacher" ? f.code : undefined,
      grade: f.grade || null,
      class_name: f.class_name || null,
      subject: f.subject || null,
      phone: f.phone || null,
      guardian_phone: f.guardian_phone || null,
      student_number: f.student_number || null
    };

    try {
      const r = await db.functions.invoke("admin-create-user", { body });
      if (r.error) throw r.error;
      if (r.data?.error) throw new Error(r.data.error);
      message("تم إنشاء الحساب بنجاح.", false);
      await people();
    } catch (x) {
      message("تعذر إنشاء الحساب: " + x.message);
    }
  }

  async function deleteUser(id) {
    if (!confirm("سيتم حذف حساب الدخول فقط مع الاحتفاظ بالسجل الدراسي. هل تريد المتابعة؟")) return;

    try {
      const r = await db.functions.invoke("admin-delete-user", {
        body: { user_id: id }
      });
      if (r.error) throw r.error;
      if (r.data?.error) throw new Error(r.data.error);
      message("تم حذف حساب الدخول مع الاحتفاظ بالسجل.", false);
      await people();
    } catch (x) {
      message("تعذر الحذف: " + x.message);
    }
  }

  async function decisions() {
    let q = db.from("student_decisions")
      .select("id,student_id,decision_type,reason,decision_date,start_date,duration_days,notes,created_at,students(full_name,student_code)")
      .order("created_at", { ascending: false });

    if (profile.role === "student") q = q.eq("student_id", record.id);

    const rows = await run(q);
    let form = "";

    if (profile.role === "admin") {
      const ss = await run(
        db.from("students").select("id,full_name,student_code").order("full_name")
      );

      form =
        '<form id="decisionForm" class="card"><h3>إصدار قرار</h3><div class="grid">' +
        '<label>الطالب<select name="student_id" required><option value="">اختر الطالب</option>' +
        ss.map(s =>
          '<option value="' + s.id + '">' + esc(s.full_name) + " — " + esc(s.student_code) + "</option>"
        ).join("") +
        "</select></label>" +
        '<label>نوع القرار<select name="decision_type"><option value="parent_summons">استدعاء ولي أمر</option><option value="expulsion">فصل</option></select></label>' +
        '<label>تاريخ القرار<input name="decision_date" type="date" required value="' + new Date().toISOString().slice(0, 10) + '"></label>' +
        '<label>تاريخ البدء<input name="start_date" type="date"></label>' +
        '<label>المدة بالأيام<input name="duration_days" type="number" min="1"></label>' +
        '<label>السبب<textarea name="reason" required></textarea></label>' +
        '<label>ملاحظات<textarea name="notes"></textarea></label>' +
        '</div><button class="btn primary">حفظ القرار</button></form>';
    }

    $("content").innerHTML =
      "<h2>" + (profile.role === "admin" ? "إدارة القرارات" : "قراراتي") + "</h2>" +
      form +
      (rows.length ? rows.map(d =>
        '<article class="decision"><div class="row"><h3>' +
        (d.decision_type === "expulsion" ? "قرار فصل" : "استدعاء ولي أمر") +
        '</h3><span class="muted">' + date(d.decision_date) + "</span></div>" +
        (profile.role === "admin" ? "<p>الطالب: " + esc(d.students?.full_name) + " (" + esc(d.students?.student_code) + ")</p>" : "") +
        "<p>" + esc(d.reason) + "</p>" +
        (d.start_date ? "<p>بدء التنفيذ: " + date(d.start_date) + "</p>" : "") +
        (d.duration_days ? "<p>المدة: " + esc(d.duration_days) + " يوم</p>" : "") +
        (d.notes ? "<p>ملاحظات: " + esc(d.notes) + "</p>" : "") +
        '<button class="btn gold" data-print="' + d.id + '">طباعة القرار</button></article>'
      ).join("") : '<div class="empty">لا توجد قرارات حتى الآن</div>');

    if ($("decisionForm")) {
      $("decisionForm").onsubmit = async e => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));

        try {
          await run(db.from("student_decisions").insert({
            student_id: f.student_id,
            decision_type: f.decision_type,
            reason: f.reason,
            decision_date: f.decision_date,
            start_date: f.start_date || null,
            duration_days: f.duration_days ? Number(f.duration_days) : null,
            notes: f.notes || null,
            created_by: user.id
          }));
          message("تم حفظ القرار.", false);
          await decisions();
        } catch (x) {
          message("تعذر حفظ القرار: " + x.message);
        }
      };
    }

    $("content").querySelectorAll("[data-print]").forEach(b => {
      b.onclick = () => {
        const d = rows.find(x => x.id === b.dataset.print);
        const w = window.open("", "_blank");

        if (!w) {
          message("اسمح بفتح النوافذ المنبثقة للطباعة.");
          return;
        }

        w.document.write(
          '<html lang="ar" dir="rtl"><meta charset="utf-8"><title>قرار مدرسي</title>' +
          "<style>body{font-family:Tahoma;padding:50px;line-height:2}h1,h2{text-align:center}</style>" +
          "<h1>مدرسة الجيزة الفنية للتمريض براجيل</h1>" +
          "<h2>" + (d.decision_type === "expulsion" ? "قرار فصل" : "استدعاء ولي أمر") + "</h2>" +
          "<p>الطالب: " + esc(d.students?.full_name) + "</p>" +
          "<p>الكود: " + esc(d.students?.student_code) + "</p>" +
          "<p>السبب: " + esc(d.reason) + "</p>" +
          "<p>التاريخ: " + date(d.decision_date) + "</p>" +
          "<p>مدير المدرسة: ....................</p>" +
          "<script>window.print()<\/script></html>"
        );

        w.document.close();
      };
    });
  }

  async function exams() {
    let q = db.from("exams")
      .select("id,title,description,teacher_id,start_time,end_time,duration_minutes,is_open,publish_results,grade,exam_type,subject,questions,created_at")
      .order("created_at", { ascending: false });

    if (profile.role === "teacher") q = q.eq("teacher_id", record.id);

    const list = await run(q);
    let teacherField = "";

    if (profile.role === "admin") {
      const ts = await run(
        db.from("teachers").select("id,full_name,teacher_code").order("full_name")
      );

      teacherField =
        '<label>المدرس المسؤول<select name="teacher_id"><option value="">بدون تحديد</option>' +
        ts.map(t =>
          '<option value="' + t.id + '">' + esc(t.full_name) + " — " + esc(t.teacher_code) + "</option>"
        ).join("") +
        "</select></label>";
    }

    const form = ["admin", "teacher"].includes(profile.role)
      ? '<form id="examForm" class="card"><h3>إنشاء اختبار</h3><div class="grid">' +
        '<label>العنوان<input name="title" required></label>' +
        '<label>المادة<input name="subject"></label>' +
        '<label>الصف<input name="grade"></label>' +
        '<label>نوع الاختبار<input name="exam_type"></label>' +
        '<label>المدة بالدقائق<input name="duration_minutes" type="number" min="1" required></label>' +
        '<label>موعد الفتح<input name="start_time" type="datetime-local"></label>' +
        '<label>موعد الإغلاق<input name="end_time" type="datetime-local"></label>' +
        teacherField +
        '<label>الوصف<textarea name="description"></textarea></label></div>' +
        '<p class="muted">سيُحفظ الاختبار كمسودة مغلقة. إضافة الأسئلة وخدمة التصحيح الآمن مطلوبة قبل فتحه للطلاب.</p>' +
        '<button class="btn primary">إنشاء الاختبار</button></form>'
      : "";

    $("content").innerHTML =
      "<h2>الاختبارات</h2>" + form +
      (list.length
        ? '<div class="grid">' + list.map(x =>
          '<div class="card"><h3>' + esc(x.title) + "</h3>" +
          "<p>" + esc(x.description || "") + "</p>" +
          "<p>المادة: " + esc(x.subject || "—") + " · الصف: " + esc(x.grade || "—") + "</p>" +
          "<p>المدة: " + esc(x.duration_minutes || "—") + " دقيقة</p>" +
          "<p>من " + fmt(x.start_time) + " إلى " + fmt(x.end_time) + "</p>" +
          "<p>الحالة: " + (x.is_open ? "مفتوح" : "مغلق") + "</p>" +
          (profile.role === "student"
            ? '<p class="muted">أداء الامتحان سيتاح بعد نشر خدمة بدء المحاولة والتصحيح.</p>'
            : "<p>عدد الأسئلة: " + (Array.isArray(x.questions) ? x.questions.length : 0) + "</p>" +
              '<button class="btn gold" data-open="' + x.id + '" data-state="' + (x.is_open === true) + '">' +
              (x.is_open ? "إغلاق" : "فتح") + " الاختبار</button>") +
          "</div>"
        ).join("") + "</div>"
        : '<div class="empty">لا توجد اختبارات متاحة</div>');

    if ($("examForm")) {
      $("examForm").onsubmit = async e => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));

        const payload = {
          title: f.title,
          description: f.description || null,
          subject: f.subject || null,
          grade: f.grade || null,
          exam_type: f.exam_type || null,
          duration_minutes: Number(f.duration_minutes),
          start_time: f.start_time ? new Date(f.start_time).toISOString() : null,
          end_time: f.end_time ? new Date(f.end_time).toISOString() : null,
          is_open: false,
          publish_results: false,
          teacher_id: profile.role === "teacher" ? record.id : (f.teacher_id || null),
          questions: []
        };

        try {
          await run(db.from("exams").insert(payload));
          message("تم إنشاء الاختبار كمسودة مغلقة.", false);
          await exams();
        } catch (x) {
          message("تعذر إنشاء الاختبار: " + x.message);
        }
      };
    }

    $("content").querySelectorAll("[data-open]").forEach(b => {
      b.onclick = async () => {
        const open = b.dataset.state !== "true";

        if (open && !confirm("فتح الاختبار؟ تأكد من إضافة الأسئلة أولًا.")) return;

        try {
          await run(db.from("exams").update({ is_open: open }).eq("id", b.dataset.open));
          message("تم تحديث حالة الاختبار.", false);
          await exams();
        } catch (x) {
          message("تعذر تحديث الاختبار: " + x.message);
        }
      };
    });
  }

  async function results() {
    let q = db.from("results")
      .select("id,student_id,exam_id,score,submitted_at,exams(title,subject),students(full_name,student_code)")
      .order("submitted_at", { ascending: false });

    if (profile.role === "student") q = q.eq("student_id", record.id);

    const list = await run(q);

    $("content").innerHTML =
      "<h2>" + (profile.role === "student" ? "نتائجي" : "نتائج الاختبارات") + "</h2>" +
      (list.length
        ? '<div class="table-wrap"><table><thead><tr>' +
          (profile.role === "admin" ? "<th>الطالب</th>" : "") +
          "<th>الاختبار</th><th>المادة</th><th>الدرجة</th><th>تاريخ التسليم</th>" +
          "</tr></thead><tbody>" +
          list.map(r =>
            "<tr>" +
            (profile.role === "admin" ? "<td>" + esc(r.students?.full_name) + "</td>" : "") +
            "<td>" + esc(r.exams?.title || "—") + "</td>" +
            "<td>" + esc(r.exams?.subject || "—") + "</td>" +
            "<td>" + (r.score == null ? "لم تُصحح بعد" : esc(r.score)) + "</td>" +
            "<td>" + fmt(r.submitted_at) + "</td></tr>"
          ).join("") +
          "</tbody></table></div>"
        : '<div class="empty">لا توجد نتائج منشورة أو مسجلة حاليًا.</div>');
  }

  async function start(session) {
    user = session.user;

    profile = await run(
      db.from("user_profiles")
        .select("user_id,role,created_at")
        .eq("user_id", user.id)
        .single()
    );

    if (!["admin", "teacher", "student"].includes(profile.role)) {
      throw new Error("نوع الحساب غير معروف.");
    }

    record = null;

    if (profile.role === "student") {
      record = await run(
        db.from("students")
          .select("id,full_name,student_code,status,grade,class_name")
          .eq("auth_user_id", user.id)
          .single()
      );
    }

    if (profile.role === "teacher") {
      record = await run(
        db.from("teachers")
          .select("id,full_name,teacher_code,status,subject")
          .eq("auth_user_id", user.id)
          .single()
      );
    }

    if (record && ["inactive", "suspended"].includes(record.status)) {
      throw new Error("هذا الحساب غير نشط. راجع إدارة المدرسة.");
    }

    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");

    $("welcomeTitle").textContent = "مرحبًا " + (record?.full_name || user.email || "");
    $("userRole").textContent = roles[profile.role];

    tab = "home";
    tabs();
    await render();
  }

  async function init() {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      $("loginMessage").textContent = "إعدادات Supabase غير مكتملة في config.js.";
      return;
    }

    db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

    $("loginForm").onsubmit = async e => {
      e.preventDefault();
      $("loginMessage").textContent = "جارٍ تسجيل الدخول...";

      try {
        const r = await db.auth.signInWithPassword({
          email: $("email").value.trim(),
          password: $("password").value
        });

        if (r.error) throw r.error;

        await start(r.data.session);
        $("loginMessage").textContent = "";
      } catch (x) {
        $("loginMessage").textContent = x.message;
      }
    };

    $("logoutBtn").onclick = async () => {
      await db.auth.signOut();
      location.reload();
    };

    const s = await db.auth.getSession();

    if (s.data?.session) {
      try {
        await start(s.data.session);
      } catch (x) {
        await db.auth.signOut();
        $("loginMessage").textContent = x.message;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
