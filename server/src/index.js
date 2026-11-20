import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { pool, rows } from './db.js';
import { chooseTables, validEmail, validInterval } from './rules.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const configuredOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowedOrigins = new Set([configuredOrigin]);
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.add(configuredOrigin.replace('localhost', '127.0.0.1'));
  allowedOrigins.add(configuredOrigin.replace('127.0.0.1', 'localhost'));
}
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use(session({ name: 'nirvana.sid', secret: process.env.SESSION_SECRET || 'local-demo-only-change-this-secret-123456', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 } }));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const signedIn = (req, res, next) => req.session.customerId ? next() : res.status(401).json({ error: 'Please sign in to continue.' });
const adminSignedIn = (req, res, next) => req.session.adminId ? next() : res.status(401).json({ error: 'Admin sign-in required.' });
const validId = v => Number.isInteger(Number(v)) && Number(v) > 0;
const dateOk = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0,10) === s;
const timeOk = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
function localDateTime() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:00` };
}
function setCustomerSession(req, customerId) {
  return new Promise((resolve, reject) => req.session.regenerate(err => {
    if (err) return reject(err);
    req.session.customerId = customerId;
    req.session.save(saveErr => saveErr ? reject(saveErr) : resolve());
  }));
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await rows('SELECT 1 AS ok');
  res.json({ status: 'ok', database: 'connected', prototype: true });
}));
app.get('/api/branches', asyncRoute(async (_req, res) => res.json(await rows('SELECT branch_id AS id, branch_name AS name, area_name AS area, address, description, opening_time AS openingTime, closing_time AS closingTime FROM cafe_branches WHERE is_active=1 ORDER BY branch_id'))));
app.get('/api/branches/:id/menu', asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Choose a valid branch.' });
  const items = await rows(`SELECT c.category_id AS categoryId, c.category_name AS category, c.display_order AS categoryOrder, i.menu_item_id AS id, i.item_name AS name, i.description, bm.price, bm.is_available AS available, bm.availability_note AS availabilityNote FROM branch_menu bm JOIN menu_items i ON i.menu_item_id=bm.menu_item_id JOIN menu_categories c ON c.category_id=i.category_id WHERE bm.branch_id=? AND i.is_active=1 ORDER BY c.display_order, i.item_name`, [req.params.id]);
  res.json(items);
}));
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { fullName, email, password, phone } = req.body;
  const normalized = validEmail(email);
  if (!String(fullName || '').trim() || String(fullName).length > 100 || !normalized || String(password || '').length < 8 || String(password).length > 100 || (phone && String(phone).length > 30)) return res.status(400).json({ error: 'Enter a name, valid email, and password of at least 8 characters.' });
  const hash = await bcrypt.hash(password, 12);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [c] = await conn.execute('INSERT INTO customers (full_name,email,password_hash,phone) VALUES (?,?,?,?)', [String(fullName).trim(), normalized, hash, phone ? String(phone).trim() : null]);
    await conn.execute('INSERT INTO loyalty_cards (customer_id) VALUES (?)', [c.insertId]);
    await conn.commit();
    await setCustomerSession(req,c.insertId);
    res.status(201).json({ customer: { id: c.insertId, fullName: String(fullName).trim(), email: normalized } });
  } catch (e) { await conn.rollback(); if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account already uses that email.' }); throw e; } finally { conn.release(); }
}));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = validEmail(req.body.email);
  const password = String(req.body.password || '');
  if(!email||!password||password.length>100)return res.status(400).json({error:'Enter a valid email and password.'});
  const found = await rows('SELECT customer_id, full_name, email, password_hash FROM customers WHERE email=?', [email]);
  if (!found[0] || !await bcrypt.compare(password, found[0].password_hash)) return res.status(401).json({ error: 'Email or password was not recognized.' });
  await setCustomerSession(req,found[0].customer_id);
  res.json({ customer: { id: found[0].customer_id, fullName: found[0].full_name, email: found[0].email } });
}));
app.post('/api/auth/logout', (req, res) => req.session.destroy(() => { res.clearCookie('nirvana.sid'); res.json({ ok: true }); }));
app.get('/api/auth/me', asyncRoute(async (req, res) => {
  if (!req.session.customerId) return res.json({ customer: null });
  const [customer] = await rows('SELECT customer_id AS id, full_name AS fullName, email FROM customers WHERE customer_id=?', [req.session.customerId]);
  res.json({ customer: customer || null });
}));

app.post('/api/admin/login', asyncRoute(async (req,res)=>{
  const email=validEmail(req.body.email), password=String(req.body.password||'');
  if(!email||!password)return res.status(400).json({error:'Enter the admin email and password.'});
  const admins=await rows('SELECT admin_id AS id,branch_id AS branchId,full_name AS fullName,email,role,password_hash AS passwordHash FROM admin_users WHERE email=? AND is_active=1',[email]);
  if(!admins[0]||!await bcrypt.compare(password,admins[0].passwordHash))return res.status(401).json({error:'Admin email or password was not recognized.'});
  await new Promise((resolve,reject)=>req.session.regenerate(err=>err?reject(err):resolve()));
  req.session.adminId=admins[0].id;
  await new Promise((resolve,reject)=>req.session.save(err=>err?reject(err):resolve()));
  const {passwordHash,...admin}=admins[0];
  res.json({admin});
}));
app.post('/api/admin/logout',adminSignedIn,(req,res)=>req.session.destroy(()=>{res.clearCookie('nirvana.sid');res.json({ok:true});}));
app.get('/api/admin/me',asyncRoute(async(req,res)=>{
  if(!req.session.adminId)return res.json({admin:null});
  const [admin]=await rows('SELECT admin_id AS id,branch_id AS branchId,full_name AS fullName,email,role FROM admin_users WHERE admin_id=? AND is_active=1',[req.session.adminId]);
  res.json({admin:admin||null});
}));
app.get('/api/admin/dashboard',adminSignedIn,asyncRoute(async(req,res)=>{
  const [adminRows]=await rows('SELECT admin_id AS id,branch_id AS branchId,full_name AS fullName,email,role FROM admin_users WHERE admin_id=? AND is_active=1',[req.session.adminId]);
  if(!adminRows)return res.status(401).json({error:'Admin account is inactive.'});
  const admin=adminRows;
  const from=dateOk(req.query.from)?req.query.from:new Date().toISOString().slice(0,10);
  const to=dateOk(req.query.to)?req.query.to:from;
  if(to<from)return res.status(400).json({error:'End date must be on or after start date.'});
  let branchFilter=''; const params=[from,to];
  if(admin.role==='branch_admin'){branchFilter=' AND b.branch_id=?';params.push(admin.branchId);}
  else if(validId(req.query.branchId)){branchFilter=' AND b.branch_id=?';params.push(Number(req.query.branchId));}
  const branches=await rows(`SELECT b.branch_id AS id,b.branch_name AS name,COUNT(DISTINCT s.staff_id) AS staffCount,COUNT(DISTINCT o.order_id) AS orderCount,COUNT(DISTINCT r.reservation_id) AS reservationCount FROM cafe_branches b LEFT JOIN staff_members s ON s.branch_id=b.branch_id AND s.is_active=1 LEFT JOIN customer_orders o ON o.branch_id=b.branch_id AND o.order_date BETWEEN ? AND ? AND o.status<>'cancelled' LEFT JOIN reservations r ON r.branch_id=b.branch_id AND r.reservation_date BETWEEN ? AND ? AND r.status IN ('pending','confirmed') WHERE b.is_active=1${branchFilter} GROUP BY b.branch_id ORDER BY b.branch_id`,[from,to,from,to,...params.slice(2)]);
  const ids=branches.map(b=>b.id); if(!ids.length)return res.json({admin,branches:[],staff:[],awards:[],daily:[],reservations:[],orders:[]});
  const marks=ids.map(()=>'?').join(',');
  const [staff,awards,daily,reservations,orders]=await Promise.all([
    rows(`SELECT s.staff_id AS id,s.branch_id AS branchId,b.branch_name AS branch,s.full_name AS name,s.job_title AS jobTitle,COUNT(o.order_id) AS orderCount,COALESCE(SUM(o.total_amount),0) AS sales FROM staff_members s JOIN cafe_branches b ON b.branch_id=s.branch_id LEFT JOIN customer_orders o ON o.assigned_staff_id=s.staff_id AND o.order_date BETWEEN ? AND ? AND o.status<>'cancelled' WHERE s.is_active=1 AND s.branch_id IN (${marks}) GROUP BY s.staff_id ORDER BY b.branch_id,s.full_name`,[from,to,...ids]),
    rows(`SELECT a.award_id AS id,a.branch_id AS branchId,b.branch_name AS branch,a.month_start AS monthStart,s.full_name AS staff,a.reason,a.is_demo AS isDemo FROM staff_month_awards a JOIN cafe_branches b ON b.branch_id=a.branch_id JOIN staff_members s ON s.staff_id=a.staff_id WHERE a.branch_id IN (${marks}) ORDER BY a.month_start DESC,a.branch_id LIMIT 120`,ids),
    rows(`SELECT b.branch_id AS branchId,b.branch_name AS branch,d.day,COALESCE(o.orders,0) AS orders,COALESCE(r.reservations,0) AS reservations FROM cafe_branches b JOIN (SELECT order_date AS day FROM customer_orders WHERE order_date BETWEEN ? AND ? UNION SELECT reservation_date FROM reservations WHERE reservation_date BETWEEN ? AND ?) d LEFT JOIN (SELECT branch_id,order_date,COUNT(*) AS orders FROM customer_orders WHERE order_date BETWEEN ? AND ? AND status<>'cancelled' GROUP BY branch_id,order_date) o ON o.branch_id=b.branch_id AND o.order_date=d.day LEFT JOIN (SELECT branch_id,reservation_date,COUNT(*) AS reservations FROM reservations WHERE reservation_date BETWEEN ? AND ? AND status IN ('pending','confirmed') GROUP BY branch_id,reservation_date) r ON r.branch_id=b.branch_id AND r.reservation_date=d.day WHERE b.branch_id IN (${marks}) ORDER BY d.day DESC,b.branch_id`,[from,to,from,to,from,to,from,to,...ids]),
    rows(`SELECT r.reservation_id AS id,b.branch_name AS branch,r.reservation_date AS date,r.start_time AS time,r.party_size AS partySize,r.status,r.reservation_code AS code,c.full_name AS customer,GROUP_CONCAT(DISTINCT t.table_code ORDER BY t.table_code SEPARATOR ', ') AS tables FROM reservations r JOIN cafe_branches b ON b.branch_id=r.branch_id JOIN customers c ON c.customer_id=r.customer_id LEFT JOIN reservation_tables rt ON rt.reservation_id=r.reservation_id LEFT JOIN cafe_tables t ON t.table_id=rt.table_id WHERE r.branch_id IN (${marks}) AND r.reservation_date BETWEEN ? AND ? AND r.status IN ('pending','confirmed') GROUP BY r.reservation_id ORDER BY r.reservation_date DESC,r.start_time LIMIT 1000`,[...ids,from,to]),
    rows(`SELECT o.order_id AS id,b.branch_name AS branch,o.order_date AS date,o.order_time AS time,o.order_type AS orderType,o.status,o.total_amount AS total,o.is_demo AS isDemo,s.full_name AS assignedStaff,COALESCE(GROUP_CONCAT(CONCAT(i.item_name,' × ',oi.quantity) ORDER BY i.item_name SEPARATOR ', '),'No items') AS items FROM customer_orders o JOIN cafe_branches b ON b.branch_id=o.branch_id LEFT JOIN staff_members s ON s.staff_id=o.assigned_staff_id LEFT JOIN customer_order_items oi ON oi.order_id=o.order_id LEFT JOIN menu_items i ON i.menu_item_id=oi.menu_item_id WHERE o.branch_id IN (${marks}) AND o.order_date BETWEEN ? AND ? AND o.status<>'cancelled' GROUP BY o.order_id ORDER BY o.order_date DESC,o.order_time DESC LIMIT 1000`,[...ids,from,to])
  ]);
  res.json({admin,branches,staff,awards,daily,reservations,orders});
}));

app.post('/api/preorders',signedIn,asyncRoute(async(req,res)=>{
  const branchId=Number(req.body.branchId),date=req.body.date,time=req.body.time,reservationId=req.body.reservationId===undefined||req.body.reservationId===null?null:Number(req.body.reservationId),items=Array.isArray(req.body.items)?req.body.items:[];
  if(!validId(branchId)||!dateOk(date)||!timeOk(time)||!items.length||items.length>20)return res.status(400).json({error:'Choose a branch, future pickup date and time, and at least one menu item.'});
  if(reservationId!==null&&!validId(reservationId))return res.status(400).json({error:'Choose a valid table reservation.'});
  const now=localDateTime();
  if(date<now.date||(date===now.date&&`${time}:00`<=now.time))return res.status(400).json({error:'Choose a future pre-order pickup time.'});
  const normalized=new Map();
  for(const item of items){const id=Number(item.id),qty=Number(item.quantity);if(!validId(id)||!Number.isInteger(qty)||qty<1||qty>20)return res.status(400).json({error:'Menu quantities must be between 1 and 20.'});normalized.set(id,(normalized.get(id)||0)+qty);}
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [branch]=await conn.execute('SELECT branch_id FROM cafe_branches WHERE branch_id=? AND is_active=1 FOR UPDATE',[branchId]);
    if(!branch.length){await conn.rollback();return res.status(404).json({error:'Branch not found.'});}
    const [customers]=await conn.execute('SELECT is_demo FROM customers WHERE customer_id=? FOR UPDATE',[req.session.customerId]);
    if(!customers.length){await conn.rollback();return res.status(401).json({error:'Please sign in to continue.'});}
    if(reservationId){
      if(!validId(reservationId)){await conn.rollback();return res.status(400).json({error:'Invalid reservation.'});}
      const [reservation]=await conn.execute("SELECT branch_id,reservation_date,start_time,status FROM reservations WHERE reservation_id=? AND customer_id=? FOR UPDATE",[reservationId,req.session.customerId]);
      const booked=reservation[0];
      if(!booked){await conn.rollback();return res.status(404).json({error:'Reservation not found.'});}
      const bookedDate=String(booked.reservation_date).slice(0,10),bookedTime=String(booked.start_time).slice(0,5);
      if(Number(booked.branch_id)!==branchId||bookedDate!==date||bookedTime!==time||booked.status!=='confirmed'){await conn.rollback();return res.status(400).json({error:'Choose the branch, date, and time from your confirmed table reservation.'});}
    }
    const [staff]=await conn.execute(`SELECT s.staff_id,COUNT(o.order_id) AS load_count FROM staff_members s LEFT JOIN customer_orders o ON o.assigned_staff_id=s.staff_id AND o.order_date=? AND o.status<>'cancelled' WHERE s.branch_id=? AND s.is_active=1 GROUP BY s.staff_id ORDER BY load_count,s.staff_id LIMIT 1`,[date,branchId]);
    if(!staff.length){await conn.rollback();return res.status(409).json({error:'This branch has no active staff available for pre-orders.'});}
    const itemIds=[...normalized.keys()],marks=itemIds.map(()=>'?').join(',');
    const [menu]=await conn.execute(`SELECT i.menu_item_id AS id,i.item_name AS name,bm.price FROM branch_menu bm JOIN menu_items i ON i.menu_item_id=bm.menu_item_id WHERE bm.branch_id=? AND bm.is_available=1 AND i.is_active=1 AND i.menu_item_id IN (${marks})`,[branchId,...itemIds]);
    if(menu.length!==itemIds.length){await conn.rollback();return res.status(400).json({error:'One or more selected menu items are unavailable at this branch.'});}
    const priceMap=new Map(menu.map(i=>[i.id,Number(i.price)]));let total=0;for(const [id,qty] of normalized)total+=priceMap.get(id)*qty;
    const pointsEarned=Math.max(1,Math.floor(total/100));
    const [cards]=await conn.execute("SELECT loyalty_card_id FROM loyalty_cards WHERE customer_id=? AND card_status='active' FOR UPDATE",[req.session.customerId]);
    if(!cards.length){await conn.rollback();return res.status(409).json({error:'Your account needs an active loyalty card before placing a pre-order.'});}
    const [order]=await conn.execute(`INSERT INTO customer_orders (customer_id,branch_id,reservation_id,assigned_staff_id,order_type,order_date,order_time,status,total_amount,special_request,is_demo) VALUES (?,?,?,?,'preorder',?,?,'scheduled',?,?,?)`,[req.session.customerId,branchId,reservationId,staff[0].staff_id,date,`${time}:00`,total,String(req.body.specialRequest||'').slice(0,500)||null,customers[0].is_demo]);
    for(const [id,qty] of normalized)await conn.execute('INSERT INTO customer_order_items (order_id,menu_item_id,quantity,unit_price) VALUES (?,?,?,?)',[order.insertId,id,qty,priceMap.get(id)]);
    await conn.execute("INSERT INTO loyalty_transactions (loyalty_card_id,points_change,transaction_type,description,reservation_id) VALUES (?,?,'earned',?,?)",[cards[0].loyalty_card_id,pointsEarned,`Pre-order #${order.insertId} · ₹${total.toFixed(2)}`,reservationId]);
    await conn.execute('UPDATE loyalty_cards SET points_balance=points_balance+? WHERE loyalty_card_id=?',[pointsEarned,cards[0].loyalty_card_id]);
    await conn.commit();
    res.status(201).json({id:order.insertId,status:'scheduled',date,time,total,pointsEarned,items:[...normalized].map(([id,quantity])=>({name:menu.find(m=>m.id===id)?.name||'Menu item',quantity}))});
  }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}));

app.get('/api/availability', asyncRoute(async (req, res) => {
  const { branchId, date, partySize } = req.query;
  const size = Number(partySize);
  if (!validId(branchId) || !dateOk(date) || !Number.isInteger(size) || size < 1 || size > 8) return res.status(400).json({ error: 'Choose a branch, date, and party size from 1 to 8.' });
  const now = localDateTime();
  if (date < now.date) return res.status(400).json({ error: 'Choose today or a future date.' });
  const branch = (await rows('SELECT opening_time, closing_time FROM cafe_branches WHERE branch_id=? AND is_active=1', [branchId]))[0];
  if (!branch) return res.status(404).json({ error: 'Branch not found.' });
  const slots = [];
  const openAt = Number(branch.opening_time.slice(0,2));
  const closeAt = Number(branch.closing_time.slice(0,2));
  for (let h = openAt; h < closeAt; h++) for (const m of [0, 30]) {
    const start = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    if (date === now.date && `${start}:00` <= now.time) continue;
    const endDate = new Date(`2000-01-01T${start}:00Z`); endDate.setUTCMinutes(endDate.getUTCMinutes()+90);
    const end = `${String(endDate.getUTCHours()).padStart(2,'0')}:${String(endDate.getUTCMinutes()).padStart(2,'0')}`;
    if (end > branch.closing_time) continue;
    const available = await rows(`SELECT t.table_id,t.capacity FROM cafe_tables t WHERE t.branch_id=? AND t.is_active=1 AND NOT EXISTS (SELECT 1 FROM reservation_tables rt JOIN reservations r ON r.reservation_id=rt.reservation_id WHERE rt.table_id=t.table_id AND r.status IN ('pending','confirmed') AND r.reservation_date=? AND r.start_time < ? AND r.end_time > ?) ORDER BY t.capacity, t.table_id`, [branchId,date,end,start]);
    if (chooseTables(available,size).length) slots.push(start);
  }
  res.json({ slots, durationMinutes: 90, timezone: 'Asia/Kolkata' });
}));
app.post('/api/reservations', signedIn, asyncRoute(async (req, res) => {
  const { branchId, date, startTime, partySize, specialRequest } = req.body;
  const size = Number(partySize);
  if (!validId(branchId) || !dateOk(date) || !timeOk(startTime) || !Number.isInteger(size) || size < 1 || size > 8 || String(specialRequest || '').length > 500) return res.status(400).json({ error: 'Check branch, date, time, party size (1 to 8), and request length.' });
  const endDate = new Date(`2000-01-01T${startTime}:00Z`); endDate.setUTCMinutes(endDate.getUTCMinutes()+90);
  const endTime = `${String(endDate.getUTCHours()).padStart(2,'0')}:${String(endDate.getUTCMinutes()).padStart(2,'0')}:00`;
  const now = localDateTime();
  if (date < now.date || (date === now.date && `${startTime}:00` <= now.time)) return res.status(400).json({ error: 'Choose a future date and time in branch local time.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Serialize booking attempts for this branch across API processes using MySQL's row lock.
    const [branches] = await conn.execute('SELECT opening_time, closing_time FROM cafe_branches WHERE branch_id=? AND is_active=1 FOR UPDATE', [branchId]);
    if (!branches[0]) { await conn.rollback(); return res.status(404).json({ error: 'Branch not found.' }); }
    const [customers] = await conn.execute('SELECT is_demo FROM customers WHERE customer_id=?', [req.session.customerId]);
    if (!customers[0]) { await conn.rollback(); return res.status(401).json({ error: 'Please sign in to continue.' }); }
    const start = `${startTime}:00`;
    if (!validInterval(start, endTime, branches[0].opening_time, branches[0].closing_time)) { await conn.rollback(); return res.status(400).json({ error: 'That time is outside this branch’s opening hours.' }); }
    const [tables] = await conn.execute(`SELECT t.table_id,t.capacity FROM cafe_tables t WHERE t.branch_id=? AND t.is_active=1 AND NOT EXISTS (SELECT 1 FROM reservation_tables rt JOIN reservations r ON r.reservation_id=rt.reservation_id WHERE rt.table_id=t.table_id AND r.status IN ('pending','confirmed') AND r.reservation_date=? AND r.start_time < ? AND r.end_time > ?) ORDER BY t.capacity,t.table_id FOR UPDATE`, [branchId,date,endTime,start]);
    const picked=chooseTables(tables,size);
    if (!picked.length) { await conn.rollback(); return res.status(409).json({ error: 'No suitable table is available for that time. Try another slot or join the waitlist.' }); }
    const code = `NV-${randomBytes(10).toString('hex').toUpperCase()}`;
    const [booking] = await conn.execute(`INSERT INTO reservations (customer_id,branch_id,reservation_code,reservation_date,start_time,end_time,party_size,status,is_demo,special_request) VALUES (?,?,?,?,?,?,?,'confirmed',?,?)`, [req.session.customerId,branchId,code,date,start,endTime,size,customers[0].is_demo,specialRequest ? String(specialRequest).trim() : null]);
    for (const t of picked) await conn.execute('INSERT INTO reservation_tables (reservation_id,table_id) VALUES (?,?)', [booking.insertId,t.table_id]);
    await conn.commit();
    res.status(201).json({ id: booking.insertId, code, date, startTime, partySize: size, status: 'confirmed' });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));
app.get('/api/account', signedIn, asyncRoute(async (req,res)=>{
  const id=req.session.customerId;
  const [[profile]] = await Promise.all([rows('SELECT customer_id AS id,full_name AS fullName,email,phone,created_at AS createdAt FROM customers WHERE customer_id=?',[id])]);
  const [reservations,waitlist,card,transactions,subscriptions,feedback,preorders] = await Promise.all([
    rows('SELECT r.reservation_id AS id,r.branch_id AS branchId,r.reservation_code AS code,r.reservation_date AS date,r.start_time AS startTime,r.party_size AS partySize,r.status,r.is_demo AS isDemo,b.branch_name AS branch FROM reservations r JOIN cafe_branches b ON b.branch_id=r.branch_id WHERE r.customer_id=? ORDER BY r.reservation_date DESC,r.start_time DESC',[id]),
    rows('SELECT w.waitlist_id AS id,w.requested_date AS date,w.requested_time AS time,w.party_size AS partySize,w.status,b.branch_name AS branch FROM waitlist_entries w JOIN cafe_branches b ON b.branch_id=w.branch_id WHERE w.customer_id=? ORDER BY w.created_at DESC',[id]),
    rows('SELECT loyalty_card_id AS id,points_balance AS points,card_status AS status FROM loyalty_cards WHERE customer_id=?',[id]),
    rows('SELECT t.points_change AS points,t.transaction_type AS type,t.description,t.created_at AS createdAt FROM loyalty_transactions t JOIN loyalty_cards c ON c.loyalty_card_id=t.loyalty_card_id WHERE c.customer_id=? ORDER BY t.created_at DESC',[id]),
    rows('SELECT s.customer_subscription_id AS id,p.plan_name AS plan,s.status,s.started_at AS startedAt,s.ends_at AS endsAt FROM customer_subscriptions s JOIN subscription_plans p ON p.subscription_plan_id=s.subscription_plan_id WHERE s.customer_id=? ORDER BY s.created_at DESC',[id]),
    rows('SELECT f.feedback_id AS id,b.branch_name AS branch,f.rating,f.comments,f.status,f.created_at AS createdAt FROM feedback f JOIN cafe_branches b ON b.branch_id=f.branch_id WHERE f.customer_id=? ORDER BY f.created_at DESC',[id]),
    rows("SELECT o.order_id AS id,o.branch_id AS branchId,b.branch_name AS branch,o.reservation_id AS reservationId,r.reservation_code AS reservationCode,o.order_date AS date,o.order_time AS time,o.status,o.total_amount AS total,o.is_demo AS isDemo,COALESCE(GROUP_CONCAT(CONCAT(i.item_name,' × ',oi.quantity) ORDER BY i.item_name SEPARATOR ', '),'') AS items FROM customer_orders o JOIN cafe_branches b ON b.branch_id=o.branch_id LEFT JOIN reservations r ON r.reservation_id=o.reservation_id LEFT JOIN customer_order_items oi ON oi.order_id=o.order_id LEFT JOIN menu_items i ON i.menu_item_id=oi.menu_item_id WHERE o.customer_id=? AND o.order_type='preorder' GROUP BY o.order_id ORDER BY o.order_date DESC,o.order_time DESC",[id])
  ]);
  res.json({profile,reservations,waitlist,loyalty:card[0]||{points:0},transactions,subscriptions,feedback,preorders});
}));
app.post('/api/reservations/:id/cancel',signedIn,asyncRoute(async(req,res)=>{
  if(!validId(req.params.id))return res.status(400).json({error:'Invalid reservation.'});
  const now=localDateTime();
  const result=await rows("UPDATE reservations SET status='cancelled' WHERE reservation_id=? AND customer_id=? AND status IN ('pending','confirmed') AND (reservation_date>? OR (reservation_date=? AND start_time>?))",[req.params.id,req.session.customerId,now.date,now.date,now.time]);
  if(!result.affectedRows)return res.status(404).json({error:'Reservation not found or no longer eligible to cancel.'});
  res.json({ok:true});
}));
app.get('/api/plans',asyncRoute(async(_req,res)=>res.json(await rows('SELECT subscription_plan_id AS id,plan_name AS name,description,price,billing_interval AS billingInterval,benefits FROM subscription_plans WHERE is_active=1 ORDER BY price'))));
app.post('/api/waitlist',signedIn,asyncRoute(async(req,res)=>{
  const {branchId,date,time,partySize}=req.body; const size=Number(partySize);
  if(!validId(branchId)||!dateOk(date)||!timeOk(time)||!Number.isInteger(size)||size<1||size>20)return res.status(400).json({error:'Check the branch, date, time, and party size.'});
  const now=localDateTime();
  if(date<now.date||(date===now.date&&`${time}:00`<=now.time))return res.status(400).json({error:'Choose a future date and time in branch local time.'});
  const [branch]=await rows('SELECT opening_time,closing_time FROM cafe_branches WHERE branch_id=? AND is_active=1',[branchId]);
  if(!branch)return res.status(404).json({error:'Branch not found.'});
  if(`${time}:00`<branch.opening_time||`${time}:00`>=branch.closing_time)return res.status(400).json({error:'Choose a time during this branch’s opening hours.'});
  const result=await rows("INSERT INTO waitlist_entries (customer_id,branch_id,requested_date,requested_time,party_size,status) VALUES (?,?,?,?,?,'waiting')",[req.session.customerId,branchId,date,time,size]);
  res.status(201).json({id:result.insertId,status:'waiting',message:'You are on the demo waitlist. No wait time is promised.'});
}));
app.get('/api/peak-hour',asyncRoute(async(req,res)=>{
  if(!validId(req.query.branchId)||!dateOk(req.query.date))return res.status(400).json({error:'Choose a branch and date.'});
  const data=await rows("SELECT DATE_FORMAT(start_time,'%H:%i') AS slot,SUM(CASE WHEN is_demo=1 THEN 1 ELSE 0 END) AS demoReservations,SUM(CASE WHEN is_demo=0 THEN 1 ELSE 0 END) AS customerReservations FROM reservations WHERE branch_id=? AND reservation_date=? AND status IN ('pending','confirmed') GROUP BY start_time ORDER BY start_time",[req.query.branchId,req.query.date]);
  res.json({sample:true,data});
}));
app.post('/api/feedback',signedIn,asyncRoute(async(req,res)=>{
  const {branchId,rating,comments}=req.body; const score=rating===''||rating===null?null:Number(rating); const text=String(comments||'').trim();
  if(!validId(branchId)||(score!==null&&(!Number.isInteger(score)||score<1||score>5))||text.length>1000||(!score&&!text))return res.status(400).json({error:'Add comments or a rating from 1 to 5.'});
  await rows("INSERT INTO feedback (customer_id,branch_id,rating,comments,status) VALUES (?,?,?,?,'submitted')",[req.session.customerId,branchId,score,text||null]);
  res.status(201).json({ok:true});
}));
app.post('/api/subscriptions',signedIn,asyncRoute(async(req,res)=>{
  if(!validId(req.body.planId))return res.status(400).json({error:'Choose a valid plan.'});
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    await conn.execute('SELECT customer_id FROM customers WHERE customer_id=? FOR UPDATE',[req.session.customerId]);
    const [existing]=await conn.execute("SELECT customer_subscription_id FROM customer_subscriptions WHERE customer_id=? AND status='active' FOR UPDATE",[req.session.customerId]);
    if(existing.length){await conn.rollback();return res.status(409).json({error:'Cancel your active demo subscription before choosing another.'});}
    const [plans]=await conn.execute('SELECT subscription_plan_id FROM subscription_plans WHERE subscription_plan_id=? AND is_active=1',[req.body.planId]);
    if(!plans.length){await conn.rollback();return res.status(404).json({error:'Plan not found.'});}
    await conn.execute("INSERT INTO customer_subscriptions (customer_id,subscription_plan_id,status,started_at) VALUES (?,?, 'active',CURRENT_TIMESTAMP)",[req.session.customerId,req.body.planId]);
    await conn.commit();
    res.status(201).json({ok:true,message:'Demo subscription activated. No payment was taken.'});
  }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}));
app.post('/api/subscriptions/:id/cancel',signedIn,asyncRoute(async(req,res)=>{
  const result=await rows("UPDATE customer_subscriptions SET status='cancelled',cancelled_at=CURRENT_TIMESTAMP,ends_at=CURRENT_TIMESTAMP WHERE customer_subscription_id=? AND customer_id=? AND status='active'",[req.params.id,req.session.customerId]);
  if(!result.affectedRows)return res.status(404).json({error:'Active subscription not found.'}); res.json({ok:true});
}));

app.use((err,_req,res,_next)=>{ console.error(err.message); res.status(500).json({error:'Something went wrong. Please try again.'}); });
app.listen(port,()=>console.log(`Nirvana Cafe API listening at http://localhost:${port}`));
