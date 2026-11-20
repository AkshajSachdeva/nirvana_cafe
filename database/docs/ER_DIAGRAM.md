# Nirvana Cafe relational model

![Nirvana Cafe ER diagram](Nirvana_Cafe_ER_Diagram.svg)

This diagram includes customer-facing records and the demo operations extension. Generated staff, awards, and sample orders are synthetic prototype data; no payments are processed.

```mermaid
erDiagram
    CUSTOMERS ||--o{ RESERVATIONS : makes
    CAFE_BRANCHES ||--o{ RESERVATIONS : receives
    CAFE_BRANCHES ||--o{ CAFE_TABLES : contains
    RESERVATIONS ||--o{ RESERVATION_TABLES : assigned_to
    CAFE_TABLES ||--o{ RESERVATION_TABLES : assigned
    CUSTOMERS ||--o{ WAITLIST_ENTRIES : joins
    CAFE_BRANCHES ||--o{ WAITLIST_ENTRIES : has
    CUSTOMERS ||--o{ FEEDBACK : submits
    CAFE_BRANCHES ||--o{ FEEDBACK : receives
    CAFE_BRANCHES ||--o{ BRANCH_MENU : offers
    MENU_ITEMS ||--o{ BRANCH_MENU : listed_as
    MENU_CATEGORIES ||--o{ MENU_ITEMS : groups
    CUSTOMERS ||--o| LOYALTY_CARDS : owns
    LOYALTY_CARDS ||--o{ LOYALTY_TRANSACTIONS : records
    CUSTOMERS ||--o{ CUSTOMER_SUBSCRIPTIONS : has
    SUBSCRIPTION_PLANS ||--o{ CUSTOMER_SUBSCRIPTIONS : selected
    CAFE_BRANCHES ||--o{ ADMIN_USERS : administers
    CAFE_BRANCHES ||--o{ STAFF_MEMBERS : employs
    STAFF_MEMBERS ||--o{ STAFF_MONTH_AWARDS : recognized
    CAFE_BRANCHES ||--o{ STAFF_MONTH_AWARDS : awards
    CUSTOMERS o|--o{ CUSTOMER_ORDERS : places
    CAFE_BRANCHES ||--o{ CUSTOMER_ORDERS : receives
    STAFF_MEMBERS o|--o{ CUSTOMER_ORDERS : assigned
    RESERVATIONS o|--o{ CUSTOMER_ORDERS : associated
    CUSTOMER_ORDERS ||--|{ CUSTOMER_ORDER_ITEMS : contains
    MENU_ITEMS ||--o{ CUSTOMER_ORDER_ITEMS : selected
```

The schema implements 19 entities. `reservation_tables` is a junction table, so one booking may use multiple tables. `branch_menu` stores price and availability per branch rather than on the shared menu item. Admin accounts are separate from customer accounts; branch admin access is constrained to one branch by the dashboard API.
