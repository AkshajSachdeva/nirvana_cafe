# Database notes

`database/schema.sql` creates the 19 customer, branch, menu, booking, loyalty, subscription, staff-admin, award, and order tables. `database/seed.sql` inserts five fictional Delhi NCR demo branches, eight tables at each branch, a compact category-based menu with branch-specific price/availability rows, and two non-payment subscription examples. Run `npm run setup:admin-demo --prefix server` to seed separate admin accounts, six fictional staff per branch, monthly awards, and mock sample orders. Customers may also submit menu pre-orders; assigned staff are stored on the order row and shown only in the admin dashboard.

## Relationships

- `customers` owns reservation, waitlist, feedback, loyalty-card, and subscription records.
- `cafe_branches` owns table inventory and branch-specific menu and reservation/waitlist/feedback records.
- `reservation_tables` assigns one or more physical tables to a reservation.
- `menu_categories` groups shared `menu_items`; `branch_menu` sets each item's branch price and availability.
- `loyalty_cards` has at most one card per customer; `loyalty_transactions` records ledger changes.
- `subscription_plans` defines demo plans, and `customer_subscriptions` records customer enrollment.
- `admin_users` stores super-admin and branch-admin credentials; a branch admin is tied to exactly one branch.
- `staff_members` belongs to a branch; `staff_month_awards` records one demo staff member of the month per branch and month.
- `customer_orders` records generated sample orders and customer pre-orders, and stores the internal assigned staff member. `customer_order_items` stores menu item, quantity, and price snapshots.

## Reservation rules

Bookings use a 90-minute duration and the branch's local clock, `Asia/Kolkata`. API dates are ISO `YYYY-MM-DD` and times are 24-hour `HH:mm`. The API checks interval overlap using `existing.start < requested.end AND existing.end > requested.start`, assigns the smallest suitable table or table combination in stable capacity/id order, and writes the booking plus assignments in a transaction. Availability is rechecked when booking. Branch pre-order staff assignment also takes a branch row lock and selects the staff member with the lowest scheduled order count for that date.

## Loyalty and subscriptions

Each customer pre-order earns one demo point per ₹100 spent, with a minimum of one point per pre-order. The order, item snapshots, loyalty ledger transaction, and incremented card balance are committed atomically. The account displays the pre-order's items, date/time, status, and total beside the points ledger. Points have no cash value. Only one active subscription is allowed per customer by the API. Plan pricing is display/demo data; there is no payment processing.
