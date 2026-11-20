import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const demoEmail = 'demo.guest@nirvana-cafe.invalid';
const demoPassword = 'DemoCafe2026!';
const pad = n => String(n).padStart(2, '0');

function localDate(offset) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  const d = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) + offset));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

try {
  const [hash] = await Promise.all([bcrypt.hash(demoPassword, 12)]);
  const [customerResult] = await pool.execute(
    `INSERT INTO customers (full_name,email,password_hash,phone,is_demo)
     VALUES ('Nirvana Demo Guest',?,?,NULL,TRUE)
     ON DUPLICATE KEY UPDATE full_name=VALUES(full_name),is_demo=TRUE`,
    [demoEmail, hash]
  );
  const [customers] = await pool.execute('SELECT customer_id FROM customers WHERE email=?', [demoEmail]);
  const customerId = customers[0].customer_id;
  await pool.execute('INSERT IGNORE INTO loyalty_cards (customer_id) VALUES (?)', [customerId]);

  const [branches] = await pool.execute(
    `SELECT b.branch_id,b.branch_name,t.table_id,t.capacity
     FROM cafe_branches b JOIN cafe_tables t ON t.branch_id=b.branch_id
     WHERE b.is_active=TRUE AND t.is_active=TRUE ORDER BY b.branch_id,t.capacity,t.table_id`
  );
  const byBranch = new Map();
  for (const row of branches) {
    if (!byBranch.has(row.branch_id)) byBranch.set(row.branch_id, { name: row.branch_name, tables: [] });
    byBranch.get(row.branch_id).tables.push(row);
  }

  let inserted = 0;
  for (let day = 1; day <= 15; day++) {
    const date = localDate(day);
    for (const [branchId, branch] of byBranch) {
      for (const [slot, partySize] of [['12:00:00', 8], ['12:30:00', 6]]) {
        const code = `DEMO-${date.replaceAll('-', '')}-B${branchId}-${slot.replaceAll(':', '').slice(0, 4)}`;
        const [existing] = await pool.execute('SELECT reservation_id FROM reservations WHERE reservation_code=?', [code]);
        if (existing.length) continue;
        const end = new Date(`2000-01-01T${slot}Z`);
        end.setUTCMinutes(end.getUTCMinutes() + 90);
        const endTime = `${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}:00`;
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          let picked = null;
          for (const table of branch.tables.filter(t => t.capacity >= partySize)) {
            const [busy] = await conn.execute(
              `SELECT 1 FROM reservation_tables rt JOIN reservations r ON r.reservation_id=rt.reservation_id
               WHERE rt.table_id=? AND r.reservation_date=? AND r.status IN ('pending','confirmed')
                 AND r.start_time < ? AND r.end_time > ? LIMIT 1 FOR UPDATE`,
              [table.table_id, date, endTime, slot]
            );
            if (!busy.length) { picked = table; break; }
          }
          if (!picked) { await conn.rollback(); continue; }
          const [result] = await conn.execute(
            `INSERT INTO reservations
              (customer_id,branch_id,reservation_code,reservation_date,start_time,end_time,party_size,status,is_demo,special_request)
             VALUES (?,?,?,?,?,?,?,'confirmed',TRUE,'DEMO TEST DATA — not a real booking')`,
            [customerId, branchId, code, date, slot, endTime, partySize]
          );
          await conn.execute('INSERT INTO reservation_tables (reservation_id,table_id) VALUES (?,?)', [result.insertId, picked.table_id]);
          await conn.commit();
          inserted++;
        } catch (error) {
          await conn.rollback();
          throw error;
        } finally { conn.release(); }
      }
    }
  }
  const [[summary]] = await pool.execute(
    `SELECT COUNT(*) AS total,MIN(reservation_date) AS firstDate,MAX(reservation_date) AS lastDate
     FROM reservations WHERE is_demo=TRUE AND customer_id=? AND reservation_date>=?`,
    [customerId, localDate(1)]
  );
  console.log(JSON.stringify({ inserted, ...summary, branches: byBranch.size, demoEmail, demoPassword }, null, 2));
} finally {
  await pool.end();
}
