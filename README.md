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
- A Supabase account

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/rtc-pulse.git
    cd rtc-pulse
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory and add your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
    ```

4.  **Database Setup**
    Run the SQL scripts located in `supabase/seeds/` in your Supabase SQL Editor to set up the schema, functions, and initial data:
    - `create_admin.sql`: Sets up the initial admin user.
    - `create_storage.sql`: Configures storage buckets and policies.
    - `create_get_leaderboard.sql`: Adds the leaderboard calculation function.
    - `update_level_logic.sql`: Updates the level threshold logic.

5.  **Run the App**
    ```bash
    npm run dev
    ```
    Open [http://localhost:8080](http://localhost:8080) to view it in the browser.

    To run against the RTC test Supabase environment, use:
    ```bash
    npm run dev:test
    ```

## 📂 Project Structure

- `src/pages`: Main application pages (Volunteer, Admin, Leader).
- `src/components`: Reusable UI components.
- `src/contexts`: Global state (Auth, Language).
- `src/integrations/supabase`: Supabase client and types.
- `supabase/seeds`: SQL scripts for database setup.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [GPL v3 License](LICENSE).

✨
