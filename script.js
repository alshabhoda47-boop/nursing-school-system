
/* =====================================================
   مدرسة الجيزة الفنية للتمريض براجيل
   script.js
   ===================================================== */

(() => {
  "use strict";

  const cfg = window.SCHOOL_CONFIG || {};
  const $ = id => document.getElementById(id);

  let db = null;
  let user = null;
  let profile = null;
  let record = null;
  let currentTab = "home";
  let activeAttempt = null;
  let examTimer = null;

  const roles = {
    admin: "مدير النظام",
    teacher: "مدرس",
    student: "طالب"
  };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

  async function run(query) {
    const result = await query;
    if (result.error) throw result.error;
    return result.data;
  }

  function showMessage(message, success = false) {
    const el = $("appMessage");
    if (!el) return;
    el.textContent = message;
    el.style.color = success ? "#26704f" : "#b42318";
  }

  function formatDate(value) {
    return value
      ? new Date(value).toLocaleString("ar-EG")
      : "—";
  }

  function isStaff() {
    return ["admin", "teacher"].includes(profile.role);
  }

  function stopTimer() {
    if (examTimer) {
      clearInterval(examTimer);
      examTimer = null;
    }
  }

  /* =========================
     التنقل بين الصفحات
  ========================= */

  function renderTabs() {
    let items = [];

    if (profile.role === "admin") {
      items = [
        ["home", "الرئيسية"],
        ["people", "المستخدمون"],
        ["decisions", "القرارات"],
        ["exams", "الاختبارات"],
        ["results", "النتائج"]
      ];
    } else if (profile.role === "teacher") {
      items = [
        ["home", "الرئيسية"],
        ["exams", "الاختبارات"],
        ["results", "النتائج"]
      ];
    } else {
      items = [
        ["home", "الرئيسية"],
        ["decisions", "قراراتي"],
        ["exams", "الاختبارات"],
        ["results", "نتائجي"]
      ];
    }

    $("tabs").innerHTML = items.map(item => `
      <button class="tab ${currentTab === item[0] ? "active" : ""}"
        data-tab="${item[0]}">
        ${item[1]}
      </button>
    `).join("");

    $("tabs").querySelectorAll("[data-tab]").forEach(button => {
      button.onclick = () => {
        stopTimer();
        activeAttempt = null;
        currentTab = button.dataset.tab;
        renderTabs();
        renderPage();
      };
    });
  }

  async function renderPage() {
    $("appMessage").textContent = "";

    try {
      if (currentTab === "home") showHome();
      if (currentTab === "people") await showPeople();
      if (currentTab === "decisions") await showDecisions();
      if (currentTab === "exams") await showExams();
      if (currentTab === "results") await showResults();
    } catch (error) {
      $("content").innerHTML = `
        <div class="card">
          ${esc(error.message)}
        </div>
      `;
    }
  }

  /* =========================
     الصفحة الرئيسية
  ========================= */

  function showHome() {
    let extra = [];

    if (profile.role === "student") {
      extra = [
        ["كود الطالب", record?.student_code],
        ["المرحلة الدراسية", record?.grade],
        ["الفصل", record?.class_name]
      ];
    }

    if (profile.role === "teacher") {
      extra = [
        ["كود المدرس", record?.teacher_code],
        ["المادة", record?.subject]
      ];
    }

    $("content").innerHTML = `
      <h2>مرحبًا ${esc(record?.full_name || user.email)}</h2>

      <p class="muted">
        أنت مسجل بصفتك ${roles[profile.role]}
      </p>

      <div class="grid">

        <div class="card">
          <h3>البريد الإلكتروني</h3>
          <p>${esc(user.email)}</p>
        </div>

        <div class="card">
          <h3>الحالة</h3>
          <p>${esc(record?.status || "نشط")}</p>
        </div>

        ${extra.map(item => `
          <div class="card">
            <h3>${item[0]}</h3>
            <p>${esc(item[1] || "غير مسجل")}</p>
          </div>
        `).join("")}

      </div>
    `;
  }

  /* =========================
     إدارة المستخدمين
  ========================= */

  async function showPeople() {
    const [students, teachers] = await Promise.all([
      run(db.from("students")
        .select("id,student_code,full_name,grade,class_name,status,auth_user_id")
        .order("full_name")),

      run(db.from("teachers")
        .select("id,teacher_code,full_name,subject,status,auth_user_id")
        .order("full_name"))
    ]);

    const rows = [
      ...students.map(item => ({
        ...item,
        role: "student",
        code: item.student_code,
        extra: [item.grade, item.class_name].filter(Boolean).join(" / ")
      })),

      ...teachers.map(item => ({
        ...item,
        role: "teacher",
        code: item.teacher_code,
        extra: item.subject || ""
      }))
    ];

    $("content").innerHTML = `
      <h2>إدارة المستخدمين</h2>

      <form id="createUserForm" class="card">
        <h3>إنشاء حساب جديد</h3>

        <div class="grid">
          <label>الاسم الكامل
            <input name="full_name" required>
          </label>

          <label>البريد الإلكتروني
            <input name="email" type="email" required>
          </label>

          <label>كلمة المرور
            <input name="password" type="password"
              minlength="8" required>
          </label>

          <label>نوع الحساب
            <select name="role">
              <option value="student">طالب</option>
              <option value="teacher">مدرس</option>
            </select>
          </label>

          <label>الكود
            <input name="code" required>
          </label>

          <label>المرحلة الدراسية
            <input name="grade">
          </label>

          <label>الفصل
            <input name="class_name">
          </label>

          <label>المادة
            <input name="subject">
          </label>

          <label>رقم الهاتف
            <input name="phone">
          </label>

          <label>هاتف ولي الأمر
            <input name="guardian_phone">
          </label>

          <label>رقم الطالب
            <input name="student_number">
          </label>
        </div>

        <button class="btn primary">إنشاء الحساب</button>
      </form>

      <h3>سجلات المستخدمين</h3>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الصفة</th>
              <th>الكود</th>
              <th>البيانات</th>
              <th>الحالة</th>
            </tr>
          </thead>

          <tbody>
            ${rows.map(item => `
              <tr>
                <td>${esc(item.full_name)}</td>
                <td>${roles[item.role]}</td>
                <td>${esc(item.code)}</td>
                <td>${esc(item.extra)}</td>
                <td>${esc(item.status || "active")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    $("createUserForm").onsubmit = createUser;
  }

  async function createUser(event) {
    event.preventDefault();

    const form = Object.fromEntries(
      new FormData(event.target)
    );

    try {
      const response = await db.functions.invoke(
        "admin-create-user",
        {
          body: {
            full_name: form.full_name,
            email: form.email,
            password: form.password,
            role: form.role,

            student_code:
              form.role === "student" ? form.code : undefined,

            teacher_code:
              form.role === "teacher" ? form.code : undefined,

            grade: form.grade || null,
            class_name: form.class_name || null,
            subject: form.subject || null,
            phone: form.phone || null,
            guardian_phone: form.guardian_phone || null,
            student_number: form.student_number || null
          }
        }
      );

      if (response.error) throw response.error;
      if (response.data?.error) throw Error(response.data.error);

      showMessage("تم إنشاء الحساب بنجاح.", true);
      await showPeople();

    } catch (error) {
      showMessage("تعذر إنشاء الحساب: " + error.message);
    }
  }

  /* =========================
     قرارات الطلاب
  ========================= */

  async function showDecisions() {
    let query = db.from("student_decisions")
      .select(`
        id,student_id,decision_type,reason,
        decision_date,start_date,duration_days,notes,
        students(full_name,student_code)
      `)
      .order("created_at", { ascending: false });

    if (profile.role === "student") {
      query = query.eq("student_id", record.id);
    }

    const decisions = await run(query);

    let form = "";

    if (profile.role === "admin") {
      const students = await run(
        db.from("students")
          .select("id,full_name,student_code")
          .order("full_name")
      );

      form = `
        <form id="decisionForm" class="card">
          <h3>إصدار قرار جديد</h3>

          <label>الطالب
            <select name="student_id" required>
              <option value="">اختر الطالب</option>
              ${students.map(s => `
                <option value="${s.id}">
                  ${esc(s.full_name)} - ${esc(s.student_code)}
                </option>
              `).join("")}
            </select>
          </label>

          <label>نوع القرار
            <select name="decision_type">
              <option value="parent_summons">استدعاء ولي أمر</option>
              <option value="expulsion">فصل</option>
            </select>
          </label>

          <label>تاريخ القرار
            <input name="decision_date" type="date"
              value="${new Date().toISOString().slice(0,10)}"
              required>
          </label>

          <label>تاريخ بدء التنفيذ
            <input name="start_date" type="date">
          </label>

          <label>المدة بالأيام
            <input name="duration_days" type="number" min="1">
          </label>

          <label>السبب
            <textarea name="reason" required></textarea>
          </label>

          <label>ملاحظات
            <textarea name="notes"></textarea>
          </label>

          <button class="btn primary">حفظ القرار</button>
        </form>
      `;
    }

    $("content").innerHTML = `
      <h2>${profile.role === "admin" ? "إدارة القرارات" : "قراراتي"}</h2>
      ${form}

      ${decisions.length ? decisions.map(d => `
        <article class="card">
          <h3>${d.decision_type === "expulsion"
            ? "قرار فصل" : "استدعاء ولي أمر"}</h3>

          ${profile.role === "admin"
            ? `<p>الطالب: ${esc(d.students?.full_name)}</p>`
            : ""}

          <p>التاريخ: ${formatDate(d.decision_date)}</p>
          <p>السبب: ${esc(d.reason)}</p>

          ${d.start_date
            ? `<p>بداية التنفيذ: ${formatDate(d.start_date)}</p>`
            : ""}

          ${d.duration_days
            ? `<p>المدة: ${esc(d.duration_days)} يوم</p>`
            : ""}

          <p>${esc(d.notes || "")}</p>
        </article>
      `).join("") : "<p>لا توجد قرارات.</p>"}
    `;

    if ($("decisionForm")) {
      $("decisionForm").onsubmit = async event => {
        event.preventDefault();
        const f = Object.fromEntries(new FormData(event.target));

        try {
          await run(db.from("student_decisions").insert({
            student_id: f.student_id,
            decision_type: f.decision_type,
            reason: f.reason,
            decision_date: f.decision_date,
            start_date: f.start_date || null,
            duration_days: f.duration_days
              ? Number(f.duration_days) : null,
            notes: f.notes || null,
            created_by: user.id
          }));

          showMessage("تم حفظ القرار.", true);
          await showDecisions();

        } catch (error) {
          showMessage(error.message);
        }
      };
    }
  }

  /* =========================
     الاختبارات
  ========================= */

  async function showExams() {
    if (activeAttempt) {
      renderAttempt();
      return;
    }

    let query = db.from("exams")
      .select(`
        id,title,description,teacher_id,
        start_time,end_time,duration_minutes,
        is_open,publish_results,grade,exam_type,subject
      `)
      .order("created_at", { ascending: false });

    if (profile.role === "teacher") {
      query = query.eq("teacher_id", record.id);
    }

    const exams = await run(query);

    let createForm = "";

    if (isStaff()) {
      let teachersField = "";

      if (profile.role === "admin") {
        const teachers = await run(
          db.from("teachers")
            .select("id,full_name,teacher_code")
            .order("full_name")
        );

        teachersField = `
          <label>المدرس المسؤول
            <select name="teacher_id">
              <option value="">بدون تحديد</option>
              ${teachers.map(t => `
                <option value="${t.id}">
                  ${esc(t.full_name)}
                </option>
              `).join("")}
            </select>
          </label>
        `;
      }

      createForm = `
        <form id="examForm" class="card">
          <h3>إنشاء اختبار</h3>

          <div class="grid">
            <label>اسم الاختبار
              <input name="title" required>
            </label>

            <label>المادة
              <input name="subject">
            </label>

            <label>المرحلة
              <input name="grade">
            </label>

            <label>نوع الاختبار
              <input name="exam_type">
            </label>

            <label>المدة بالدقائق
              <input name="duration_minutes"
                type="number" min="1" required>
            </label>

            <label>موعد الفتح
              <input name="start_time" type="datetime-local">
            </label>

            <label>موعد الإغلاق
              <input name="end_time" type="datetime-local">
            </label>

            ${teachersField}
          </div>

          <label>الوصف
            <textarea name="description"></textarea>
          </label>

          <button class="btn primary">إنشاء الاختبار</button>
        </form>
      `;
    }

    $("content").innerHTML = `
      <h2>الاختبارات</h2>
      ${createForm}

      <div class="grid">
        ${exams.map(exam => `
          <div class="card">
            <h3>${esc(exam.title)}</h3>

            <p>${esc(exam.description || "")}</p>
            <p>المادة: ${esc(exam.subject || "—")}</p>
            <p>المرحلة: ${esc(exam.grade || "—")}</p>
            <p>المدة: ${esc(exam.duration_minutes || "—")} دقيقة</p>
            <p>الحالة: ${exam.is_open ? "مفتوح" : "مغلق"}</p>

            ${profile.role === "student"
              ? (exam.is_open
                ? `<button class="btn primary" data-start="${exam.id}">
                    بدء الامتحان
                   </button>`
                : "<p>الاختبار مغلق حاليًا.</p>")
              : `
                <button class="btn gold"
                  data-questions="${exam.id}">
                  إدارة الأسئلة
                </button>

                <button class="btn"
                  data-toggle="${exam.id}"
                  data-open="${exam.is_open}">
                  ${exam.is_open ? "إغلاق الاختبار" : "فتح الاختبار"}
                </button>

                <button class="btn"
                  data-publish="${exam.id}"
                  data-value="${exam.publish_results}">
                  ${exam.publish_results ? "إخفاء النتائج" : "نشر النتائج"}
                </button>
              `
            }
          </div>
        `).join("")}
      </div>
    `;

    if ($("examForm")) {
      $("examForm").onsubmit = async event => {
        event.preventDefault();
        const f = Object.fromEntries(new FormData(event.target));

        try {
          await run(db.from("exams").insert({
            title: f.title,
            description: f.description || null,
            subject: f.subject || null,
            grade: f.grade || null,
            exam_type: f.exam_type || null,
            duration_minutes: Number(f.duration_minutes),
            start_time: f.start_time
              ? new Date(f.start_time).toISOString() : null,
            end_time: f.end_time
              ? new Date(f.end_time).toISOString() : null,
            is_open: false,
            publish_results: false,
            teacher_id: profile.role === "teacher"
              ? record.id : (f.teacher_id || null)
          }));

          showMessage("تم إنشاء الاختبار كمسودة مغلقة.", true);
          await showExams();

        } catch (error) {
          showMessage(error.message);
        }
      };
    }

    $("content").querySelectorAll("[data-questions]")
      .forEach(b => b.onclick = () => manageQuestions(b.dataset.questions));

    $("content").querySelectorAll("[data-toggle]")
      .forEach(b => b.onclick = () =>
        toggleExam(b.dataset.toggle, b.dataset.open === "true"));

    $("content").querySelectorAll("[data-publish]")
      .forEach(b => b.onclick = () =>
        publishResults(b.dataset.publish, b.dataset.value === "true"));

    $("content").querySelectorAll("[data-start]")
      .forEach(b => b.onclick = () => beginExam(b.dataset.start));
  }

  /* =========================
     إضافة أسئلة الاختبار
  ========================= */

  async function manageQuestions(examId) {
    const exam = await run(
      db.from("exams")
        .select("id,title")
        .eq("id", examId)
        .single()
    );

    const questions = await run(
      db.from("exam_questions")
        .select("id,question_text,question_type,options,points,sort_order")
        .eq("exam_id", examId)
        .order("sort_order")
    );

    const ids = questions.map(q => q.id);

    const keys = ids.length
      ? await run(db.from("exam_answer_keys")
          .select("question_id")
          .in("question_id", ids))
      : [];

    const answered = new Set(keys.map(k => k.question_id));

    $("content").innerHTML = `
      <h2>إدارة أسئلة: ${esc(exam.title)}</h2>

      <button class="btn" id="backExams">رجوع</button>

      <form id="questionForm" class="card">
        <h3>إضافة سؤال جديد</h3>

        <label>نص السؤال
          <textarea name="question_text" required></textarea>
        </label>

        <label>نوع السؤال
          <select name="question_type" id="questionType">
            <option value="multiple_choice">اختيار من متعدد</option>
            <option value="true_false">صح أم خطأ</option>
          </select>
        </label>

        <label>الدرجة
          <input name="points" type="number"
            min="0.5" step="0.5" value="1" required>
        </label>

        <div id="optionsArea"></div>

        <label>الإجابة الصحيحة
          <select name="correct_answer" id="correctAnswer"></select>
        </label>

        <button class="btn primary">حفظ السؤال</button>
      </form>

      <h3>الأسئلة الحالية (${questions.length})</h3>

      ${questions.map((q, index) => `
        <div class="card">
          <h3>السؤال ${index + 1}</h3>
          <p>${esc(q.question_text)}</p>
          <p>الدرجة: ${esc(q.points)}</p>
          <p>${answered.has(q.id)
            ? "تم حفظ الإجابة الصحيحة"
            : "الإجابة الصحيحة غير محفوظة"}</p>

          <button class="btn danger"
            data-remove="${q.id}">
            حذف السؤال
          </button>
        </div>
      `).join("")}
    `;

    $("backExams").onclick = () => showExams();

    const type = $("questionType");
    const area = $("optionsArea");
    const correct = $("correctAnswer");

    function refreshOptions() {
      if (type.value === "true_false") {
        area.innerHTML = "";
        correct.innerHTML = `
          <option value="true">صح</option>
          <option value="false">خطأ</option>
        `;
      } else {
        area.innerHTML = [1, 2, 3, 4].map(n => `
          <label>الاختيار ${n}
            <input name="opt${n}" required>
          </label>
        `).join("");

        correct.innerHTML =
          '<option value="">اختر الإجابة الصحيحة</option>' +
          [1, 2, 3, 4].map(n =>
            `<option value="${n}">الاختيار ${n}</option>`
          ).join("");
      }
    }

    type.onchange = refreshOptions;
    refreshOptions();

    $("questionForm").onsubmit = async event => {
      event.preventDefault();
      const f = Object.fromEntries(new FormData(event.target));

      try {
        let options = [];
        let answer = f.correct_answer;

        if (f.question_type === "multiple_choice") {
          options = [f.opt1, f.opt2, f.opt3, f.opt4]
            .map(v => v.trim());

          if (options.some(v => !v)) {
            throw Error("اكتب الاختيارات الأربعة.");
          }

          if (!answer) throw Error("حدد الإجابة الصحيحة.");

          answer = options[Number(answer) - 1];
        }

        const order = questions.length
          ? Math.max(...questions.map(q => q.sort_order || 0)) + 1
          : 1;

        const question = await run(
          db.from("exam_questions")
            .insert({
              exam_id: examId,
              question_text: f.question_text,
              question_type: f.question_type,
              options,
              points: Number(f.points),
              sort_order: order
            })
            .select("id")
            .single()
        );

        await run(
          db.from("exam_answer_keys").insert({
            question_id: question.id,
            correct_answer: answer
          })
        );

        showMessage("تم حفظ السؤال والإجابة الصحيحة.", true);
        await manageQuestions(examId);

      } catch (error) {
        showMessage(error.message);
      }
    };

    $("content").querySelectorAll("[data-remove]")
      .forEach(button => {
        button.onclick = async () => {
          if (!confirm("هل تريد حذف السؤال؟")) return;

          try {
            await run(
              db.from("exam_questions")
                .delete()
                .eq("id", button.dataset.remove)
            );

            await manageQuestions(examId);
            showMessage("تم حذف السؤال.", true);

          } catch (error) {
            showMessage(error.message);
          }
        };
      });
  }

  async function toggleExam(id, isOpen) {
    if (isOpen) {
      try {
        await run(db.from("exams")
          .update({ is_open: false })
          .eq("id", id));

        showMessage("تم إغلاق الاختبار.", true);
        await showExams();
      } catch (error) {
        showMessage(error.message);
      }
      return;
    }

    try {
      const questions = await run(
        db.from("exam_questions")
          .select("id")
          .eq("exam_id", id)
      );

      if (!questions.length) {
        throw Error("أضف أسئلة قبل فتح الاختبار.");
      }

      const keys = await run(
        db.from("exam_answer_keys")
          .select("question_id")
          .in("question_id", questions.map(q => q.id))
      );

      if (keys.length !== questions.length) {
        throw Error("هناك أسئلة بدون إجابات صحيحة محفوظة.");
      }

      await run(db.from("exams")
        .update({ is_open: true })
        .eq("id", id));

      showMessage("تم فتح الاختبار.", true);
      await showExams();

    } catch (error) {
      showMessage(error.message);
    }
  }

  async function publishResults(id, current) {
    try {
      await run(db.from("exams")
        .update({ publish_results: !current })
        .eq("id", id));

      showMessage("تم تحديث حالة نشر النتائج.", true);
      await showExams();

    } catch (error) {
      showMessage(error.message);
    }
  }

  /* =========================
     أداء الامتحان
  ========================= */

  async function beginExam(examId) {
    try {
      const data = await run(
        db.rpc("start_exam_attempt", {
          p_exam_id: examId
        })
      );

      activeAttempt = {
        id: data.attempt_id,
        expiresAt: data.expires_at,
        questions: data.questions,
        answers: {}
      };

      renderAttempt();

    } catch (error) {
      showMessage("تعذر بدء الامتحان: " + error.message);
    }
  }

  function renderAttempt() {
    const a = activeAttempt;
    if (!a) return;

    $("content").innerHTML = `
      <h2>الامتحان</h2>

      <div class="card">
        <h3 id="examClock"></h3>
        <p>أجب عن الأسئلة ثم اضغط تسليم الامتحان.</p>
      </div>

      ${a.questions.map((q, index) => {
        const options = q.question_type === "true_false"
          ? ["true", "false"]
          : (q.options || []);

        return `
          <div class="card">
            <h3>السؤال ${index + 1}</h3>
            <p>${esc(q.question_text)}</p>

            ${options.map(value => `
              <label class="answer-option">
                <input
                  type="radio"
                  name="answer_${q.id}"
                  value="${esc(value)}"
                  ${a.answers[q.id] === value ? "checked" : ""}
                >
                ${esc(q.question_type === "true_false"
                  ? (value === "true" ? "صح" : "خطأ")
                  : value)}
              </label>
            `).join("")}
          </div>
        `;
      }).join("")}

      <button class="btn primary" id="submitExam">
        تسليم الامتحان
      </button>
    `;

    a.questions.forEach(q => {
      $("content")
        .querySelectorAll(`[name="answer_${q.id}"]`)
        .forEach(input => {
          input.onchange = () => {
            a.answers[q.id] = input.value;
          };
        });
    });

    $("submitExam").onclick = () => submitExam(false);

    stopTimer();

    function tick() {
      const left = Math.max(
        0,
        new Date(a.expiresAt).getTime() - Date.now()
      );

      const minutes = Math.floor(left / 60000);
      const seconds = Math.floor((left % 60000) / 1000);

      if ($("examClock")) {
        $("examClock").textContent =
          `الوقت المتبقي: ${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
      }

      if (left === 0) {
        stopTimer();
        submitExam(true);
      }
    }

    tick();
    examTimer = setInterval(tick, 1000);
  }

  async function submitExam(auto = false) {
    if (!activeAttempt) return;

    if (!auto && !confirm("هل تريد تسليم الامتحان؟")) {
      return;
    }

    stopTimer();

    try {
      const a = activeAttempt;

      const result = await run(
        db.rpc("submit_exam_attempt", {
          p_attempt_id: a.id,
          p_answers: a.answers
        })
      );

      activeAttempt = null;

      $("content").innerHTML = `
        <div class="card">
          <h2>تم تسليم الامتحان بنجاح</h2>
          <p>درجتك: ${esc(result.score)} من ${esc(result.total)}</p>
          <button class="btn primary" id="backToExams">
            العودة للاختبارات
          </button>
        </div>
      `;

      $("backToExams").onclick = () => showExams();

    } catch (error) {
      showMessage("تعذر تسليم الامتحان: " + error.message);
      if (activeAttempt) renderAttempt();
    }
  }

  /* =========================
     النتائج
  ========================= */

  async function showResults() {
    let query = db.from("results")
      .select(`
        id,student_id,exam_id,score,submitted_at,
        exams(title,subject,publish_results),
        students(full_name,student_code)
      `)
      .order("submitted_at", { ascending: false });

    if (profile.role === "student") {
      query = query.eq("student_id", record.id);
    }

    const all = await run(query);

    const rows = profile.role === "student"
      ? all.filter(r => r.exams?.publish_results === true)
      : all;

    $("content").innerHTML = `
      <h2>${profile.role === "student" ? "نتائجي" : "نتائج الاختبارات"}</h2>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${profile.role === "admin" ? "<th>الطالب</th>" : ""}
              <th>الاختبار</th>
              <th>المادة</th>
              <th>الدرجة</th>
              <th>تاريخ التسليم</th>
            </tr>
          </thead>

          <tbody>
            ${rows.map(r => `
              <tr>
                ${profile.role === "admin"
                  ? `<td>${esc(r.students?.full_name)}</td>`
                  : ""}
                <td>${esc(r.exams?.title || "—")}</td>
                <td>${esc(r.exams?.subject || "—")}</td>
                <td>${esc(r.score)}</td>
                <td>${formatDate(r.submitted_at)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      ${rows.length ? "" : "<p>لا توجد نتائج منشورة حاليًا.</p>"}
    `;
  }

  /* =========================
     تسجيل الدخول
  ========================= */

  async function startSession(session) {
    user = session.user;

    profile = await run(
      db.from("user_profiles")
        .select("user_id,role,created_at")
        .eq("user_id", user.id)
        .single()
    );

    if (!["admin", "teacher", "student"].includes(profile.role)) {
      throw Error("نوع الحساب غير معروف.");
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
      throw Error("هذا الحساب غير نشط.");
    }

    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");

    $("welcomeTitle").textContent =
      "مرحبًا " + (record?.full_name || user.email);

    $("userRole").textContent = roles[profile.role];

    currentTab = "home";
    renderTabs();
    await renderPage();
  }

  async function init() {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      $("loginMessage").textContent =
        "إعدادات Supabase غير مكتملة في config.js";
      return;
    }

    if (!window.supabase) {
      $("loginMessage").textContent =
        "تعذر تحميل مكتبة Supabase.";
      return;
    }

    db = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY
    );

    $("loginForm").onsubmit = async event => {
      event.preventDefault();
      $("loginMessage").textContent = "جارٍ تسجيل الدخول...";

      try {
        const result = await db.auth.signInWithPassword({
          email: $("email").value.trim(),
          password: $("password").value
        });

        if (result.error) throw result.error;

        await startSession(result.data.session);
        $("loginMessage").textContent = "";

      } catch (error) {
        $("loginMessage").textContent = error.message;
      }
    };

    $("logoutBtn").onclick = async () => {
      stopTimer();
      await db.auth.signOut();
      location.reload();
    };

    const session = await db.auth.getSession();

    if (session.data?.session) {
      try {
        await startSession(session.data.session);
      } catch (error) {
        await db.auth.signOut();
        $("loginMessage").textContent = error.message;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
