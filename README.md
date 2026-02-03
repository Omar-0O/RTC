# برنامج تسجيل المشاركات 🌟

**برنامج تسجيل المشاركات** is a comprehensive Volunteer Management System designed to gamify the volunteering experience and streamline organization management. It empowers volunteers to track their impact while giving administrators powerful tools to oversee activities, committees, and performance.

![Banner](src/assets/logo.png)

## 🚀 Features

### For Volunteers
- **Gamified Dashboard**: Track your "Impact" (Points), unlock Badges, and progress through Levels (Mubadir -> Musahim -> Moather -> Qaed Molhem).
- **Log Activities**: Easily submit your volunteer work with proof (images/links).
- **Leaderboard**: Compete with others! Filter by Month, Quarter, or Committee to see where you stand.
- **Profile**: manage your personal info and view your complete activity history.

### For Admins & Leaders
- **Admin Dashboard**: Real-time statistics on participation, top volunteers (Monthly), and committee performance.
- **User Management**: Manage volunteers, assign roles (Admin, Supervisor, Committee Leader), and organize them into committees.
- **Activity Management**: Define activity types and their Impact values.
- **Reports**: Export data and view insights on volunteer engagement.

### 🌐 Multilingual Support
Fully localized for **English** and **Arabic (RTL)** to support a diverse community.

## 🛠️ Tech Stack

- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Backend & Auth**: [Supabase](https://supabase.com/) (Auth, Database, Storage)
- **State Management**: React Context + TanStack Query

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
