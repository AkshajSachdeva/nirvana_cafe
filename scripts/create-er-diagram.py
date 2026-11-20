from html import escape
from pathlib import Path
import math

OUT = Path(__file__).resolve().parents[1] / 'docs' / 'Nirvana_Cafe_ER_Diagram.svg'
W, H = 4600, 3450
palette = {
    'customer': ('#dff4f4', '#139e9a'), 'booking': ('#ffe5ed', '#e44e7e'),
    'branch': ('#e9f6d5', '#73aa36'), 'menu': ('#fff0d7', '#df922f'),
    'admin': ('#eee6ff', '#9470d8')
}

# (box center x, box center y, theme, field lines)
nodes = {
 'CUSTOMERS': (1750,260,'customer',['PK customer_id','full_name · email (UQ)','password_hash · phone (NULL)','is_demo · created_at']),
 'LOYALTY_CARDS': (460,1550,'customer',['PK loyalty_card_id','FK/UQ customer_id','points_balance · card_status','created_at']),
 'LOYALTY_TRANSACTIONS': (940,2620,'customer',['PK loyalty_transaction_id','FK loyalty_card_id','FK reservation_id (NULL)','points_change · type · description']),
 'SUBSCRIPTION_PLANS': (3720,320,'customer',['PK subscription_plan_id','plan_name (UQ) · price','billing_interval · benefits','is_active']),
 'CUSTOMER_SUBSCRIPTIONS': (3100,680,'customer',['PK customer_subscription_id','FK customer_id · FK plan_id','status · started_at · ends_at (NULL)','cancelled_at (NULL)']),
 'RESERVATIONS': (1570,940,'booking',['PK reservation_id · code (UQ)','FK customer_id · FK branch_id','reservation_date · start_time · end_time','party_size · status · is_demo']),
 'RESERVATION_TABLES': (2700,1810,'booking',['PK/FK reservation_id','PK/FK table_id','assigned_at','Composite primary key']),
 'WAITLIST_ENTRIES': (500,800,'booking',['PK waitlist_id','FK customer_id · FK branch_id','requested_date · requested_time','party_size · status']),
 'FEEDBACK': (480,2070,'booking',['PK feedback_id','FK customer_id · FK branch_id','FK reservation_id (NULL)','rating · comments (NULL) · status']),
 'CAFE_BRANCHES': (2400,1370,'branch',['PK branch_id · branch_name (UQ)','area_name · address · description','opening_time · closing_time','is_active']),
 'CAFE_TABLES': (3510,1690,'branch',['PK table_id · FK branch_id','table_code · capacity · is_active','UQ (branch_id, table_code)']),
 'BRANCH_MENU': (1940,2860,'branch',['PK branch_menu_id · FK branch_id','FK menu_item_id','price · is_available','UQ (branch_id, menu_item_id)']),
 'ADMIN_USERS': (3910,2220,'admin',['PK admin_id · email (UQ)','FK branch_id (NULL for super admin)','full_name · role · is_active']),
 'STAFF_MEMBERS': (3120,2560,'admin',['PK staff_id · FK branch_id','full_name · job_title · email (UQ)','is_active']),
 'STAFF_MONTH_AWARDS': (3960,2960,'admin',['PK award_id · FK branch_id','FK staff_id · month_start','reason · is_demo','UQ (branch_id, month_start)']),
 'MENU_CATEGORIES': (400,2980,'menu',['PK category_id · category_name (UQ)','display_order']),
 'MENU_ITEMS': (1040,3210,'menu',['PK menu_item_id · FK category_id','item_name · description','is_active · UQ (category_id, item_name)']),
 'CUSTOMER_ORDERS': (2550,700,'menu',['PK order_id · FK customer_id (NULL)','FK branch_id · reservation_id (NULL)','FK assigned_staff_id (NULL)','order_date · time · status · total_amount']),
 'CUSTOMER_ORDER_ITEMS': (3710,900,'menu',['PK order_item_id · FK order_id','FK menu_item_id','quantity · unit_price']),
}

# Each entry creates a real connector between the two entity boxes. Labels sit in
# Chen-style diamonds; the endpoint labels show minimum/maximum cardinality.
edges = [
 ('CUSTOMERS','RESERVATIONS','Makes','1','0..N','booking'),
 ('CAFE_BRANCHES','RESERVATIONS','Receives','1','0..N','booking'),
 ('CAFE_BRANCHES','CAFE_TABLES','Has tables','1','0..N','branch'),
 ('RESERVATIONS','RESERVATION_TABLES','Assigned through','1','1..N','booking'),
 ('CAFE_TABLES','RESERVATION_TABLES','Assigned table','1','0..N','branch'),
 ('CUSTOMERS','WAITLIST_ENTRIES','Joins','1','0..N','booking'),
 ('CAFE_BRANCHES','WAITLIST_ENTRIES','Has waitlist','1','0..N','booking'),
 ('CUSTOMERS','FEEDBACK','Writes','1','0..N','booking'),
 ('CAFE_BRANCHES','FEEDBACK','Receives','1','0..N','branch'),
 ('RESERVATIONS','FEEDBACK','About reservation','0..N','0..1','booking'),
 ('CUSTOMERS','LOYALTY_CARDS','Owns card','1','0..1','customer'),
 ('LOYALTY_CARDS','LOYALTY_TRANSACTIONS','Has transactions','1','0..N','customer'),
 ('RESERVATIONS','LOYALTY_TRANSACTIONS','Referenced by','0..N','0..1','customer'),
 ('CUSTOMERS','CUSTOMER_SUBSCRIPTIONS','Subscribes','1','0..N','customer'),
 ('SUBSCRIPTION_PLANS','CUSTOMER_SUBSCRIPTIONS','Selected plan','1','0..N','customer'),
 ('CAFE_BRANCHES','BRANCH_MENU','Lists menu','1','0..N','branch'),
 ('MENU_ITEMS','BRANCH_MENU','Offered as','1','0..N','menu'),
 ('MENU_CATEGORIES','MENU_ITEMS','Contains items','1','0..N','menu'),
 ('CUSTOMERS','CUSTOMER_ORDERS','Places','0..N','0..1','menu'),
 ('CAFE_BRANCHES','CUSTOMER_ORDERS','Receives orders','1','0..N','branch'),
 ('RESERVATIONS','CUSTOMER_ORDERS','Linked to','0..N','0..1','booking'),
 ('STAFF_MEMBERS','CUSTOMER_ORDERS','Assigned to','0..N','0..1','admin'),
 ('CUSTOMER_ORDERS','CUSTOMER_ORDER_ITEMS','Contains','1','0..N','menu'),
 ('MENU_ITEMS','CUSTOMER_ORDER_ITEMS','References','1','0..N','menu'),
 ('CAFE_BRANCHES','ADMIN_USERS','Administers','0..N','0..1','admin'),
 ('CAFE_BRANCHES','STAFF_MEMBERS','Employs','1','0..N','admin'),
 ('CAFE_BRANCHES','STAFF_MONTH_AWARDS','Awards','1','0..N','admin'),
 ('STAFF_MEMBERS','STAFF_MONTH_AWARDS','Recognized','1','0..N','admin'),
]

box_w, box_h = 480, 218
def edge_point(a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]
    scale=min((box_w/2)/max(abs(dx),1),(box_h/2)/max(abs(dy),1))
    return (a[0]+dx*scale,a[1]+dy*scale)

svg=[]
def add(s): svg.append(s)
add(f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs><filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#5b4535" flood-opacity=".12"/></filter></defs>
<rect width="100%" height="100%" fill="#fbfaf7"/>
<text x="{W/2}" y="65" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="#35291f">NIRVANA CAFE</text>
<text x="{W/2}" y="105" text-anchor="middle" font-family="Arial,sans-serif" font-size="23" fill="#685d54">Entity–Relationship Diagram · MySQL Reservation &amp; Cafe Management System</text>
<text x="{W/2}" y="140" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#796f67">PK = Primary Key · FK = Foreign Key · UQ = Unique · NULL = Optional · connector labels show min..max cardinality</text>''')

# Draw every connector first so the lines sit behind the entities and diamonds.
for idx,(src,dst,label,sc,dc,theme) in enumerate(edges):
    a=nodes[src]; b=nodes[dst]; p=edge_point(a,b); q=edge_point(b,a)
    color=palette[theme][1]
    add(f'<path d="M{p[0]:.1f},{p[1]:.1f} L{q[0]:.1f},{q[1]:.1f}" fill="none" stroke="{color}" stroke-width="2.5" stroke-opacity=".75"/>')
    # Place the relationship diamond slightly off the center line, alternating sides
    # to keep nearby labels from colliding.
    mx,my=(p[0]+q[0])/2,(p[1]+q[1])/2
    dx,dy=q[0]-p[0],q[1]-p[1]; length=max(math.hypot(dx,dy),1)
    off=22 if idx%2==0 else -22
    mx += -dy/length*off; my += dx/length*off
    dw=max(100,min(178, len(label)*8+38)); dh=34
    add(f'<path d="M{mx:.1f},{my-dh/2:.1f} L{mx+dw/2:.1f},{my:.1f} L{mx:.1f},{my+dh/2:.1f} L{mx-dw/2:.1f},{my:.1f} Z" fill="{palette[theme][0]}" stroke="{color}" stroke-width="2"/>')
    add(f'<text x="{mx:.1f}" y="{my+5:.1f}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13.5" fill="#342b25">{escape(label)}</text>')
    # Cardinality is printed just outside each entity box along the relationship.
    for point,other,card in [(p,q,sc),(q,p,dc)]:
        vx,vy=other[0]-point[0],other[1]-point[1]; ll=max(math.hypot(vx,vy),1)
        tx=point[0]+vx/ll*20; ty=point[1]+vy/ll*20-5
        add(f'<text x="{tx:.1f}" y="{ty:.1f}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#584e46" stroke="#fbfaf7" stroke-width="4" paint-order="stroke">{escape(card)}</text>')

# Draw table boxes on top of their connections.
for name,(cx,cy,theme,fields) in nodes.items():
    fill,stroke=palette[theme]; x,y=cx-box_w/2,cy-box_h/2
    add(f'<g filter="url(#shadow)"><rect x="{x}" y="{y}" width="{box_w}" height="{box_h}" rx="8" fill="#fff" stroke="{stroke}" stroke-width="2.4"/><path d="M{x+8},{y} h{box_w-16} a8,8 0 0 1 8,8 v38 h-{box_w} v-38 a8,8 0 0 1 8,-8z" fill="{fill}"/></g>')
    add(f'<text x="{cx}" y="{y+28}" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#322923">{escape(name)}</text>')
    for i,line in enumerate(fields):
        add(f'<text x="{x+18}" y="{y+72+i*31}" font-family="Arial,sans-serif" font-size="15.5" fill="#514941">{escape(line)}</text>')

add(f'<text x="60" y="{H-38}" font-family="Arial,sans-serif" font-size="15" fill="#766b62">RESERVATION_TABLES resolves the many-to-many reservation/table assignment. BRANCH_MENU stores branch-specific prices; CUSTOMER_ORDER_ITEMS stores ordered quantities and price snapshots.</text>')
add('</svg>')
OUT.write_text('\n'.join(svg),encoding='utf-8')
print(OUT)
