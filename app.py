from flask import Flask, request, jsonify, render_template, session, redirect, url_for, Response
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_mail import Mail, Message
from datetime import datetime, date, timedelta
import os, json, csv, io

app = Flask(__name__)

# ─── CONFIG (variables d'environnement) ──────────────────────────────────────
app.secret_key = os.environ.get('SECRET_KEY', 'pba-dev-key-change-in-production')

# PostgreSQL en production (Railway/Render), SQLite en local
_db_url = os.environ.get('DATABASE_URL', 'sqlite:///pba.db')
# Railway donne des URLs postgres:// — SQLAlchemy veut postgresql://
if _db_url.startswith('postgres://'):
    _db_url = _db_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = _db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('FLASK_ENV') == 'production'

# ─── EMAIL CONFIG ─────────────────────────────────────────────────────────────
app.config['MAIL_SERVER']   = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT']     = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS']  = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', os.environ.get('MAIL_USERNAME', ''))

db   = SQLAlchemy(app)
bcrypt = Bcrypt(app)
mail   = Mail(app)

# ─── MODELS ──────────────────────────────────────────────────────────────────

class User(db.Model):
    id       = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role     = db.Column(db.String(20), default='user')

class Contact(db.Model):
    id               = db.Column(db.Integer, primary_key=True)
    company          = db.Column(db.String(200))
    name             = db.Column(db.String(200))
    role             = db.Column(db.String(200))
    email            = db.Column(db.String(200))
    phone            = db.Column(db.String(50))
    sector           = db.Column(db.String(100))
    segment          = db.Column(db.String(50), default='Long Term')
    stage            = db.Column(db.String(50), default='Prospect')
    score            = db.Column(db.Integer, default=0)
    priority         = db.Column(db.String(20), default='Medium')
    formation_type   = db.Column(db.String(50))
    formation_level  = db.Column(db.String(100))
    nb_postes        = db.Column(db.Integer, default=0)
    nb_alternants    = db.Column(db.Integer, default=0)
    opco             = db.Column(db.String(100))
    next_action      = db.Column(db.String(500))
    next_action_date = db.Column(db.String(20))
    action_type      = db.Column(db.String(50))
    notes            = db.Column(db.Text)
    created_at       = db.Column(db.String(20), default=lambda: date.today().isoformat())
    last_activity_at = db.Column(db.String(20))
    stage_changed_at = db.Column(db.String(20))
    alert            = db.Column(db.String(50))
    logs             = db.relationship('ContactLog', backref='contact', lazy=True, cascade='all,delete')

class ContactLog(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    contact_id   = db.Column(db.Integer, db.ForeignKey('contact.id'), nullable=False)
    action       = db.Column(db.String(50))
    note         = db.Column(db.Text)
    done         = db.Column(db.Boolean, default=False)
    date         = db.Column(db.String(20), default=lambda: date.today().isoformat())
    subject      = db.Column(db.String(300))
    relance_date = db.Column(db.String(20))
    status       = db.Column(db.String(30), default='sent')

class Setting(db.Model):
    """Stocke les objectifs et réglages — remplace goals.json (compatible déploiement cloud)"""
    id    = db.Column(db.Integer, primary_key=True)
    key   = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.String(500))

# ─── HELPERS ─────────────────────────────────────────────────────────────────

PROB = {'Prospect':.05,'Contacted':.15,'Meeting':.35,'Proposal':.60,'Negotiation':.80,'Signed':1.0}
SCORE_BOOST = {'Email':5,'Appel':8,'RDV':20,'LinkedIn':3,'Convention':15}
DEFAULT_GOALS = {
    'poei_target':40,'poei_signed':0,'alt_target':60,'alt_signed':0,
    'ca_target':200000,'ca_signed':0,
    'weekly_emails':15,'weekly_calls':10,'weekly_rdv':3,'weekly_relances':5
}

def load_goals():
    result = DEFAULT_GOALS.copy()
    for s in Setting.query.all():
        if s.key in result:
            try: result[s.key] = int(s.value)
            except: result[s.key] = s.value
    return result

def save_goals(d):
    for k, v in d.items():
        s = Setting.query.filter_by(key=k).first()
        if s: s.value = str(v)
        else: db.session.add(Setting(key=k, value=str(v)))
    db.session.commit()

def require_auth():
    if 'user_id' not in session:
        return jsonify({'error':'Non authentifié'}), 401

def c_to_dict(c):
    return {
        'id':c.id,'company':c.company,'name':c.name,'role':c.role,
        'email':c.email,'phone':c.phone,'sector':c.sector,
        'segment':c.segment,'stage':c.stage,'score':c.score,
        'priority':c.priority,'formation_type':c.formation_type,
        'formation_level':c.formation_level,'nb_postes':c.nb_postes,
        'nb_alternants':c.nb_alternants,'opco':c.opco,
        'next_action':c.next_action,'next_action_date':c.next_action_date,
        'action_type':c.action_type,'notes':c.notes,
        'created_at':c.created_at,'last_activity_at':c.last_activity_at,
        'stage_changed_at':c.stage_changed_at,'alert':c.alert,
    }

# ─── AUTH ────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    if 'user_id' not in session: return redirect(url_for('login'))
    return render_template('index.html')

@app.route('/login')
def login():
    if 'user_id' in session: return redirect('/')
    return render_template('login.html')

@app.route('/auth/login', methods=['POST'])
def auth_login():
    d = request.json or {}
    u = User.query.filter_by(username=d.get('username','')).first()
    if u and bcrypt.check_password_hash(u.password, d.get('password','')):
        session['user_id'] = u.id
        session['username'] = u.username
        session['role'] = u.role
        return jsonify({'ok':True,'user':{'id':u.id,'username':u.username,'role':u.role}})
    return jsonify({'error':'Identifiants incorrects'}), 401

@app.route('/auth/logout', methods=['POST'])
def auth_logout():
    session.clear()
    return jsonify({'ok':True})

@app.route('/auth/me')
def auth_me():
    if 'user_id' not in session: return jsonify({'error':'Non authentifié'}), 401
    return jsonify({'id':session['user_id'],'username':session['username'],'role':session['role']})

@app.route('/auth/users')
def auth_users():
    if require_auth(): return require_auth()
    return jsonify([{'id':u.id,'username':u.username,'role':u.role} for u in User.query.all()])

@app.route('/auth/users', methods=['POST'])
def auth_create_user():
    if require_auth(): return require_auth()
    if session.get('role') != 'admin':
        return jsonify({'error':'Réservé aux admins'}), 403
    d = request.json or {}
    if User.query.filter_by(username=d.get('username','')).first():
        return jsonify({'error':'Utilisateur existant'}), 400
    pw = bcrypt.generate_password_hash(d.get('password','pass123')).decode()
    u = User(username=d['username'], password=pw, role=d.get('role','user'))
    db.session.add(u); db.session.commit()
    return jsonify({'ok':True,'id':u.id})

@app.route('/auth/users/<int:uid>', methods=['DELETE'])
def auth_delete_user(uid):
    if require_auth(): return require_auth()
    if session.get('role') != 'admin':
        return jsonify({'error':'Réservé aux admins'}), 403
    u = User.query.get_or_404(uid)
    db.session.delete(u); db.session.commit()
    return jsonify({'ok':True})

@app.route('/auth/change-password', methods=['POST'])
def auth_change_password():
    if require_auth(): return require_auth()
    d = request.json or {}
    u = User.query.get(session['user_id'])
    if not bcrypt.check_password_hash(u.password, d.get('current','')):
        return jsonify({'error':'Mot de passe actuel incorrect'}), 400
    u.password = bcrypt.generate_password_hash(d.get('new','')).decode()
    db.session.commit()
    return jsonify({'ok':True})

# ─── CONTACTS ────────────────────────────────────────────────────────────────

@app.route('/api/contacts')
def api_contacts():
    if require_auth(): return require_auth()
    return jsonify([c_to_dict(c) for c in Contact.query.order_by(Contact.score.desc()).all()])

@app.route('/api/contacts', methods=['POST'])
def api_create_contact():
    if require_auth(): return require_auth()
    d = request.json or {}
    c = Contact(
        company=d.get('company',''),name=d.get('name',''),role=d.get('role',''),
        email=d.get('email',''),phone=d.get('phone',''),sector=d.get('sector',''),
        segment=d.get('segment','Long Term'),stage=d.get('stage','Prospect'),
        score=d.get('score',0),priority=d.get('priority','Medium'),
        formation_type=d.get('formation_type',''),formation_level=d.get('formation_level',''),
        nb_postes=d.get('nb_postes',0),nb_alternants=d.get('nb_alternants',0),
        opco=d.get('opco',''),next_action=d.get('next_action',''),
        next_action_date=d.get('next_action_date',''),action_type=d.get('action_type',''),
        notes=d.get('notes',''),created_at=date.today().isoformat()
    )
    db.session.add(c); db.session.commit()
    return jsonify(c_to_dict(c))

@app.route('/api/contacts/<int:cid>', methods=['GET'])
def api_get_contact(cid):
    if require_auth(): return require_auth()
    c = Contact.query.get_or_404(cid)
    d = c_to_dict(c)
    d['logs'] = [{'id':l.id,'action':l.action,'note':l.note,'done':l.done,
                  'date':l.date,'subject':l.subject,'relance_date':l.relance_date,
                  'status':l.status} for l in c.logs]
    return jsonify(d)

@app.route('/api/contacts/<int:cid>', methods=['PATCH'])
def api_patch_contact(cid):
    if require_auth(): return require_auth()
    c = Contact.query.get_or_404(cid)
    d = request.json or {}
    old_stage = c.stage
    for k, v in d.items():
        if hasattr(c, k): setattr(c, k, v)
    if 'stage' in d and d['stage'] != old_stage:
        c.stage_changed_at = date.today().isoformat()
    c.last_activity_at = date.today().isoformat()
    db.session.commit()
    return jsonify(c_to_dict(c))

@app.route('/api/contacts/<int:cid>', methods=['DELETE'])
def api_delete_contact(cid):
    if require_auth(): return require_auth()
    c = Contact.query.get_or_404(cid)
    db.session.delete(c); db.session.commit()
    return jsonify({'ok':True})

@app.route('/api/contacts/<int:cid>/log', methods=['POST'])
def api_add_log(cid):
    if require_auth(): return require_auth()
    c = Contact.query.get_or_404(cid)
    d = request.json or {}
    log = ContactLog(
        contact_id=cid,action=d.get('action',''),note=d.get('note',''),
        done=d.get('done',False),date=d.get('date',date.today().isoformat()),
        subject=d.get('subject',''),relance_date=d.get('relance_date',''),
        status=d.get('status','sent')
    )
    db.session.add(log)
    c.last_activity_at = date.today().isoformat()
    db.session.commit()
    return jsonify({'ok':True,'id':log.id})

@app.route('/api/contacts/<int:cid>/done', methods=['POST'])
def api_mark_done(cid):
    if require_auth(): return require_auth()
    c = Contact.query.get_or_404(cid)
    d = request.json or {}
    action_type = d.get('action_type', c.action_type or 'Email')
    boost = SCORE_BOOST.get(action_type, 5)
    c.score = (c.score or 0) + boost
    if c.stage == 'Prospect':
        c.stage = 'Contacted'
        c.stage_changed_at = date.today().isoformat()
    c.last_activity_at = date.today().isoformat()
    db.session.commit()
    return jsonify(c_to_dict(c))

@app.route('/api/contacts/export')
def api_export():
    if require_auth(): return require_auth()
    contacts = Contact.query.order_by(Contact.score.desc()).all()
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(['Entreprise','Nom','Rôle','Email','Téléphone','Secteur','Segment','Stage',
                'Score','Formation','Niveau','Nb Postes POEI','Nb Alternants','OPCO','Notes'])
    for c in contacts:
        w.writerow([c.company,c.name,c.role,c.email,c.phone,c.sector,c.segment,c.stage,
                    c.score,c.formation_type,c.formation_level,c.nb_postes,c.nb_alternants,
                    c.opco,c.notes])
    return Response(out.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition':'attachment;filename=pba_contacts.csv'})

@app.route('/api/contacts/bulk-date', methods=['POST'])
def api_bulk_date():
    if require_auth(): return require_auth()
    d = request.json or {}
    new_date = d.get('date', date.today().isoformat())
    segment = d.get('segment')
    q = Contact.query
    if segment: q = q.filter_by(segment=segment)
    for c in q.all(): c.next_action_date = new_date
    db.session.commit()
    return jsonify([c_to_dict(c) for c in Contact.query.order_by(Contact.score.desc()).all()])

# ─── EMAIL ENVOYER ────────────────────────────────────────────────────────────

@app.route('/api/email/send', methods=['POST'])
def api_send_email():
    if require_auth(): return require_auth()
    if not app.config.get('MAIL_USERNAME'):
        return jsonify({'error': 'Email non configuré — ajoutez MAIL_USERNAME et MAIL_PASSWORD dans les variables d\'environnement'}), 400
    d = request.json or {}
    to_addr   = d.get('to', '')
    subject   = d.get('subject', '')
    body      = d.get('body', '')
    contact_id= d.get('contact_id')
    if not to_addr or not subject:
        return jsonify({'error': 'Destinataire et sujet obligatoires'}), 400
    try:
        msg = Message(subject=subject, recipients=[to_addr], body=body)
        mail.send(msg)
        # Enregistre l'envoi dans l'historique du contact
        if contact_id:
            relance_date = (date.today() + timedelta(days=7)).isoformat()
            log = ContactLog(
                contact_id=contact_id, action='Email', note=body[:500],
                done=True, date=date.today().isoformat(),
                subject=subject, relance_date=relance_date, status='sent'
            )
            db.session.add(log)
            c = Contact.query.get(contact_id)
            if c: c.last_activity_at = date.today().isoformat()
            db.session.commit()
        return jsonify({'ok': True, 'message': f'Email envoyé à {to_addr}'})
    except Exception as e:
        return jsonify({'error': f'Erreur envoi: {str(e)}'}), 500

# ─── EMAIL SUIVI ─────────────────────────────────────────────────────────────

@app.route('/api/emails/suivi')
def api_emails_suivi():
    if require_auth(): return require_auth()
    today_str = date.today().isoformat()
    logs = ContactLog.query.filter(ContactLog.subject != None, ContactLog.subject != '').all()
    result = []
    for l in logs:
        c = l.contact
        status = l.status or 'sent'
        if status not in ('replied','ignored') and l.relance_date:
            if l.relance_date < today_str: status = 'overdue'
            elif l.relance_date == today_str: status = 'today'
        result.append({'id':l.id,'contact_id':l.contact_id,
                       'company':c.company if c else '','name':c.name if c else '',
                       'sector':c.sector if c else '','subject':l.subject,
                       'date':l.date,'relance_date':l.relance_date,'status':status,'note':l.note})
    return jsonify(result)

@app.route('/api/emails/log/<int:lid>', methods=['PATCH'])
def api_patch_log(lid):
    if require_auth(): return require_auth()
    log = ContactLog.query.get_or_404(lid)
    d = request.json or {}
    for k, v in d.items():
        if hasattr(log, k): setattr(log, k, v)
    db.session.commit()
    return jsonify({'ok':True})

# ─── MISSION CONTROL ─────────────────────────────────────────────────────────

@app.route('/api/mission')
def api_mission():
    if require_auth(): return require_auth()
    today_str = date.today().isoformat()
    contacts = Contact.query.order_by(Contact.score.desc()).all()
    goals = load_goals()
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    week_logs = ContactLog.query.filter(ContactLog.date >= week_start).all()
    emails   = sum(1 for l in week_logs if l.action == 'Email')
    appels   = sum(1 for l in week_logs if l.action == 'Appel')
    rdv      = sum(1 for l in week_logs if l.action == 'RDV')
    relances = sum(1 for l in week_logs if l.action in ('Relance','LinkedIn'))
    overdue  = [c for c in contacts if c.next_action_date and c.next_action_date < today_str]
    today_c  = [c for c in contacts if c.next_action_date == today_str]
    priority_actions = sorted(overdue + today_c, key=lambda c: -(c.score or 0))[:12]
    cutoff = (date.today() - timedelta(days=21)).isoformat()
    stuck = [c for c in contacts
             if c.stage not in ('Signed',) and (not c.last_activity_at or c.last_activity_at < cutoff)][:10]
    poei_pipeline = sum((c.nb_postes or 0)*3000*PROB.get(c.stage,.05)
                        for c in contacts if c.formation_type in ('POEI','Les deux'))
    alt_pipeline  = sum((c.nb_alternants or 0)*7000*PROB.get(c.stage,.05)
                        for c in contacts if c.formation_type in ('Alternance','Les deux'))
    return jsonify({
        'cadence': {
            'emails':   {'done':emails,  'target':goals.get('weekly_emails',15)},
            'appels':   {'done':appels,  'target':goals.get('weekly_calls',10)},
            'rdv':      {'done':rdv,     'target':goals.get('weekly_rdv',3)},
            'relances': {'done':relances,'target':goals.get('weekly_relances',5)},
        },
        'priority_actions': [c_to_dict(c) for c in priority_actions],
        'stuck': [c_to_dict(c) for c in stuck],
        'poei_pipeline': round(poei_pipeline),
        'alt_pipeline':  round(alt_pipeline),
        'total_contacts': len(contacts),
        'stage_counts': {s: sum(1 for c in contacts if c.stage==s) for s in PROB},
    })

@app.route('/api/mission/target', methods=['POST'])
def api_mission_target():
    if require_auth(): return require_auth()
    d = request.json or {}
    goals = load_goals()
    for k in ('weekly_emails','weekly_calls','weekly_rdv','weekly_relances'):
        if k in d: goals[k] = int(d[k])
    save_goals(goals)
    return jsonify({'ok':True})

# ─── GOALS ───────────────────────────────────────────────────────────────────

@app.route('/api/goals')
def api_goals():
    if require_auth(): return require_auth()
    return jsonify(load_goals())

@app.route('/api/goals', methods=['POST'])
def api_save_goals():
    if require_auth(): return require_auth()
    d = request.json or {}
    goals = load_goals()
    goals.update({k: v for k, v in d.items() if k in DEFAULT_GOALS})
    save_goals(goals)
    return jsonify({'ok':True,'goals':goals})

# ─── KANBAN ──────────────────────────────────────────────────────────────────

@app.route('/api/kanban')
def api_kanban():
    if require_auth(): return require_auth()
    contacts = Contact.query.order_by(Contact.score.desc()).all()
    result = {s: [] for s in PROB}
    for c in contacts:
        s = c.stage if c.stage in result else 'Prospect'
        result[s].append(c_to_dict(c))
    return jsonify(result)

# ─── STRATEGIC ───────────────────────────────────────────────────────────────

@app.route('/api/strategic')
def api_strategic():
    if require_auth(): return require_auth()
    contacts = Contact.query.order_by(Contact.score.desc()).all()
    sectors = {}
    for c in contacts:
        s = c.sector or 'Autre'
        if s not in sectors: sectors[s] = []
        sectors[s].append(c_to_dict(c))
    templates = [
        {'id':1,'name':'Email POEI Intro','sector':'Beauté','subject':'Formation POEI Esthétique — {entreprise}',
         'body':'Madame, Monsieur,\n\nNous sommes PBA, organisme de formation du groupe DEFIS spécialisé dans les métiers de la beauté et de l\'esthétique en Île-de-France.\n\nNous proposons des formations POEI 100% financées par France Travail pour former des candidats aux métiers de l\'esthétique selon vos besoins.\n\nSerait-il possible d\'échanger 20 minutes sur vos besoins en recrutement ?\n\nCordialement,\n[Prénom NOM]\nPBA — Groupe DEFIS'},
        {'id':2,'name':'Email Alternance Intro','sector':'Beauté','subject':'Recrutement alternants beauté 2024-2025 — {entreprise}',
         'body':'Madame, Monsieur,\n\nPBA propose des contrats d\'alternance (CAP, BP, BTS Esthétique) clé en main.\n\nNous gérons le recrutement, le suivi pédagogique et les démarches OPCO.\n\nPuis-je vous présenter notre offre en 15 minutes cette semaine ?\n\nCordialement,\n[Prénom NOM]\nPBA — Groupe DEFIS'},
        {'id':3,'name':'Relance J+7','sector':'Tous','subject':'Relance — Formation beauté {entreprise}',
         'body':'Madame, Monsieur,\n\nJe relance suite à mon email concernant nos formations beauté.\n\nAvez-vous des recrutements prévus ? Nous pourrions vous accompagner avec une solution POEI ou alternance adaptée.\n\nCordialement,\n[Prénom NOM]'},
    ]
    scripts = [
        {'id':1,'name':'Appel POEI Décisionnaire','steps':[
            'Demander DRH ou responsable recrutement',
            'Se présenter : PBA, groupe DEFIS, spécialiste beauté',
            'Question ouverte : recrutements esthétique prévus ?',
            'Pitcher POEI : formation gratuite, candidats pré-sélectionnés',
            'Proposer RDV de 20 minutes',
        ]},
        {'id':2,'name':'Appel Alternance','steps':[
            'Se présenter : PBA, formations CAP/BP/BTS esthétique',
            'Question : prenez-vous des alternants ?',
            'Avantages : candidats qualifiés, suivi pédagogique, gestion OPCO',
            'Proposer une présentation école',
        ]},
    ]
    return jsonify({'sectors':[{'name':s,'contacts':cs} for s,cs in sectors.items()],
                    'templates':templates,'scripts':scripts,'plan':[],'kpis':{'targets':[]}})

@app.route('/api/metrics')
def api_metrics():
    if require_auth(): return require_auth()
    contacts = Contact.query.all()
    goals = load_goals()
    total = len(contacts)
    by_stage = {s: sum(1 for c in contacts if c.stage==s) for s in PROB}
    poei_contacts = [c for c in contacts if c.formation_type in ('POEI','Les deux')]
    alt_contacts  = [c for c in contacts if c.formation_type in ('Alternance','Les deux')]
    poei_pipeline = sum((c.nb_postes or 0)*3000*PROB.get(c.stage,.05) for c in poei_contacts)
    alt_pipeline  = sum((c.nb_alternants or 0)*7000*PROB.get(c.stage,.05) for c in alt_contacts)
    return jsonify({
        'total':total,'by_stage':by_stage,'goals':goals,
        'poei_pipeline':round(poei_pipeline),'alt_pipeline':round(alt_pipeline),
        'total_pipeline':round(poei_pipeline+alt_pipeline),
        'by_sector':{s: sum(1 for c in contacts if c.sector==s)
                     for s in set(c.sector for c in contacts if c.sector)},
        'by_segment':{s: sum(1 for c in contacts if c.segment==s)
                      for s in ('Strategic','Quick Win','Long Term','Dormant','Partner')},
    })

# ─── HEALTH CHECK (Railway / Render) ─────────────────────────────────────────
@app.route('/health')
def health():
    return jsonify({'status':'ok','app':'PBA CRM','version':'2.0'})

if __name__ == '__main__':
    app.run(port=5051, debug=os.environ.get('FLASK_ENV') != 'production')
