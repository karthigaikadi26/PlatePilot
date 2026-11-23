# PlatePilot — Eat well. Spend smart.

PlatePilot is a responsive student-focused meal planning and nutrition budgeting web application. It helps college students and hostel residents explore affordable Indian meals, generate a weekly plan, review estimated nutrition and grocery spend, manage a consolidated shopping checklist, and exchange hostel cooking hacks.

## Architecture & Improvements

- **Full-Stack Persistence**: Built-in SQLite database (`platepilot.db`) with automatic table creation, relations, constraints, and data seeding via `database.js`.
- **Hybrid Storage Client**: `storage.js` seamlessly syncs data with the SQLite REST API while maintaining automatic local storage fallback for offline support.
- **RESTful API**: Comprehensive endpoints for recipes, meal plans, shopping list items, community tips, and user preferences (`server.js`).
- **Category-Aware Meal Optimizer**: Slot-based heuristic generation (`optimizer.js`) assigning distinct meals for Breakfast, Lunch, Dinner, and Snack, respecting daily budgets, fitness goals (Muscle Building, Weight Management, Balanced Eating), allergy/ingredient exclusions, and meal variety.
- **Interactive Recipe Catalogue**: 24+ rich, budget-friendly student recipes with detailed ingredients, step-by-step cooking instructions, diet filters, and custom recipe submission.
- **Weekly Shopping Checklist**: Automatically consolidated from active meal plans with category grouping, checkboxes synchronized with SQLite, custom item additions, and one-click clipboard copying.
- **Nutrition & Spend Analytics**: Dashboard featuring calorie intake trends, protein target tracking vs. recommended student RDA, and estimated savings compared to dining out.
- **Community Tip Board**: Student-powered tip feed with categorization, like tracking, and direct SQLite storage.
- **UI & UX Polish**: Non-blocking toast notification system, responsive modal dialogs, real-time budget sliders, and mobile drawer navigation.

---

## Quick Start

### 1. Requirements
- Node.js 18+ (tested on Node.js v26.13.1)
- npm

### 2. Installation & Running
1. Open the project root folder in terminal:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Visit `http://localhost:3000` in your browser.

For hot-reload during development:
```bash
npm run dev
```

---

## API Documentation

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server health check and SQLite database status |
| `GET` | `/api/recipes` | Recipe catalogue (supports `?diet=`, `?category=`, `?search=`, `?maxCost=`) |
| `GET` | `/api/recipes/:id` | Retrieve single recipe details |
| `POST` | `/api/recipes` | Create a new custom recipe |
| `PUT` | `/api/recipes/:id` | Update an existing recipe |
| `DELETE` | `/api/recipes/:id` | Delete recipe by ID |
| `GET` | `/api/plan` | Fetch current active weekly meal plan |
| `POST` | `/api/plan` | Save 7-day meal plan to SQLite database |
| `DELETE` | `/api/plan` | Clear active meal plan |
| `GET` | `/api/shopping` | Retrieve weekly shopping checklist items |
| `POST` | `/api/shopping` | Add custom item to shopping checklist |
| `PUT` | `/api/shopping/:id` | Toggle checked status of shopping item |
| `DELETE` | `/api/shopping/:id` | Delete shopping item |
| `POST` | `/api/shopping/clear-checked` | Remove checked shopping items |
| `GET` | `/api/community` | Retrieve community tips and hacks |
| `POST` | `/api/community` | Post new student tip |
| `POST` | `/api/community/:id/like` | Upvote a community tip |
| `GET` | `/api/preferences` | Retrieve saved user preferences |
| `PUT` | `/api/preferences` | Update saved user preferences |

---

## Project Structure

```text
PlatePilot/
├── index.html          # Landing page with value proposition & overview
├── planner.html        # Interactive 7-day meal planner
├── dashboard.html      # Nutrition, calorie & budget analytics
├── recipes.html        # Recipe catalogue with details modal & custom submission
├── shopping.html       # Consolidated shopping checklist with SQLite sync
├── community.html      # Community tips and hostel cooking hacks
├── database.js         # SQLite database schema, initialization & CRUD queries
├── server.js           # Express REST API server & static file host
├── storage.js          # Client-side hybrid SQLite/LocalStorage storage layer
├── optimizer.js        # Category-aware meal planning heuristic engine
├── planner.js          # Meal planner page controller & meal swap handler
├── dashboard.js        # Nutrition dashboard visualizations & analytics
├── recipes.js          # Recipe search, filtering, and modal controller
├── shopping.js         # Grocery checklist controller & progress tracker
├── app.js              # Global UI utilities (toasts, modals, navigation)
├── recipes.json        # Base seed recipe catalog (24 diverse meals)
├── style.css           # Core design system, variables, modals, toasts
├── responsive.css      # Responsive media queries (desktop, tablet, mobile)
├── animations.css      # Smooth transitions and keyframe animations
├── platepilot.db       # SQLite database file (created on startup)
└── package.json        # Project metadata & npm scripts
```

## License
MIT
