# Bug Report: مشكلة الـ Logout التلقائي العشوائي

## وصف المشكلة

المستخدم يسجل دخول بنجاح، لكن في بعض الأحيان **يُخرَج من التطبيق فوراً** دون أي تدخل منه.
المشكلة **غير منتظمة** — أحياناً بتحصل وأحياناً لا.

---

## السبب الجذري: مشكلتان متداخلتان

---

### المشكلة الأولى (الأخطر): Race Condition في تخزين الجلسة

**الملف:** `src/integrations/supabase/client.ts` — دالة `setItem`

#### كيف كان الكود يعمل؟

التطبيق بيستخدم custom storage بدل localStorage الافتراضي لـ Supabase.
دالة `setItem` كانت مسؤولة عن القرار: هل تحفظ الجلسة في **localStorage** (دائم) أو **sessionStorage** (مؤقت يتمسح عند إغلاق التاب).

```ts
// الكود القديم المعطوب
let rememberMe = true;
try {
  rememberMe = localStorage.getItem('rememberMe') !== 'false';
} catch (e) {}

if (rememberMe) {
  localStorage.setItem(key, value);   // جلسة دائمة
} else {
  sessionStorage.setItem(key, value); // جلسة مؤقتة تتمسح
}
```

#### لماذا هذا خطأ؟

عند تسجيل الدخول يحدث التسلسل التالي بالتوازي:

```
المستخدم يضغط "تسجيل الدخول"
         |
         v
 Supabase يُرجع session
         |
    -----+---------------------
    |                          |
    v                          v
 supabase يُطلق            Auth.tsx يحفظ
 setItem() لحفظ            rememberMe=true
 الجلسة                    في localStorage
    |
    | يقرأ localStorage.getItem('rememberMe')
    |
    v
 الحالة الطبيعية: يجد null  =>  true  =>  يحفظ في localStorage (OK)
 حالة المشكلة: يجد 'false' (قيمة قديمة مترسبة)  =>  يحفظ في sessionStorage (BUG)
                                                  |
                    عند تحديث الصفحة: sessionStorage يتمسح
                                                  |
                                        SIGNED_OUT event
                                                  |
                                       Logout تلقائي!
```

#### لماذا مش بتحصل دايماً؟

لأن الـ Race Condition بتعتمد على:
- **سرعة الاتصال** — لو الاستجابة سريعة، `setItem` بييجي بعد ما `rememberMe` اتحفظ (OK)
- **حالة localStorage** — لو فيه قيمة قديمة `'false'` من جلسة سابقة  =>  يحفظ في `sessionStorage` (BUG)
- **نوع الـ Event** — `INITIAL_SESSION` و `TokenRefreshed` بيطلقوا `setItem` بشكل مستقل عن flow تسجيل الدخول

#### الإصلاح

```ts
// الكود الجديد
let rememberMe = true;
try {
  const stored = localStorage.getItem('rememberMe');
  // فقط لو المستخدم صراحةً اختار 'false' نحوّل لـ sessionStorage
  if (stored === 'false') {
    rememberMe = false;
  }
} catch (e) {}
```

| السيناريو | الكود القديم | الكود الجديد |
|-----------|-------------|--------------|
| `rememberMe = null` (مش متحفظ) | true  =>  localStorage (OK) | true  =>  localStorage (OK) |
| `rememberMe = 'true'` | true  =>  localStorage (OK) | true  =>  localStorage (OK) |
| `rememberMe = 'false'` (مقصود) | false  =>  sessionStorage (OK) | false  =>  sessionStorage (OK) |
| قيمة قديمة `'false'` مترسبة | false  =>  sessionStorage  =>  Logout عشوائي (BUG) | لا يحدث — نفس السيناريو السابق (OK) |

---

### المشكلة الثانية: Stale Closure في AuthContext

**الملف:** `src/contexts/AuthContext.tsx` — داخل `onAuthStateChange`

#### الكود القديم

```ts
// الكود القديم
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN') {
        // profile هنا من الـ closure القديم!
        // useEffect اشتغل مرة واحدة، profile كانت null في البداية
        // وظلت null داخل الـ callback للأبد
        if (!profile || profile.id !== session.user.id) {
          fetchProfile(session.user.id);
        }
      }
    }
  );
}, [fetchProfile]); // profile مش في dependencies!
```

#### شرح المشكلة

الـ `useEffect` بيشتغل **مرة واحدة** ويُنشئ callback للـ `onAuthStateChange`.
هذا الـ callback بيحتفظ بـ **snapshot** من قيمة `profile` في وقت إنشائه (اللي كانت `null`).

```
عند تسجيل الدخول:
  profile state  =>  { id: 'user-123', ... }   (القيمة الحقيقية في الذاكرة)
  profile في الـ callback  =>  null              (snapshot قديم من وقت إنشاء useEffect)

نتيجة: كل مرة بييجي event يشوف profile=null فيعمل fetchProfile دايماً  =>  احتمال مشاكل
```

#### الإصلاح

```ts
// الكود الجديد — استخدام Ref بدل State
const profileIdRef = useRef<string | null>(null);

// عند حفظ الـ profile:
if (profileData) {
  setProfile(profileData);
  profileIdRef.current = profileData.id; // ref دايماً محدث
}

// في onAuthStateChange:
if (!profileIdRef.current || profileIdRef.current !== session.user.id) {
  // ref بيقرأ القيمة الحالية دايماً، مش snapshot قديم
  fetchProfile(session.user.id);
}
```

| | useState | useRef |
|--|--|--|
| القيمة داخل useEffect | snapshot من وقت آخر render | دايماً القيمة الحالية |
| يسبب Stale Closure | نعم | لا |

---

## ملخص التغييرات

| الملف | المشكلة | الإصلاح |
|-------|---------|---------|
| `src/integrations/supabase/client.ts` | Race Condition — ممكن يحفظ الجلسة في sessionStorage | تغيير المنطق: localStorage دايماً ما لم يكن 'false' صراحةً |
| `src/contexts/AuthContext.tsx` | Stale Closure — قراءة profile من closure قديم | استبدال profile بـ profileIdRef للحصول على القيمة الحالية دايماً |

---

## نتيجة الإصلاح

- الجلسة دايماً تتحفظ في localStorage بشكل موثوق
- تحديث الصفحة لا يُخرج المستخدم من التطبيق
- Token Refresh لا يسبب logout عشوائي
- fetchProfile بيشتغل في الوقت الصح بس
