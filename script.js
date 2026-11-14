/* مدرسة الجيزة الفنية للتمريض براجيل
   Supabase client-side app. Requires config.js before script.js. */
(() => {
  const cfg = window.SCHOOL_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const loginView = $("loginView"), appView = $("appView"), content = $("content");
  let db, currentUser, profile, activeTab = "home";

  const roleNames = {admin:"مدير النظام", teacher:"عضو هيئة التدريس", student:"طالب"};
  const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const msg = (s, bad=true) => { $("appMessage").textContent=s; $("appMessage").style.color=bad?"#9b4a32":"#26704f"; };
  const loginMsg = s => $("loginMessage").textContent=s;
  const call = async (query) => { const {data,error}=await query; if(error) throw error; return data; };
  const fmt = d => d ? new Date(d).toLocaleDateString("ar-EG") : "—";

  function tabsForRole() {
    const common = [{id:"home",label:"الرئيسية"},{id:"decisions",label:"قراراتي"}];
    if(profile.role==="admin") return [{id:"home",label:"الرئيسية"},{id:"people",label:"المستخدمون"},{id:"decisions",label:"القرارات"},{id:"exams",label:"الاختبارات"}];
    if(profile.role==="teacher") return [{id:"home",label:"الرئيسية"},{id:"exams",label:"الاختبارات"}];
    return [...common,{id:"exams",label:"الاختبارات"}];
  }
  function renderTabs(){
    $("tabs").innerHTML=tabsForRole().map(t=>`<button class="tab ${activeTab===t.id?"active":""}" data-tab="${t.id}">${t.label}</button>`).join("");
    $("tabs").querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{activeTab=b.dataset.tab;renderTabs();render();}));
  }
  async function render(){
    $("appMessage").textContent="";
    try {
      if(activeTab==="home") content.innerHTML=`<h2>مرحبًا ${esc(profile.full_name||currentUser.email)}</h2><p class="muted">أنت مسجل بصفتك ${roleNames[profile.role]||profile.role}.</p><div class="grid"><div class="card"><h3>حسابك</h3><p>${esc(currentUser.email)}</p></div><div class="card"><h3>حالة الحساب</h3><p>${profile.is_active?"نشط":"غير نشط"}</p></div></div>`;
      if(activeTab==="people") await renderPeople();
      if(activeTab==="decisions") await renderDecisions();
      if(activeTab==="exams") await renderExams();
    } catch(e){content.innerHTML=`<p class="message">${esc(e.message)}</p>`;}
  }
  async function renderPeople(){
    const people=await call(db.from("profiles").select("id,full_name,email,role,is_active,student_code").order("full_name"));
    content.innerHTML=`<h2>إدارة المستخدمين</h2>
      <form id="createUserForm" class="card"><h3>إنشاء حساب طالب أو مدرس</h3><div class="grid">
      <label>الاسم<input name="full_name" required></label><label>البريد الإلكتروني<input name="email" type="email" required></label>
      <label>كلمة المرور المؤقتة<input name="password" type="password" minlength="8" required></label>
      <label>الصفة<select name="role"><option value="student">طالب</option><option value="teacher">مدرس</option></select></label>
      <label>كود الطالب (اختياري)<input name="student_code"></label></div><button class="btn primary">إنشاء الحساب</button></form>
      <h3>الحسابات</h3><div class="table-wrap"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الصفة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>
      ${people.map(p=>`<tr><td>${esc(p.full_name)}</td><td>${esc(p.email)}</td><td>${roleNames[p.role]||p.role}</td><td>${p.is_active?"نشط":"موقوف"}</td><td><button class="btn gold" data-toggle="${p.id}" data-active="${p.is_active}">${p.is_active?"إيقاف":"تفعيل"}</button> <button class="btn danger" data-delete="${p.id}">حذف</button></td></tr>`).join("")}
      </tbody></table></div>`;
    $("createUserForm").addEventListener("submit",createUser);
    content.querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",()=>toggleUser(b.dataset.toggle,b.dataset.active==="true")));
    content.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteUser(b.dataset.delete)));
  }
  async function createUser(e){
    e.preventDefault();const f=Object.fromEntries(new FormData(e.target));
    try{const {data,error}=await db.functions.invoke("admin-create-user",{body:f});if(error)throw error;msg("تم إنشاء الحساب بنجاح",false);await renderPeople();}
    catch(err){msg("تعذر إنشاء الحساب: "+err.message);}
  }
  async function toggleUser(id,isActive){
    try{await call(db.from("profiles").update({is_active:!isActive}).eq("id",id));msg("تم تحديث حالة الحساب",false);await renderPeople();}
    catch(e){msg(e.message);}
  }
  async function deleteUser(id){
    if(!confirm("هل أنت متأكد من حذف الحساب نهائيًا؟"))return;
    try{const {error}=await db.functions.invoke("admin-delete-user",{body:{user_id:id}});if(error)throw error;msg("تم حذف الحساب",false);await renderPeople();}
    catch(e){msg("تعذر الحذف: "+e.message);}
  }
  async function renderDecisions(){
    let q=db.from("student_decisions").select("id,decision_type,reason,decision_number,created_at,student_id").order("created_at",{ascending:false});
    if(profile.role==="student") q=q.eq("student_id",currentUser.id);
    const rows=await call(q);
    const adminForm=profile.role==="admin"?`<form id="decisionForm" class="card"><h3>إصدار قرار</h3><div class="grid"><label>معرّف الطالب (UUID)<input name="student_id" required></label><label>نوع القرار<select name="decision_type"><option value="parent_summons">استدعاء ولي أمر</option><option value="expulsion">فصل</option></select></label><label>سبب القرار<textarea name="reason" required></textarea></label></div><button class="btn primary">حفظ القرار</button></form>`:"";
    content.innerHTML=`<h2>${profile.role==="admin"?"إدارة القرارات":"قراراتي"}</h2>${adminForm}${rows.length?rows.map(d=>`<article class="decision"><div class="row"><h3>${d.decision_type==="expulsion"?"قرار فصل":"استدعاء ولي أمر"}</h3><span class="muted">رقم ${esc(d.decision_number||"—")} · ${fmt(d.created_at)}</span></div><p>${esc(d.reason)}</p><button class="btn gold" data-print="${d.id}">طباعة القرار</button></article>`).join(""):`<div class="empty">لا توجد قرارات حتى الآن</div>`}`;
    if($("decisionForm")) $("decisionForm").addEventListener("submit",async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await call(db.from("student_decisions").insert({...f,issued_by:currentUser.id}));msg("تم حفظ القرار",false);await renderDecisions();}catch(x){msg(x.message);}});
    content.querySelectorAll("[data-print]").forEach(b=>b.addEventListener("click",()=>{const d=rows.find(x=>x.id===b.dataset.print);const w=window.open("","_blank");w.document.write(`<html lang="ar" dir="rtl"><meta charset="utf-8"><title>قرار مدرسي</title><style>body{font-family:Tahoma;padding:50px;line-height:2}h1{text-align:center}p{margin:28px 0}</style><h1>مدرسة الجيزة الفنية للتمريض براجيل</h1><h2 style="text-align:center">${d.decision_type==="expulsion"?"قرار فصل":"استدعاء ولي أمر"}</h2><p>رقم القرار: ${esc(d.decision_number||"—")}</p><p>الموضوع: ${esc(d.reason)}</p><p>التاريخ: ${fmt(d.created_at)}</p><br><p>مدير المدرسة: ........................</p><script>window.print()<\/script></html>`);w.document.close();}));
  }
  async function renderExams(){
    let q=db.from("exams").select("id,title,description,starts_at,ends_at,is_open,created_by").order("created_at",{ascending:false});
    if(profile.role==="student") q=q.eq("is_open",true);
    const exams=await call(q);
    const teacherForm=["admin","teacher"].includes(profile.role)?`<form id="examForm" class="card"><h3>إنشاء اختبار</h3><label>عنوان الاختبار<input name="title" required></label><label>الوصف<textarea name="description"></textarea></label><div class="grid"><label>موعد الفتح<input name="starts_at" type="datetime-local"></label><label>موعد الإغلاق<input name="ends_at" type="datetime-local"></label></div><button class="btn primary">إنشاء الاختبار</button></form>`:"";
    content.innerHTML=`<h2>الاختبارات</h2>${teacherForm}${exams.length?`<div class="grid">${exams.map(x=>`<div class="card"><h3>${esc(x.title)}</h3><p>${esc(x.description||"")}</p><p>الحالة: ${x.is_open?"مفتوح":"مغلق"}</p>${profile.role!=="student"?`<button class="btn gold" data-open="${x.id}" data-state="${x.is_open}">${x.is_open?"إغلاق":"فتح"} الاختبار</button>`:"<p class='muted'>تابع تعليمات المدرس لأداء الاختبار.</p>"}</div>`).join("")}</div>`:`<div class="empty">لا توجد اختبارات متاحة</div>`}`;
    if($("examForm")) $("examForm").addEventListener("submit",async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await call(db.from("exams").insert({...f,created_by:currentUser.id}));msg("تم إنشاء الاختبار",false);await renderExams();}catch(x){msg(x.message);}});
    content.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",async()=>{try{await call(db.from("exams").update({is_open:b.dataset.state!=="true"}).eq("id",b.dataset.open));await renderExams();}catch(x){msg(x.message);}}));
  }
  async function startApp(session){
    currentUser=session.user;
    profile=await call(db.from("profiles").select("*").eq("id",currentUser.id).single());
    if(!profile.is_active){await db.auth.signOut();throw new Error("هذا الحساب موقوف. راجع إدارة المدرسة.");}
    loginView.classList.add("hidden");appView.classList.remove("hidden");$("logoutBtn").classList.remove("hidden");
    $("welcomeTitle").textContent=`مرحبًا ${profile.full_name||""}`;$("userRole").textContent=roleNames[profile.role]||profile.role;
    activeTab="home";renderTabs();await render();
  }
  async function init(){
    if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_URL.includes("YOUR-PROJECT")){
      loginMsg("يجب إعداد ملف config.js أولًا. راجع README.md.");return;
    }
    db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    $("loginForm").addEventListener("submit",async e=>{e.preventDefault();loginMsg("جارٍ تسجيل الدخول...");try{const {data,error}=await db.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(error)throw error;await startApp(data.session);loginMsg("");}catch(x){loginMsg(x.message);}});
    $("logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();location.reload();});
    const {data}=await db.auth.getSession();if(data.session){try{await startApp(data.session);}catch(e){loginMsg(e.message);}}
  }
  document.addEventListener("DOMContentLoaded",init);
})();