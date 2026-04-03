# ✈️ Trip Expense

A full-stack trip expense tracker with a Python/Flask backend, SQLite database, and a clean separated frontend.

---

## Project Structure

```
tripexpense/
├── app.py          ← Flask backend + SQLite API
├── index.html      ← Frontend HTML (served by Flask)
├── styles.css      ← All CSS styles
├── app.js          ← All JavaScript logic
├── start.sh        ← Quick start script
└── README.md
```

---

## Requirements

- Python 3.8+
- Flask → `pip install flask`

---

## How to Run

```bash
python3 app.py
```

Then open: [http://localhost:5000](http://localhost:5000)

Or use the start script:

```bash
chmod +x start.sh
./start.sh
```

---

## Features

- 🗺️ **Trips** — Create trips with custom emoji, banner color, and date range
- 👥 **Members** — Add/remove trip members anytime
- 🧾 **Expenses** — Log expenses by category (Food, Transport, Hotel, Activity, Other)
- ⚖️ **Split Types** — Equal split, Custom amounts, or Percentage-based
- 💳 **Settlements** — Auto-calculates who owes whom; mark settlements as done
- 📊 **Reports** — Category donut chart, daily spending bars, per-person breakdown
- 🖱️ **Clickable Trip Cards** — Click anywhere on a trip card to open its dashboard

---

## Frontend File Overview

| File         | Purpose                                      |
|--------------|----------------------------------------------|
| `index.html` | HTML structure — pages, modals, nav          |
| `styles.css` | All visual styling and responsive layout     |
| `app.js`     | All JavaScript — API calls, rendering, logic |

---

## API Endpoints (Flask)

| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| GET    | `/api/trips`                      | List all trips           |
| POST   | `/api/trips`                      | Create a trip            |
| PUT    | `/api/trips/:id`                  | Update trip              |
| DELETE | `/api/trips/:id`                  | Delete trip              |
| POST   | `/api/trips/:id/members`          | Add member to trip       |
| DELETE | `/api/members/:id`                | Remove member            |
| GET    | `/api/trips/:id/expenses`         | List expenses for trip   |
| POST   | `/api/trips/:id/expenses`         | Add expense              |
| DELETE | `/api/expenses/:id`               | Delete expense           |
| GET    | `/api/trips/:id/summary`          | Get balances & settlements |
