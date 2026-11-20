# Nirvana Cafe DBMS Project Summary

## Project overview

Nirvana Cafe is a MySQL-backed cafe reservation and management website. The React client calls an Express API; the API reads and writes MySQL data. The schema has 19 related tables. Primary keys identify rows, foreign keys connect records, and unique/check constraints protect values such as email, branch table codes, positive party size, menu prices, and loyalty balances.

The admin dashboard reads this database through the authenticated `/api/admin/dashboard` endpoint. It includes a **Refresh from MySQL** control to rerun its reports after database changes, and a collapsible **SQL behind these reports** reference with examples of the staff-performance and reservation joins. The reference documents the server-side query patterns; it does not expose an arbitrary SQL console.

## What each table does on the website

| Table | Purpose in the website |
| --- | --- |
| `customers` | Customer account profile, login hash, contact details, and demo-account flag. |
| `cafe_branches` | Branch name, area, address, opening hours, and active status; used by booking, menu, and admin views. |
| `cafe_tables` | Physical tables per branch, their seating capacity, and availability/active state. |
| `reservations` | Customer booking, branch, date/time interval, party size, confirmation status, and booking code. |
| `reservation_tables` | Junction table assigning one or more physical tables to a reservation; has a composite key of reservation and table. |
| `waitlist_entries` | Customer's requested branch/date/time/party size and waitlist status. |
| `menu_categories` | Category names and display order for the menu. |
| `menu_items` | Shared menu item name, description, category, and active state. |
| `branch_menu` | Branch-specific menu availability and price for each menu item. |
| `feedback` | Customer rating/comments for a branch, optionally tied to a reservation. |
| `loyalty_cards` | One loyalty card per customer and the current points balance/status. |
| `loyalty_transactions` | Points ledger entries (earned, redeemed, or adjusted), optionally linked to a reservation. Pre-orders currently earn points. |
| `subscription_plans` | Available demo subscription plan names, prices, billing intervals, and benefits. |
| `customer_subscriptions` | A customer's selected plan, status, start/end dates, and cancellation date. |
| `admin_users` | Separate super-admin and branch-admin logins; `branch_id` is empty for a super admin. |
| `staff_members` | Staff profiles, role/title, branch assignment, and active state. |
| `staff_month_awards` | Staff member of the month per branch and month, with reason and demo flag. |
| `customer_orders` | Customer pre-orders and seeded sample orders, including branch, visit date/time, status, total, optional reservation, and internally assigned staff member. |
| `customer_order_items` | The menu items and quantities in each order, with the unit-price snapshot used for that order. |

## Major joins used

### 1. Show the branch menu with category and branch price

```sql
SELECT c.category_name, i.item_name, i.description, bm.price, bm.is_available
FROM branch_menu AS bm
JOIN menu_items AS i ON i.menu_item_id = bm.menu_item_id
JOIN menu_categories AS c ON c.category_id = i.category_id
WHERE bm.branch_id = ? AND i.is_active = 1
ORDER BY c.display_order, i.item_name;
```

The shared item name and category come from `menu_items` and `menu_categories`; price and availability are branch-specific in `branch_menu`.

### 2. Show a customer's reservations with branch and assigned tables

```sql
SELECT r.reservation_code, b.branch_name, r.reservation_date, r.start_time,
       r.party_size, r.status, t.table_code
FROM reservations AS r
JOIN cafe_branches AS b ON b.branch_id = r.branch_id
LEFT JOIN reservation_tables AS rt ON rt.reservation_id = r.reservation_id
LEFT JOIN cafe_tables AS t ON t.table_id = rt.table_id
WHERE r.customer_id = ?;
```

The two `LEFT JOIN`s preserve a reservation row even if an assignment is not present. In the normal confirmed booking path, the API inserts the reservation and assignment together.

### 3. Show pre-orders with branch, staff, and item names

```sql
SELECT o.order_id, b.branch_name, o.order_date, o.order_time, o.status,
       s.full_name AS assigned_staff, i.item_name, oi.quantity, oi.unit_price
FROM customer_orders AS o
JOIN cafe_branches AS b ON b.branch_id = o.branch_id
LEFT JOIN staff_members AS s ON s.staff_id = o.assigned_staff_id
LEFT JOIN customer_order_items AS oi ON oi.order_id = o.order_id
LEFT JOIN menu_items AS i ON i.menu_item_id = oi.menu_item_id
WHERE o.customer_id = ? AND o.order_type = 'preorder';
```

`LEFT JOIN` is used for staff and item details because those foreign keys are optional at the order row level. The account page groups the resulting order items and shows each preorder's total.

### 4. Admin branch/staff performance

Admin queries join `staff_members` to `cafe_branches`, then `LEFT JOIN` `customer_orders` by assigned staff and date. They use `COUNT(o.order_id)` and `SUM(o.total_amount)` to display order counts and sales even for staff with no orders. Awards join `staff_month_awards` to both branch and staff to show the branch name and award recipient.

### 5. Availability check

Availability uses `NOT EXISTS` over `reservation_tables` joined to `reservations`. It excludes tables attached to a pending/confirmed reservation whose interval overlaps the requested 90-minute interval:

```sql
existing.start_time < requested_end
AND existing.end_time > requested_start
```

The API then chooses an active table or combination of tables with enough seats for the party.

## SQL commands and DBMS features

## Which tables are joined, and why

| Query / website view | Tables joined | Join type and reason |
| --- | --- | --- |
| Branch menu | `branch_menu` → `menu_items` → `menu_categories` | `INNER JOIN`s: a displayed branch listing needs a real menu item and category. `branch_menu` supplies the branch-specific price and availability. |
| Admin branch totals | `cafe_branches` → `staff_members`, `customer_orders`, `reservations` | `LEFT JOIN`s keep an active branch visible even when it has no staff, orders, or bookings in the selected date range. `COUNT(DISTINCT ...)` prevents staff/order/reservation counts being multiplied by the other one-to-many joins. |
| Admin staff performance | `staff_members` → `cafe_branches` → `customer_orders` | `INNER JOIN` to branch because every staff row belongs to a branch; `LEFT JOIN` to orders so staff with zero orders still appear. `COUNT` and `SUM` calculate the report metrics. |
| Staff of the month | `staff_month_awards` → `cafe_branches` → `staff_members` | `INNER JOIN`s: each award must have an existing branch and staff member; the joins supply their display names. |
| Daily order and reservation totals | Branch/day rows → grouped `customer_orders` and grouped `reservations` | The API groups each source table by branch/date, then uses `LEFT JOIN`s to keep a branch/day row when either count is zero. `UNION` combines dates appearing in either source. |
| Admin reservation schedule | `reservations` → `cafe_branches` → `customers` → `reservation_tables` → `cafe_tables` | `INNER JOIN`s to branch/customer because a reservation requires both. `LEFT JOIN`s through the assignment junction to tables so the reservation can still appear if no physical table row is linked. `GROUP_CONCAT` combines assigned table codes into one cell. |
| Admin order schedule | `customer_orders` → `cafe_branches` → `staff_members` → `customer_order_items` → `menu_items` | `INNER JOIN` to branch because every order belongs to a branch. `LEFT JOIN`s to staff and items preserve orders with no staff assignment or item rows; `GROUP_CONCAT` lists item names and quantities. |
| Customer reservations and waitlist | `reservations` / `waitlist_entries` → `cafe_branches` | `INNER JOIN`: the branch is required and its name is shown with each record. |
| Customer loyalty ledger | `loyalty_transactions` → `loyalty_cards` → `customers` | `INNER JOIN`s: the ledger belongs to a card, and the card belongs to a customer; filtering by the signed-in customer returns only their points history. |
| Customer subscription list | `customer_subscriptions` → `subscription_plans` | `INNER JOIN`: each subscription must reference a plan, whose name is displayed. |
| Customer feedback list | `feedback` → `cafe_branches` | `INNER JOIN`: each feedback record must reference a branch; this supplies its branch name. |
| Customer pre-order history | `customer_orders` → `cafe_branches`; optionally `reservations`, `customer_order_items`, `menu_items` | `INNER JOIN` to branch; `LEFT JOIN`s to reservation and item/menu details because a pre-order can exist without being tied to a table booking, and optional detail rows should not hide the order. |
| Reservation availability | `reservation_tables` joined to `reservations` inside `NOT EXISTS` | The subquery finds a table assignment that overlaps the requested time. `NOT EXISTS` keeps only tables with no conflicting active reservation. |

The `reservation_tables` junction is important: a reservation may use more than one table, and a physical table can be assigned to different reservations at non-overlapping times. The junction connects the two sides while preserving their foreign keys.

## Normal forms by table

Normal-form claims depend on the functional dependencies assumed. Under the declared primary and unique keys, the tables below satisfy 1NF, 2NF, and 3NF; they are generally in BCNF as well. See the caveat for linked customer orders.

| Table | Highest normal form | Reason |
| --- | --- | --- |
| `customers` | BCNF | `customer_id` and unique `email` identify each row. |
| `cafe_branches` | BCNF | `branch_id` and unique `branch_name` identify each row. |
| `cafe_tables` | BCNF | `table_id` and unique `(branch_id, table_code)` identify each table. |
| `reservations` | BCNF | `reservation_id` and unique `reservation_code` identify each booking. |
| `reservation_tables` | BCNF | `(reservation_id, table_id)` is the composite key; assignment data depends on the pair. |
| `waitlist_entries` | BCNF | `waitlist_id` identifies the request. |
| `menu_categories` | BCNF | `category_id` and unique `category_name` identify each category. |
| `menu_items` | BCNF | `menu_item_id` and unique `(category_id, item_name)` identify each item. |
| `branch_menu` | BCNF | `branch_menu_id` and unique `(branch_id, menu_item_id)` identify a branch's listing. |
| `feedback` | BCNF | `feedback_id` identifies each feedback record. |
| `loyalty_cards` | BCNF | `loyalty_card_id` and unique `customer_id` identify each card. |
| `loyalty_transactions` | BCNF | `loyalty_transaction_id` identifies each ledger entry. |
| `subscription_plans` | BCNF | `subscription_plan_id` and unique `plan_name` identify each plan. |
| `customer_subscriptions` | BCNF | `customer_subscription_id` identifies each enrollment. |
| `admin_users` | BCNF | `admin_id` and unique `email` identify each admin account. |
| `staff_members` | BCNF | `staff_id` and unique `email` identify each staff record. |
| `staff_month_awards` | BCNF | `award_id` and unique `(branch_id, month_start)` identify each branch/month award. |
| `customer_orders` | BCNF under declared keys; conditional 3NF concern | `order_id` identifies an order and non-null `sample_code` is unique. If `reservation_id` is present, the API requires the order's branch/date/time to match that reservation, so those reservation facts are duplicated on the order row. Strict normalization could derive them through a join for linked orders. |
| `customer_order_items` | BCNF | `order_item_id` identifies a line; its quantity and saved unit price depend on that line. |

All columns store single values, satisfying 1NF. Single-column primary keys avoid partial-key dependencies; the non-key timestamp in `reservation_tables` depends on its full composite key, satisfying 2NF. Descriptive branch/customer/menu/plan fields are stored in their own tables and referenced by foreign keys, supporting 3NF. `loyalty_cards.points_balance` and `customer_orders.total_amount` are cached summaries of ledger/order-item data; the API updates them transactionally to keep them in sync.

- **DDL:** `CREATE DATABASE`, `CREATE TABLE`; primary keys, foreign keys, `UNIQUE`, `CHECK`, `ENUM`, indexes, and timestamps define and protect the schema.
- **DQL:** `SELECT` retrieves data. `WHERE`, `ORDER BY`, `GROUP BY`, `COUNT`, `SUM`, `COALESCE`, `GROUP_CONCAT`, `UNION`, and `NOT EXISTS` support filtering, reports, and availability checks.
- **DML:** `INSERT` creates accounts, reservations, table assignments, waitlist entries, feedback, pre-orders, order items, subscriptions, and loyalty ledger entries. `UPDATE` changes reservation/subscription status and loyalty balances.
- **No hard delete for normal cancellation:** a reservation or subscription is marked `cancelled` with `UPDATE`, preserving its history. `ON DELETE CASCADE` is configured for reservation assignments and order items if their parent is deleted directly.
- **TCL / transactions:** `BEGIN` (via `beginTransaction`), `COMMIT`, and `ROLLBACK` group related changes so partial bookings or orders are not left behind after an error.
- **Prepared statements:** the API sends values as `?` parameters to MySQL, reducing SQL injection risk and separating values from query text.

## Booking race: two customers request the last table

The booking API begins a transaction, locks the selected branch row using `SELECT ... FOR UPDATE`, then checks availability again and inserts the reservation and its `reservation_tables` assignment before committing. A second request for the same branch waits for that branch lock. After the first transaction commits, the second request rechecks availability, finds no suitable table, rolls back, and receives an unavailable response. The availability shown before the click is only a preview; the locked transactional check at booking time is authoritative.

Pre-orders use a transaction too: order header, item rows, loyalty ledger entry, and updated card balance commit together or roll back together.
