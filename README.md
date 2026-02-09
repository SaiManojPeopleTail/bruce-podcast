# The Pod — In Conversation With Bruce W. Cole

A podcast video hosting and management platform for **In Conversation With Bruce W. Cole**. The site showcases episodes (YouTube-hosted videos), provides an About page and Brand Partnerships, and offers an admin console for managing episodes and users.

---

## What This Platform Is For

- **Public site:** A marketing and discovery site for the podcast. Visitors see a hero section (“In Conversation With Bruce W. Cole”), recent episodes with thumbnails and descriptions, and can watch full episodes. Pages include Home, About (host intro), and Brand Partnerships (guidelines and contact).
- **Episode pages:** Each episode has its own URL (`/episode/{slug}`) with an embedded YouTube player, title, date, description, and a share button that copies the episode link.
- **Admin console:** Authenticated staff manage content at `/admin`: dashboard, episodes (add/edit/delete, pagination, search, YouTube URL preview), and—for the first few user accounts—user management (add/delete users, change passwords). Registration is disabled; users are created via seed or user management.

---

## Features

### Public (visitor-facing)

- Hero section with parallax background and podcast branding
- **Recent Episodes** list with “Load more” (10 per page, loading state)
- Episode cards: thumbnail, title, short description, date, link to episode page
- Episode page: YouTube embed, title, date posted, long description, share (copy link + optional Web Share)
- About: intro to Bruce W. Cole and the podcast
- Brand Partnerships: brand guidelines and contact
- Footer: podcast tagline, Home / About / Brand Partnerships links, social icons (right-aligned)

### Admin (`/admin`, auth required)

- **Dashboard** — landing after login
- **Episodes** — list (paginated, searchable, thumbnails), add, edit, delete; slug auto-generated from title; created date picker; YouTube URL with live preview (thumbnail/title)
- **User management** (only for users with `id < 3`): list users, add user, delete user (cannot delete self), change another user’s password
- Sidebar layout with dark/light mode toggle
- Registration routes commented out; access is by invitation/seeded users only

### Tech highlights

- Episodes stored in database (title, slug, short/long description, video URL, created_at)
- YouTube videos embedded by URL; thumbnails and oEmbed used for previews in admin
- Responsive layout (mobile-first) with Tailwind CSS
- Animations (e.g. hero, cards) via Framer Motion

---

## How It’s Built

| Layer        | Technology |
|-------------|------------|
| Backend     | **Laravel 12** (PHP 8.2+) |
| Frontend    | **React 18** with **Inertia.js** (no separate SPA; server-driven routes) |
| Auth / scaffolding | **Laravel Breeze** (React + Inertia stack) |
| Styling     | **Tailwind CSS 3**, **PostCSS** |
| Build       | **Vite 7** |
| UI / motion | **Headless UI**, **Framer Motion** |
| Routing (client) | **Ziggy** (Laravel routes in JS) |
| Database    | MySQL/PostgreSQL/SQLite (via Laravel migrations) |

### Main directories

- `app/Http/Controllers/` — `WelcomeController` (home, about, brand partnerships, episode, videos API), `EpisodeController`, `UserController`, Auth, Profile
- `app/Models/` — `User`, `Episode`
- `resources/js/Pages/` — React pages (Welcome, About, BrandPartnerships, Episode; Auth; Dashboard; Episodes CRUD; Users)
- `resources/js/Components/` — e.g. HeroNav, Footer, VideoCard, RecentVideos, CustomYouTubePlayer
- `routes/web.php` — public routes + `/admin/*` (dashboard, profile, episodes, users, YouTube oEmbed proxy)

---

## Requirements

- **PHP** 8.2+
- **Composer**
- **Node.js** 18+ and **npm**
- **Database**: MySQL 8+, PostgreSQL 15+, or SQLite 3

---

## Versions

Version constraints from this project (use `composer show` and `npm ls` for exact resolved versions).

| Category   | Dependency            | Version constraint |
|-----------|------------------------|--------------------|
| **PHP**   | php                    | ^8.2               |
| **Backend** | laravel/framework    | ^12.0              |
|            | inertiajs/inertia-laravel | ^2.0        |
|            | laravel/sanctum       | ^4.0               |
|            | tightenco/ziggy       | ^2.0               |
| **Frontend** | react / react-dom   | ^18.2.0            |
|            | @inertiajs/react      | ^2.0.0             |
|            | vite                  | ^7.0.7             |
|            | @vitejs/plugin-react  | ^4.2.0             |
|            | laravel-vite-plugin   | ^2.0.0             |
| **CSS**   | tailwindcss            | ^3.2.1             |
|            | @tailwindcss/vite     | ^4.0.0             |
|            | postcss               | ^8.4.31            |
| **UI**    | framer-motion          | ^12.31.0           |
|            | @headlessui/react     | ^2.0.0             |
|            | react-quill           | ^2.0.0             |
| **Tooling** | laravel/breeze       | ^2.3 (dev)         |

- **Node:** Use Node 18 LTS or 20 LTS; npm 9+.
- **Composer:** Use Composer 2.

---

## Local Setup

1. **Clone and install PHP dependencies**

   ```bash
   git clone <repo-url>
   cd the-pod
   composer install
   ```

2. **Environment**

   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

   Edit `.env`: set `APP_NAME`, `APP_URL`, and your `DB_*` (database driver, host, name, user, password).

3. **Database**

   ```bash
   php artisan migrate
   php artisan db:seed
   ```

   The seeder creates 3 users (ids 1–3 for user management):  
   - `admin@example.com` / `password`  
   - `editor@example.com` / `password`  
   - `test@example.com` / `password`  

   Change these in production or via User management.

4. **Frontend**

   ```bash
   npm install
   npm run build
   ```

   For local development, run the dev server in a separate terminal:

   ```bash
   npm run dev
   ```

5. **Run the app**

   ```bash
   php artisan serve
   ```

   - Public site: [http://localhost:8000](http://localhost:8000)  
   - Admin: [http://localhost:8000/admin](http://localhost:8000/admin) (log in with one of the seeded users)

---

## Deployment

### Quick deploy (checklist)

On the server (web root = `public/`):

```bash
# 1. Install dependencies and build assets
composer install --no-dev --optimize-autoloader
cp .env.example .env && php artisan key:generate
# Edit .env: APP_ENV=production, APP_DEBUG=false, APP_URL, DB_*

# 2. Build frontend
npm ci && npm run build

# 3. Database and caches
php artisan migrate --force
php artisan db:seed --force   # optional
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

Then point your web server (Apache/Nginx) at the `public` directory.

---

### 1. Server / hosting

- Any host that supports PHP 8.2+ and Laravel (e.g. shared hosting with PHP, or VPS/containers).
- Point the web root to the **`public`** directory.

### 2. Environment

- Copy `.env.example` to `.env` on the server.
- Set at least:
  - `APP_ENV=production`
  - `APP_DEBUG=false`
  - `APP_URL=https://your-domain.com`
  - `DB_*` for your production database
- Run:

  ```bash
  php artisan key:generate
  ```

### 3. Dependencies and build

  ```bash
  composer install --no-dev --optimize-autoloader
  npm ci
  npm run build
  ```

### 4. Database and storage

  ```bash
  php artisan migrate --force
  php artisan db:seed --force   # optional; only if you want seeded users
  php artisan storage:link      # if you use storage for uploads
  ```

### 5. Caching (recommended)

  ```bash
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache
  ```

### 6. Web server

- **Apache:** Ensure `mod_rewrite` is enabled; document root = `public/`; Laravel’s `public/.htaccess` is usually enough.
- **Nginx:** Use a standard Laravel snippet (try_files to `index.php`, PHP-FPM).

### 7. Scheduler (optional)

If you add scheduled tasks later:

```bash
* * * * * cd /path/to/the-pod && php artisan schedule:run >> /dev/null 2>&1
```

### 8. Post-deploy

- Confirm `APP_URL` matches the live URL (for links and Ziggy).
- Restrict registration if needed (already disabled in this app).
- Use strong passwords for seeded/admin users or create new users via User management and remove/change seeded ones.

---

## License

The Laravel framework and this application are open-sourced under the [MIT license](https://opensource.org/licenses/MIT).
