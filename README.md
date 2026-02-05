# 🌱 مشروع نظام تسجيل مشاركات

![RTC Banner](src/assets/logo.png)

تم إنشاء هذا المشروع لخدمة نشاط RTC الخيري التابع لجمعية رسالة، بهدف تنظيم وتسهيل عملية تسجيل المشاركين والمتطوعين بدل الاعتماد على الطرق العشوائية أو المتابعة اليدوية.

جاءت فكرة المشروع من الحاجة إلى نظام واضح ومنظم يساعد فريق العمل على:

- جمع البيانات بشكل أدق
- تسهيل إدارة المشاركين
- تقليل الوقت والمجهود المبذول في المتابعة
- التركيز أكثر على الهدف الأساسي وهو خدمة الناس وصناعة أثر حقيقي

هذا المشروع لم يتم إنشاؤه كمجرد تدريب تقني أو إضافة للسيرة الذاتية، بل بنيتُه بنية أن يكون صدقة جارية، يستمر نفعها مع الوقت، ويساهم ولو بجزء بسيط في دعم العمل الخيري وتنظيمه وتطويره.

كل سطر كود في هذا المشروع كُتب على أمل أن يكون سببًا في تسهيل الخير، ومساعدة من يعملون لأجل الناس دون مقابل.

> ﴿وَمَا تُقَدِّمُوا لِأَنفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ﴾ 🤍

## 🏁 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
- Node.js (v18+)
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
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
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

## 📂 Project Structure

- `src/pages`: Main application pages (Volunteer, Admin, Leader).
- `src/components`: Reusable UI components.
- `src/contexts`: Global state (Auth, Language).
- `src/integrations/supabase`: Supabase client and types.
- `supabase/seeds`: SQL scripts for database setup.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

✨
