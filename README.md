# Nirvana Cafe

Nirvana Cafe is a student database management system project for a fictional cafe group in Delhi NCR. It demonstrates reservations, branch menus, customer pre-orders, loyalty points, and branch operations in a web application. It is a prototype. It does not take payments or send reservations to a real cafe.

## Recent project updates

- Added table reservations to the home page with date, time, party size, and seating-capacity availability checks.
- Added server-side booking confirmation and a transaction lock to prevent two customers from getting the same last table.
- Added demo branch and super-admin dashboards with staff records, monthly staff awards, order counts, daily reservations, and order details.
- Added menu pre-orders linked to a visit, with staff assigned internally and order items and totals shown in the customer's account.
- Added loyalty points for pre-orders and a transaction ledger.
- Added an admin data refresh control and expandable examples of the SQL joins behind reports.
- Added the connected ER diagram and DBMS project summary under `database/docs`.

## Technology

- React and Vite frontend
- Express API on Node.js
- MySQL 8 database
- `mysql2` parameterized queries
- `bcryptjs` password hashing and cookie-based sessions

## Requirements

- Node.js 20 or newer and npm
- MySQL 8.0.16 or newer

## Local setup

From the project root in PowerShell, install the dependencies:

```powershell
npm install
npm install --prefix client
npm install --prefix server
Copy-Item .env.example server/.env
```

Edit `server/.env` with your local MySQL connection details. Then create the schema and load the branch and menu data:

```powershell
Get-Content -Raw database/schema.sql | mysql -u root -p
Get-Content -Raw database/seed.sql | mysql -u root -p nirvana_cafe
```

Use your MySQL username instead of `root` if needed. Add demo admin, staff, awards, and sample order data:

```powershell
npm run setup:admin-demo --prefix server
```

To create upcoming demo reservations, run:

```powershell
npm run seed:demo-reservations --prefix server
```

Start the API and frontend together:

```powershell
npm run dev
```

Open <http://localhost:5173>. The API runs on port 4000. Its database health endpoint is <http://localhost:4000/api/health>.

This project also includes scripts for an isolated local MySQL server on port 3307. Its database files are stored in the ignored `.mysql/` folder. On Windows, use `scripts/start-local-mysql.ps1` to start it. Copy the matching port and account values into `server/.env`.

## Demo admin access

Open `/admin` in the website. The demo super-admin is `super.admin@nirvana-cafe.invalid`; branch admins use `<branch-slug>.admin@nirvana-cafe.invalid`, such as `vasant.vihar.admin@nirvana-cafe.invalid`. Demo admin password: `CafeAdmin2026!`. These credentials are for the class prototype only. Do not use them for a real service.

## Database and project documentation

- [MySQL schema](database/schema.sql)
- [Seed data](database/seed.sql)
- [ER diagram image](database/docs/Nirvana_Cafe_ER_Diagram.png)
- [ER diagram source](database/docs/ER_DIAGRAM.md)
- [Database notes](database/docs/DATABASE.md)
- [DBMS summary, joins, SQL commands, and normal forms](database/docs/DBMS_PROJECT_SUMMARY.md)

## Main website features

- Home page reservations and branch discovery
- Availability checks based on opening hours, reservation overlap, and table capacity
- Customer accounts, reservation history, and cancellation
- Branch-specific menu items, prices, and availability
- Pre-orders with itemized totals and loyalty point history
- Demo subscriptions and private feedback
- Branch-admin and super-admin dashboards with date and branch filters
- SQL-backed tables for staff activity, awards, daily totals, reservations, and orders

## Database design

The MySQL schema contains 19 tables. Foreign keys connect customers, branches, reservations, assigned tables, menus, orders, subscriptions, staff, and loyalty records. `reservation_tables` links reservations to physical tables. `branch_menu` stores branch-level prices and availability. The admin API uses joins and aggregate queries for dashboard reports.

Reservation creation rechecks availability inside a database transaction. It locks the selected branch row with `SELECT ... FOR UPDATE`, then inserts the reservation and its table assignment before committing. A competing request waits for the lock, rechecks availability, and receives an unavailable response if the table has already been booked.

## Environment and deployment notes

Keep `server/.env`, any other `.env` files, and `.mysql/` out of version control. The repository `.gitignore` excludes them. `.env.example` contains placeholders only.

GitHub stores the source code. A live full-stack deployment also needs a hosted Express API and a reachable MySQL database. GitHub Pages can serve the static frontend, but it cannot run the API or database. Configure `VITE_API_URL`, `CLIENT_ORIGIN`, `DB_*`, `NODE_ENV=production`, and a strong `SESSION_SECRET` for a hosted deployment. The prototype uses in-memory Express sessions, so add persistent session storage and production security settings before relying on it for real users.

The included `Nirvana_Cafe.html` is a generated single-file preview of the frontend. Rebuild it after client changes with:

```powershell
npm run build
node scripts/package-standalone.mjs
```

## Checks

```powershell
npm test
npm run build
```

The unit checks cover server booking rules. They do not replace testing against a separately configured MySQL instance.
