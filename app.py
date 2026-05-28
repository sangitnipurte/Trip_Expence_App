from flask import Flask, request, jsonify, send_from_directory
import json, os

app = Flask(__name__, static_folder='.')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get("DATABASE_URL")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# ── CORS helper ──────────────────────────────────────────────
def cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    return response

@app.after_request
def after(r): return cors(r)

@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def options(_path=''):
    return cors(jsonify({}))

# ── DATABASE ─────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys = ON')   # required for ON DELETE CASCADE to work
    return conn

def init_db():
    with get_db() as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS trips (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                name     TEXT NOT NULL,
                emoji    TEXT DEFAULT "✈️",
                color    TEXT DEFAULT "linear-gradient(135deg,#1e4d7b,#0d3159)",
                dates    TEXT DEFAULT "",
                active   INTEGER DEFAULT 1,
                created  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS members (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id  INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
                name     TEXT NOT NULL,
                color    TEXT DEFAULT "#e85d26"
            );

            CREATE TABLE IF NOT EXISTS expenses (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
                name       TEXT NOT NULL,
                amount     REAL NOT NULL,
                date       TEXT,
                category   TEXT DEFAULT "other",
                payer      TEXT NOT NULL,
                split_type TEXT DEFAULT "equal",
                notes      TEXT DEFAULT "",
                created    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS expense_splits (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
                member     TEXT NOT NULL,
                amount     REAL NOT NULL
            );
        ''')

# ── SERVE FRONTEND ───────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/styles.css')
def styles():
    return send_from_directory('.', 'styles.css')

@app.route('/app.js')
def app_js():
    return send_from_directory('.', 'app.js')

# ── TRIPS ────────────────────────────────────────────────────
@app.route('/api/trips', methods=['GET'])
def get_trips():
    with get_db() as db:
        trips = db.execute('SELECT * FROM trips ORDER BY created DESC').fetchall()
        result = []
        for t in trips:
            members = db.execute('SELECT * FROM members WHERE trip_id=?', (t['id'],)).fetchall()
            exp_count = db.execute('SELECT COUNT(*) as c FROM expenses WHERE trip_id=?', (t['id'],)).fetchone()['c']
            exp_total = db.execute('SELECT COALESCE(SUM(amount),0) as s FROM expenses WHERE trip_id=?', (t['id'],)).fetchone()['s']
            result.append({
                'id': t['id'],
                'name': t['name'],
                'emoji': t['emoji'],
                'color': t['color'],
                'dates': t['dates'],
                'active': bool(t['active']),
                'members': [{'id': m['id'], 'name': m['name'], 'color': m['color']} for m in members],
                'exp_count': exp_count,
                'exp_total': exp_total
            })
        return jsonify(result)

@app.route('/api/trips', methods=['POST'])
def create_trip():
    data = request.json
    with get_db() as db:
        cur = db.execute(
            'INSERT INTO trips (name, emoji, color, dates, active) VALUES (?,?,?,?,1)',
            (data['name'], data.get('emoji','✈️'), data.get('color','linear-gradient(135deg,#1e4d7b,#0d3159)'), data.get('dates',''))
        )
        trip_id = cur.lastrowid
        for m in data.get('members', []):
            db.execute('INSERT INTO members (trip_id, name, color) VALUES (?,?,?)', (trip_id, m['name'], m['color']))
        db.commit()
        return jsonify({'id': trip_id, 'message': 'Trip created'})

@app.route('/api/trips/<int:trip_id>', methods=['PUT'])
def update_trip(trip_id):
    data = request.json
    with get_db() as db:
        if 'active' in data:
            db.execute('UPDATE trips SET active=? WHERE id=?', (1 if data['active'] else 0, trip_id))
        if 'name' in data:
            db.execute('UPDATE trips SET name=? WHERE id=?', (data['name'], trip_id))
        db.commit()
        return jsonify({'message': 'Updated'})

@app.route('/api/trips/<int:trip_id>', methods=['DELETE'])
def delete_trip(trip_id):
    with get_db() as db:
        # Explicitly delete splits → expenses → members → trip
        # (also covered by ON DELETE CASCADE now that foreign_keys=ON)
        expense_ids = [r['id'] for r in db.execute('SELECT id FROM expenses WHERE trip_id=?', (trip_id,)).fetchall()]
        for eid in expense_ids:
            db.execute('DELETE FROM expense_splits WHERE expense_id=?', (eid,))
        db.execute('DELETE FROM expenses WHERE trip_id=?', (trip_id,))
        db.execute('DELETE FROM members WHERE trip_id=?', (trip_id,))
        db.execute('DELETE FROM trips WHERE id=?', (trip_id,))
        db.commit()
        return jsonify({'message': 'Trip and all related data deleted'})

# ── MEMBERS ──────────────────────────────────────────────────
@app.route('/api/trips/<int:trip_id>/members', methods=['POST'])
def add_member(trip_id):
    data = request.json
    with get_db() as db:
        cur = db.execute('INSERT INTO members (trip_id, name, color) VALUES (?,?,?)',
                         (trip_id, data['name'], data.get('color','#e85d26')))
        db.commit()
        return jsonify({'id': cur.lastrowid, 'message': 'Member added'})

@app.route('/api/members/<int:member_id>', methods=['DELETE'])
def delete_member(member_id):
    with get_db() as db:
        db.execute('DELETE FROM members WHERE id=?', (member_id,))
        db.commit()
        return jsonify({'message': 'Deleted'})

# ── EXPENSES ─────────────────────────────────────────────────
@app.route('/api/trips/<int:trip_id>/expenses', methods=['GET'])
def get_expenses(trip_id):
    with get_db() as db:
        exps = db.execute('SELECT * FROM expenses WHERE trip_id=? ORDER BY created DESC', (trip_id,)).fetchall()
        result = []
        for e in exps:
            splits = db.execute('SELECT member, amount FROM expense_splits WHERE expense_id=?', (e['id'],)).fetchall()
            result.append({
                'id': e['id'],
                'name': e['name'],
                'amount': e['amount'],
                'date': e['date'],
                'category': e['category'],
                'payer': e['payer'],
                'split_type': e['split_type'],
                'notes': e['notes'],
                'splits': {s['member']: s['amount'] for s in splits}
            })
        return jsonify(result)

@app.route('/api/trips/<int:trip_id>/expenses', methods=['POST'])
def add_expense(trip_id):
    data = request.json
    with get_db() as db:
        cur = db.execute(
            'INSERT INTO expenses (trip_id, name, amount, date, category, payer, split_type, notes) VALUES (?,?,?,?,?,?,?,?)',
            (trip_id, data['name'], data['amount'], data.get('date',''), data.get('category','other'),
             data['payer'], data.get('split_type','equal'), data.get('notes',''))
        )
        exp_id = cur.lastrowid
        for member, amount in data.get('splits', {}).items():
            db.execute('INSERT INTO expense_splits (expense_id, member, amount) VALUES (?,?,?)', (exp_id, member, amount))
        db.commit()
        return jsonify({'id': exp_id, 'message': 'Expense added'})

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    with get_db() as db:
        db.execute('DELETE FROM expenses WHERE id=?', (expense_id,))
        db.commit()
        return jsonify({'message': 'Deleted'})

# ── SUMMARY (balances) ───────────────────────────────────────
@app.route('/api/trips/<int:trip_id>/summary', methods=['GET'])
def get_summary(trip_id):
    with get_db() as db:
        members = db.execute('SELECT name FROM members WHERE trip_id=?', (trip_id,)).fetchall()
        balances = {m['name']: 0.0 for m in members}

        exps = db.execute('SELECT id, payer, amount FROM expenses WHERE trip_id=?', (trip_id,)).fetchall()
        for e in exps:
            balances[e['payer']] = balances.get(e['payer'], 0) + e['amount']
            splits = db.execute('SELECT member, amount FROM expense_splits WHERE expense_id=?', (e['id'],)).fetchall()
            for s in splits:
                balances[s['member']] = balances.get(s['member'], 0) - s['amount']

        # Compute settlements
        owes = [(n, -b) for n, b in balances.items() if b < -0.5]
        owed = [(n, b)  for n, b in balances.items() if b >  0.5]
        owes.sort(key=lambda x: -x[1])
        owed.sort(key=lambda x: -x[1])

        settlements = []
        i, j = 0, 0
        while i < len(owes) and j < len(owed):
            amt = min(owes[i][1], owed[j][1])
            settlements.append({'from': owes[i][0], 'to': owed[j][0], 'amount': round(amt, 2)})
            owes[i] = (owes[i][0], owes[i][1] - amt)
            owed[j] = (owed[j][0], owed[j][1] - amt)
            if owes[i][1] < 0.5: i += 1
            if owed[j][1] < 0.5: j += 1

        return jsonify({
            'balances': {k: round(v, 2) for k, v in balances.items()},
            'settlements': settlements
        })

if __name__ == '__main__':
    init_db()
    print('\n✅  Trip Expense backend running at http://localhost:5000\n')
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)