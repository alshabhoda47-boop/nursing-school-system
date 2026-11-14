# نظام مدرسة الجيزة الفنية للتمريض براجيل

واجهة عربية RTL أولية لإدارة الحسابات والقرارات والاختبارات باستخدام Supabase.

## محتويات المشروع
- `index.html`, `style.css`, `script.js`: واجهة تسجيل الدخول ولوحات الأدوار.
- `config.example.js`: نموذج إعداد اتصال Supabase.
- `supabase/schema.sql`: الجداول وسياسات RLS.
- `supabase/functions/admin-create-user`: إنشاء حساب طالب/مدرس بشكل آمن من الخادم.
- `supabase/functions/admin-delete-user`: حذف الحساب من Auth بشكل آمن.

## التشغيل والإعداد
1. أنشئ مشروع Supabase جديدًا أو استخدم مشروعك الحالي بعد التأكد من عدم وجود بيانات مهمة سيتم المساس بها.
2. من Supabase افتح SQL Editor وشغّل محتوى `supabase/schema.sql`.
3. من Authentication > Users أنشئ أول مستخدم مدير.
4. انسخ UUID والبريد لهذا المستخدم ثم نفّذ في SQL Editor (استبدل القيم):
   ```sql
   insert into public.profiles (id, full_name, email, role)
   values ('UUID-OF-ADMIN', 'مدير النظام', 'admin@example.com', 'admin');
   ```
5. انسخ `config.example.js` إلى `config.js`، وضع Project URL وanon/public key من Project Settings > API.
6. انشر Edge Functions:
   ```bash
   supabase functions deploy admin-create-user
   supabase functions deploy admin-delete-user
   ```
   تأكد من أن أسرار Supabase الافتراضية متاحة للوظائف. لا تضع `service_role` في `config.js` أو أي ملف متاح للمتصفح.
7. افتح `index.html` عبر استضافة ثابتة مثل GitHub Pages أو Vercel.

## رفع الملفات إلى GitHub من المتصفح
1. فك ضغط الملف على الكمبيوتر.
2. افتح مستودعك: https://github.com/alshabhoda47-boop/nursing-school-system
3. اضغط `Add file` ثم `Upload files`.
4. افتح مجلد المشروع بعد فك الضغط وحدد الملفات والمجلد `supabase` واسحبها إلى صفحة GitHub.
5. انتظر اكتمال الرفع، اكتب رسالة مثل `Initial project files` ثم اضغط `Commit changes`.

## تنبيهات مهمة
- هذا إصدار تأسيسي (MVP) وليس نظامًا جاهزًا للاستخدام الرسمي قبل اختباره ومراجعته.
- شاشة الاختبارات حاليًا تنشئ وتفتح/تغلق الاختبارات فقط؛ لم يتم تنفيذ بنك الأسئلة أو أداء الامتحان أو التصحيح والنتائج بعد.
- لا توجد في هذه النسخة آلية تسجيل ذاتي؛ المدير ينشئ حسابات الطلاب والمدرسين.
- سياسة قراءة الملفات الشخصية تسمح للمدرس بقراءة ملفات جميع المستخدمين في هذا الإصدار؛ راجعها وضيّقها قبل استخدام بيانات حقيقية.
- قرارات الطلاب والاختبارات لا تتضمن بعد دورة موافقات أو سجلات تدقيق.
- لا تشارك كلمات المرور أو مفاتيح الخدمة مع أي شخص.
