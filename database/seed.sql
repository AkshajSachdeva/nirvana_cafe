USE nirvana_cafe;

INSERT INTO cafe_branches (branch_name,area_name,address,description,opening_time,closing_time) VALUES
('Vasant Vihar','Vasant Vihar','Demo address, Vasant Vihar, Delhi NCR','A quiet neighborhood stop for coffee, tea, and a slow afternoon.','08:00','21:00'),
('Cyber City','Cyber City','Demo address, Cyber City, Delhi NCR','A relaxed cafe prototype branch near the Cyber City area.','08:00','22:00'),
('Aerocity','Aerocity','Demo address, Aerocity, Delhi NCR','A warm place to pause in the Aerocity area.','07:00','22:00'),
('Khan Market','Khan Market','Demo address, Khan Market, Delhi NCR','A small cafe setting for a coffee break or a light bite.','09:00','21:00'),
('Golf Course Road','Golf Course Road','Demo address, Golf Course Road, Delhi NCR','An easygoing branch concept for meetups and quiet work.','08:00','22:00')
ON DUPLICATE KEY UPDATE area_name=VALUES(area_name),address=VALUES(address),description=VALUES(description),opening_time=VALUES(opening_time),closing_time=VALUES(closing_time);

INSERT INTO cafe_tables (branch_id,table_code,capacity)
SELECT b.branch_id, t.table_code, t.capacity FROM cafe_branches b
CROSS JOIN (SELECT 'T1' table_code,2 capacity UNION ALL SELECT 'T2',2 UNION ALL SELECT 'T3',2 UNION ALL SELECT 'T4',2 UNION ALL SELECT 'T5',4 UNION ALL SELECT 'T6',4 UNION ALL SELECT 'T7',6 UNION ALL SELECT 'T8',8) t
WHERE b.branch_name IN ('Vasant Vihar','Cyber City','Aerocity','Khan Market','Golf Course Road')
ON DUPLICATE KEY UPDATE capacity=VALUES(capacity);

INSERT INTO menu_categories (category_name,display_order) VALUES
('Coffee',1),('Tea',2),('Cold Drinks',3),('Bakery',4),('Food',5)
ON DUPLICATE KEY UPDATE display_order=VALUES(display_order);
INSERT INTO menu_items (category_id,item_name,description) SELECT c.category_id,v.item_name,v.description FROM menu_categories c JOIN (
  SELECT 'Coffee' category,'House Filter Coffee' item_name,'Slow brewed, rounded, and served warm.' description UNION ALL
  SELECT 'Coffee','Cappuccino','Espresso with steamed milk and a soft foam finish.' UNION ALL
  SELECT 'Coffee','Matcha Latte','A gently whisked green tea latte with milk.' UNION ALL
  SELECT 'Tea','Masala Chai','Black tea simmered with warming spices.' UNION ALL
  SELECT 'Tea','Chamomile Tea','A light herbal infusion served without caffeine.' UNION ALL
  SELECT 'Cold Drinks','Iced Coffee','Chilled coffee with milk over ice.' UNION ALL
  SELECT 'Cold Drinks','Lemon Cooler','Lemon, soda, and a little mint.' UNION ALL
  SELECT 'Bakery','Butter Croissant','A flaky, buttery pastry.' UNION ALL
  SELECT 'Bakery','Banana Bread','A soft slice with ripe banana and spice.' UNION ALL
  SELECT 'Food','Avocado Toast','Sourdough toast with avocado and herbs.' UNION ALL
  SELECT 'Food','Garden Sandwich','Seasonal vegetables with a mild house spread.'
) v ON v.category=c.category_name
ON DUPLICATE KEY UPDATE description=VALUES(description);

INSERT INTO branch_menu (branch_id,menu_item_id,price,is_available,availability_note)
SELECT b.branch_id,i.menu_item_id,
  CASE i.item_name
    WHEN 'House Filter Coffee' THEN 150 + (b.branch_id*5)
    WHEN 'Cappuccino' THEN 190 + (b.branch_id*5)
    WHEN 'Matcha Latte' THEN 230 + (b.branch_id*5)
    WHEN 'Masala Chai' THEN 120 + (b.branch_id*5)
    WHEN 'Chamomile Tea' THEN 160 + (b.branch_id*5)
    WHEN 'Iced Coffee' THEN 210 + (b.branch_id*5)
    WHEN 'Lemon Cooler' THEN 170 + (b.branch_id*5)
    WHEN 'Butter Croissant' THEN 180 + (b.branch_id*5)
    WHEN 'Banana Bread' THEN 150 + (b.branch_id*5)
    WHEN 'Avocado Toast' THEN 320 + (b.branch_id*5)
    ELSE 280 + (b.branch_id*5)
  END,
  IF(i.item_name='Matcha Latte' AND b.branch_name<>'Aerocity',FALSE,TRUE),
  IF(i.item_name='Matcha Latte' AND b.branch_name<>'Aerocity','Not offered at this demo branch',NULL)
FROM cafe_branches b CROSS JOIN menu_items i
WHERE TRUE
ON DUPLICATE KEY UPDATE price=VALUES(price),is_available=VALUES(is_available),availability_note=VALUES(availability_note);

INSERT INTO subscription_plans (plan_name,description,price,billing_interval,benefits,is_active) VALUES
('Pause','A demo monthly membership concept. No charge is made.',299.00,'monthly','Sample benefits: a seasonal menu note and one demo loyalty bonus.',TRUE),
('Ritual','A demo yearly membership concept. No charge is made.',2499.00,'yearly','Sample benefits: member menu previews and demo loyalty bonuses.',TRUE)
ON DUPLICATE KEY UPDATE description=VALUES(description),price=VALUES(price),billing_interval=VALUES(billing_interval),benefits=VALUES(benefits),is_active=VALUES(is_active);
