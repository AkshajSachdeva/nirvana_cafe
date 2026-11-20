import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const db=await mysql.createConnection({...{
  host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'nirvana_cafe',multipleStatements:true
}});
try{
  for(const file of ['database/schema.sql','database/seed.sql'])await db.query(await readFile(path.join(root,file),'utf8'));
  const adminHash=await bcrypt.hash('CafeAdmin2026!',10);
  await db.execute(`INSERT INTO admin_users (branch_id,full_name,email,password_hash,role) VALUES (NULL,'Nirvana Super Admin','super.admin@nirvana-cafe.invalid',?,'super_admin') ON DUPLICATE KEY UPDATE full_name=VALUES(full_name),password_hash=VALUES(password_hash),role='super_admin',branch_id=NULL`,[adminHash]);
  const staffByBranch=new Map();
  const staffNames=[['Aarav Mehta','Barista'],['Diya Kapoor','Shift Lead'],['Kabir Rao','Server'],['Mira Sen','Barista'],['Reyansh Das','Host'],['Sana Iyer','Server']];
  const branches=await db.query('SELECT branch_id,branch_name FROM cafe_branches ORDER BY branch_id').then(([rows])=>rows);
  for(const branch of branches){
    const slug=branch.branch_name.toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'');
    await db.execute(`INSERT INTO admin_users (branch_id,full_name,email,password_hash,role) VALUES (?,?,?,?,'branch_admin') ON DUPLICATE KEY UPDATE branch_id=VALUES(branch_id),full_name=VALUES(full_name),password_hash=VALUES(password_hash),role='branch_admin'`,[branch.branch_id,`${branch.branch_name} Branch Admin`,`${slug}.admin@nirvana-cafe.invalid`,adminHash]);
    const staff=[];
    for(const [i,[name,title]] of staffNames.entries()){
      const email=`${slug}.staff${i+1}@nirvana-cafe.invalid`;
      await db.execute('INSERT INTO staff_members (branch_id,full_name,job_title,email) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE branch_id=VALUES(branch_id),full_name=VALUES(full_name),job_title=VALUES(job_title),is_active=TRUE',[branch.branch_id,name,title,email]);
      const [[person]]=await db.execute('SELECT staff_id AS id FROM staff_members WHERE email=?',[email]);staff.push(person.id);
    }
    staffByBranch.set(branch.branch_id,staff);
    for(let monthOffset=-5;monthOffset<=1;monthOffset++){
      const todayText=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const d=new Date(`${todayText.slice(0,7)}-01T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()+monthOffset);const month=d.toISOString().slice(0,10);
      const winner=staff[((branch.branch_id+monthOffset+600)%staff.length)];
      await db.execute('INSERT INTO staff_month_awards (branch_id,staff_id,month_start,reason,is_demo) VALUES (?,?,?, ?,TRUE) ON DUPLICATE KEY UPDATE staff_id=VALUES(staff_id),reason=VALUES(reason),is_demo=TRUE',[branch.branch_id,winner,month,'Recognized for excellent service, teamwork, and consistent guest care.']);
    }
  }
  const dailyMenu=new Map();
  for(const branch of branches)dailyMenu.set(branch.branch_id,await db.execute('SELECT i.menu_item_id AS id,bm.price FROM branch_menu bm JOIN menu_items i ON i.menu_item_id=bm.menu_item_id WHERE bm.branch_id=? AND bm.is_available=1 ORDER BY i.menu_item_id',[branch.branch_id]).then(([rows])=>rows));
  const todayText=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const today=new Date(`${todayText}T00:00:00Z`);
  for(let offset=-7;offset<=14;offset++){
    const date=new Date(today);date.setUTCDate(date.getUTCDate()+offset);const dateText=date.toISOString().slice(0,10);
    for(const branch of branches){
      const staff=staffByBranch.get(branch.branch_id),items=dailyMenu.get(branch.branch_id);
      if(!items.length)continue;
      for(let n=0;n<8;n++){
        const staffId=staff[(n+Math.abs(offset))%staff.length],item=items[(n*3+Math.abs(offset))%items.length];
        const time=`${String(9+Math.floor(n/2)).padStart(2,'0')}:${n%2?'30':'00'}:00`,qty=1+(n%3),code=`SAMPLE-${branch.branch_id}-${dateText.replaceAll('-','')}-${n+1}`,status=dateText<todayText?'served':'scheduled';
        await db.execute(`INSERT INTO customer_orders (branch_id,assigned_staff_id,order_type,order_date,order_time,status,sample_code,total_amount,is_demo) VALUES (?,?, 'sample',?,?,?,?,?,TRUE) ON DUPLICATE KEY UPDATE assigned_staff_id=VALUES(assigned_staff_id),status=VALUES(status),total_amount=VALUES(total_amount)`,[branch.branch_id,staffId,dateText,time,status,code,Number(item.price)*qty]);
        const [[order]]=await db.execute('SELECT order_id AS id FROM customer_orders WHERE sample_code=?',[code]);
        await db.execute('INSERT INTO customer_order_items (order_id,menu_item_id,quantity,unit_price) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM customer_order_items WHERE order_id=?)',[order.id,item.id,qty,item.price,order.id]);
      }
    }
  }
  console.log(`Admin demo data ready. ${branches.length} branches, ${branches.length*6} staff, monthly awards, and daily sample orders loaded.`);
  console.log('Super admin: super.admin@nirvana-cafe.invalid / CafeAdmin2026!');
  console.log('Branch admins use <branch-slug>.admin@nirvana-cafe.invalid / CafeAdmin2026! (for example vasant.vihar.admin@nirvana-cafe.invalid).');
}finally{await db.end();}
