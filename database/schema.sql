CREATE DATABASE IF NOT EXISTS nirvana_cafe CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE nirvana_cafe;

CREATE TABLE IF NOT EXISTS customers (
  customer_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cafe_branches (
  branch_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_name VARCHAR(100) NOT NULL UNIQUE,
  area_name VARCHAR(100) NOT NULL,
  address VARCHAR(255) NOT NULL,
  description VARCHAR(500) NOT NULL,
  opening_time TIME NOT NULL,
  closing_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_branch_hours CHECK (closing_time > opening_time)
);
CREATE TABLE IF NOT EXISTS cafe_tables (
  table_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  table_code VARCHAR(20) NOT NULL,
  capacity TINYINT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_branch_table (branch_id, table_code),
  CONSTRAINT chk_table_capacity CHECK (capacity > 0),
  CONSTRAINT fk_table_branch FOREIGN KEY (branch_id) REFERENCES cafe_branches(branch_id)
);
CREATE TABLE IF NOT EXISTS reservations (
  reservation_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  branch_id INT NOT NULL,
  reservation_code VARCHAR(24) NOT NULL UNIQUE,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  party_size TINYINT UNSIGNED NOT NULL,
  status ENUM('pending','confirmed','cancelled','completed','no_show') NOT NULL DEFAULT 'confirmed',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  special_request VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_reservation_branch_time (branch_id,reservation_date,start_time,end_time,status),
  KEY ix_reservation_customer_date (customer_id,reservation_date),
  CONSTRAINT chk_reservation_party CHECK (party_size > 0),
  CONSTRAINT chk_reservation_interval CHECK (end_time > start_time),
  CONSTRAINT fk_reservation_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  CONSTRAINT fk_reservation_branch FOREIGN KEY (branch_id) REFERENCES cafe_branches(branch_id)
);
CREATE TABLE IF NOT EXISTS reservation_tables (
  reservation_id INT NOT NULL,
  table_id INT NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reservation_id,table_id),
  KEY ix_reservation_table_table (table_id),
  CONSTRAINT fk_rt_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE CASCADE,
  CONSTRAINT fk_rt_table FOREIGN KEY (table_id) REFERENCES cafe_tables(table_id)
);
CREATE TABLE IF NOT EXISTS waitlist_entries (
  waitlist_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  branch_id INT NOT NULL,
  requested_date DATE NOT NULL,
  requested_time TIME NOT NULL,
  party_size TINYINT UNSIGNED NOT NULL,
  status ENUM('waiting','notified','seated','cancelled','expired') NOT NULL DEFAULT 'waiting',
  queue_position INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_waitlist_queue (branch_id,requested_date,status,queue_position,created_at),
  CONSTRAINT chk_waitlist_party CHECK (party_size > 0),
  CONSTRAINT fk_waitlist_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  CONSTRAINT fk_waitlist_branch FOREIGN KEY (branch_id) REFERENCES cafe_branches(branch_id)
);
CREATE TABLE IF NOT EXISTS menu_categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(80) NOT NULL UNIQUE,
  display_order SMALLINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS menu_items (
  menu_item_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_category_item (category_id,item_name),
  CONSTRAINT fk_item_category FOREIGN KEY (category_id) REFERENCES menu_categories(category_id)
);
CREATE TABLE IF NOT EXISTS branch_menu (
  branch_menu_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  price DECIMAL(8,2) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  availability_note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_branch_menu_item (branch_id,menu_item_id),
  CONSTRAINT chk_menu_price CHECK (price >= 0),
  CONSTRAINT fk_branchmenu_branch FOREIGN KEY (branch_id) REFERENCES cafe_branches(branch_id),
  CONSTRAINT fk_branchmenu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id)
);
CREATE TABLE IF NOT EXISTS feedback (
  feedback_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  branch_id INT NOT NULL,
  reservation_id INT NULL,
  rating TINYINT UNSIGNED NULL,
  comments VARCHAR(1000) NULL,
  status ENUM('submitted','hidden') NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_feedback_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  CONSTRAINT chk_feedback_content CHECK (rating IS NOT NULL OR comments IS NOT NULL),
  CONSTRAINT fk_feedback_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  CONSTRAINT fk_feedback_branch FOREIGN KEY (branch_id) REFERENCES cafe_branches(branch_id),
  CONSTRAINT fk_feedback_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
);
CREATE TABLE IF NOT EXISTS loyalty_cards (
  loyalty_card_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL UNIQUE,
  points_balance INT NOT NULL DEFAULT 0,
  card_status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_loyalty_points CHECK (points_balance >= 0),
  CONSTRAINT fk_loyalty_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  loyalty_transaction_id INT AUTO_INCREMENT PRIMARY KEY,
  loyalty_card_id INT NOT NULL,
  points_change INT NOT NULL,
  transaction_type ENUM('earned','redeemed','adjustment') NOT NULL,
  description VARCHAR(255) NOT NULL,
  reservation_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_loyalty_ledger (loyalty_card_id,created_at),
  CONSTRAINT chk_loyalty_change CHECK (points_change <> 0),
  CONSTRAINT fk_loyalty_tx_card FOREIGN KEY (loyalty_card_id) REFERENCES loyalty_cards(loyalty_card_id),
  CONSTRAINT fk_loyalty_tx_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
);
CREATE TABLE IF NOT EXISTS subscription_plans (
  subscription_plan_id INT AUTO_INCREMENT PRIMARY KEY,
  plan_name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(500) NOT NULL,
  price DECIMAL(8,2) NOT NULL,
  billing_interval ENUM('monthly','yearly','demo') NOT NULL DEFAULT 'demo',
  benefits TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_plan_price CHECK (price >= 0)
);
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  customer_subscription_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  subscription_plan_id INT NOT NULL,
  status ENUM('active','cancelled','expired') NOT NULL DEFAULT 'active',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_customer_subscription_status (customer_id,status),
  CONSTRAINT fk_subscription_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  CONSTRAINT fk_subscription_plan FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(subscription_plan_id)
);

-- Staff administration and customer menu pre-orders (prototype data only).
CREATE TABLE IF NOT EXISTS admin_users (
  admin_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','branch_admin') NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_branch FOREIGN KEY (branch_id) REFERENCES cafe_branches(branch_id)
);
CREATE TABLE IF NOT EXISTS staff_members (
  staff_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  job_title VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_branch FOREIGN KEY (branch_id) REFERENCES cafe_branches(branch_id)
);
CREATE TABLE IF NOT EXISTS staff_month_awards (
  award_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  staff_id INT NOT NULL,
  month_start DATE NOT NULL,
  reason VARCHAR(255) NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_branch_award_month (branch_id,month_start),
  CONSTRAINT fk_award_branch FOREIGN KEY (branch_id) REFERENCES cafe_branches(branch_id),
  CONSTRAINT fk_award_staff FOREIGN KEY (staff_id) REFERENCES staff_members(staff_id)
);
CREATE TABLE IF NOT EXISTS customer_orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NULL,
  branch_id INT NOT NULL,
  reservation_id INT NULL,
  assigned_staff_id INT NULL,
  order_type ENUM('preorder','sample') NOT NULL DEFAULT 'preorder',
  order_date DATE NOT NULL,
  order_time TIME NOT NULL,
  status ENUM('scheduled','preparing','served','cancelled') NOT NULL DEFAULT 'scheduled',
  sample_code VARCHAR(80) NULL UNIQUE,
  total_amount DECIMAL(8,2) NOT NULL DEFAULT 0,
  special_request VARCHAR(500) NULL,
  is_demo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_orders_branch_date (branch_id,order_date,order_time),
  KEY ix_orders_staff_date (assigned_staff_id,order_date),
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  CONSTRAINT fk_order_branch FOREIGN KEY (branch_id) REFERENCES cafe_branches(branch_id),
  CONSTRAINT fk_order_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id),
  CONSTRAINT fk_order_staff FOREIGN KEY (assigned_staff_id) REFERENCES staff_members(staff_id)
);
CREATE TABLE IF NOT EXISTS customer_order_items (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  unit_price DECIMAL(8,2) NOT NULL,
  CONSTRAINT chk_order_item_qty CHECK (quantity > 0),
  CONSTRAINT fk_orderitem_order FOREIGN KEY (order_id) REFERENCES customer_orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_orderitem_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id)
);
