# 🌱 مشروع نظام تسجيل مشاركات

![RTC Banner](src/assets/logo.webp)

تم إنشاء هذا المشروع لخدمة نشاط RTC الخيري التابع لجمعية رسالة، بهدف تنظيم وتسهيل إدارة شؤون المتطوعين والعمليات الداخلية بدل الاعتماد على الطرق العشوائية أو المتابعة اليدوية.

جاءت فكرة المشروع من الحاجة إلى نظام واضح ومنظم يساعد فريق العمل على:

- جمع البيانات بشكل أدق
- تسهيل إدارة المتطوعين
- تقليل الوقت والمجهود المبذول في المتابعة
- التركيز أكثر على الهدف الأساسي وهو خدمة الناس وصناعة أثر حقيقي

هذا المشروع لم يتم إنشاؤه كمجرد تدريب تقني أو إضافة للسيرة الذاتية، بل بنيتُه بنية أن يكون صدقة جارية، يستمر نفعها مع الوقت، ويساهم ولو بجزء بسيط في دعم العمل الخيري وتنظيمه وتطويره.

كل سطر كود في هذا المشروع كُتب على أمل أن يكون سببًا في تسهيل الخير، ومساعدة من يعملون لأجل الناس دون مقابل.

> ﴿وَمَا تُقَدِّمُوا لِأَنفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ﴾ 🤍

ولا يفوتني في هذا المقام أن أتقدم بخالص الشكر والتقدير لزميلي وصديقي،
**خير الصديق إياد جابر سعد الدين جابر**، على دعمه ومساندته الحقيقية طوال فترة العمل على المشروع،
فلولاه – بعد فضل الله – ما كان لهذا المشروع أن يخرج إلى النور.


## 🏁 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
- Node.js `^20.19.0 || >=22.12.0`
- npm or yarn
- A Supabase project

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Omar-0O/RTC.git
   cd RTC
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   ```

4. **Development & Verification Commands**
   - **Dev Server**: `npm run dev`
   - **Type Checking**: `npm run typecheck`
   - **Linting**: `npm run lint`
   - **Unit & Integration Tests**: `npx vitest run`
   - **Production Build**: `npm run build`

## 🏗️ Architecture & Core Components

- **Frontend Core**: React 18 + TypeScript + Vite + Tailwind CSS + Shadcn UI.
- **Backend Infrastructure**: Supabase (Database, Auth, Row Level Security, Edge Functions).
- **Security & Sanitization**: Formula injection escaping in spreadsheet export helpers, validated URL/image schemas, sanitized inputs.
- **State & Data Handling**: TanStack Query (React Query) for efficient caching, invalidation, and data synchronization.

- **CI/CD & Security**: GitHub Actions automated pipeline with full typecheck, ESLint, Vitest, and CodeQL security scanning.

GitHub Actions workflows are configured in `.github/workflows/`:
- **`ci.yml`**: Runs TypeScript typechecks, ESLint analysis, Vitest test execution, and production bundling on pushes/PRs.
- **`security.yml`**: Runs GitHub CodeQL security analysis and npm dependency security audits.

## 🤝 Contributing

Contributions are welcome! Please ensure all code passes type checking (`npm run typecheck`), linting (`npm run lint`), and tests (`npx vitest run`) before submitting a PR.

## 📄 License

This project is open source and available under the [GPL v3 License](LICENSE).

