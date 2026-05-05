from app import db, User, Contact, bcrypt
from datetime import date, timedelta
import random

def seed():
    if User.query.first(): return

    # Admin
    pw = bcrypt.generate_password_hash('Admin2026!').decode()
    db.session.add(User(username='admin', password=pw, role='admin'))
    db.session.commit()

    today = date.today().isoformat()
    def d(n): return (date.today() + timedelta(days=n)).isoformat()

    contacts_data = [
        # ── GRANDS GROUPES / STRATEGIC ──────────────────────────────
        ('Dessange International','Marie Fontaine','DRH France','drh@dessange.com','01 47 23 56 00',
         '💇 Coiffure','Strategic','Les deux',8,12,'OPCO EP',80,'Prospect',d(2)),
        ('Jean-Louis David (Provalliance)','Sophie Bernard','Responsable RH','rh@provalliance.com','01 44 89 30 00',
         '💇 Coiffure','Strategic','Les deux',10,15,'OPCO EP',90,'Prospect',d(1)),
        ('Franck Provost (Provalliance)','Lucie Martin','DRH','lucie.martin@provalliance.com','01 44 89 30 10',
         '💇 Coiffure','Strategic','POEI',6,0,'OPCO EP',75,'Prospect',d(3)),
        ('Saint Algue (Provalliance)','Isabelle Dupont','Recrutement','recrutement@saintalgue.fr','01 44 89 31 00',
         '💇 Coiffure','Strategic','Alternance',0,8,'OPCO EP',70,'Prospect',d(4)),
        ('Yves Rocher','Anne-Claire Petit','DRH France','rh@yvesrocher.fr','02 98 35 55 00',
         '🛍️ Retail Beauté','Strategic','Les deux',5,10,'OPCO Atlas',85,'Prospect',d(2)),
        ('Sephora (LVMH)','Claire Moreau','HR Manager','claire.moreau@sephora.fr','01 40 44 50 00',
         '🛍️ Retail Beauté','Strategic','Alternance',0,20,'OPCO Atlas',90,'Prospect',d(1)),
        ('Marionnaud','Laura Simon','DRH','rh@marionnaud.fr','01 53 30 33 00',
         '🛍️ Retail Beauté','Strategic','Les deux',4,8,'OPCO Atlas',80,'Prospect',d(5)),
        ('Nocibé (Douglas)','Émilie Gauthier','Responsable Formation','formation@nocibe.fr','01 58 44 00 00',
         '🛍️ Retail Beauté','Strategic','POEI',5,0,'OPCO Atlas',75,'Prospect',d(3)),
        ("L'Oréal Paris — CFA",'Patricia Lebrun','Responsable Alternance','alternance@loreal.com','01 47 56 70 00',
         '💊 Cosmétique/Pharma','Strategic','Alternance',0,15,'OPCO Atlas',85,'Prospect',d(2)),
        ('Clarins','Hélène Rousseau','DRH','rh@clarins.com','01 47 23 60 00',
         '💊 Cosmétique/Pharma','Strategic','Les deux',3,6,'OPCO Atlas',70,'Prospect',d(6)),
        ('Sisley Paris','Camille Blanc','HR','hr@sisley.fr','01 42 25 43 50',
         '💊 Cosmétique/Pharma','Strategic','POEI',4,0,'OPCO Atlas',65,'Prospect',d(7)),
        ('Institut Carita','Nathalie Vidal','Directrice','direction@carita.fr','01 42 65 79 00',
         '💅 Esthétique/Soins','Strategic','Les deux',6,8,'OPCO EP',80,'Prospect',d(3)),
        ('Guinot-Mary Cohr','Sylvie Lemaire','DRH','drh@guinot.com','01 47 04 01 41',
         '💅 Esthétique/Soins','Strategic','Les deux',5,7,'OPCO EP',75,'Prospect',d(4)),
        ('Payot','Sandrine Mercier','Formation','formation@payot.fr','01 47 23 43 00',
         '🧖 Spa/Bien-être','Strategic','POEI',4,0,'OPCO EP',65,'Prospect',d(5)),
        ('Nuxe Spa','Aurélie Thomas','RH','rh@nuxe.com','01 55 09 40 40',
         '🧖 Spa/Bien-être','Strategic','Les deux',3,5,'OPCO EP',70,'Prospect',d(2)),
        ('Cinq Mondes','Julie Renard','Directrice Spa','direction@cinqmondes.com','01 42 66 00 60',
         '🧖 Spa/Bien-être','Strategic','Alternance',0,4,'OPCO EP',60,'Prospect',d(8)),
        ("L'Occitane en Provence",'Valérie Collet','DRH','rh@loccitane.com','04 90 71 23 00',
         '🛍️ Retail Beauté','Strategic','Alternance',0,12,'OPCO Atlas',80,'Prospect',d(3)),
        ('Rituals','Charlotte Faure','HR Manager','hr@rituals.com','01 82 52 30 00',
         '🛍️ Retail Beauté','Strategic','POEI',5,0,'OPCO Atlas',70,'Prospect',d(4)),
        ('The Body Shop France','Stéphanie Gros','DRH','drh@thebodyshop.fr','01 46 21 05 05',
         '🛍️ Retail Beauté','Strategic','Les deux',4,6,'OPCO Atlas',65,'Prospect',d(6)),
        ('Kiko Milano France','Aurélie Masse','HR','hr.fr@kiko.com','01 43 16 00 00',
         '🛍️ Retail Beauté','Strategic','POEI',6,0,'OPCO Atlas',72,'Prospect',d(5)),

        # ── QUICK WIN / CHAINES MOYENNES ────────────────────────────
        ('Toni & Guy France','Béatrice Laurent','Manager','info@toniandguy.fr','01 43 12 52 00',
         '💇 Coiffure','Quick Win','Les deux',3,5,'OPCO EP',55,'Prospect',d(5)),
        ('Studio 54 Coiffure (groupe)','Rachel Morin','Gérante','contact@studio54coiffure.fr','01 48 72 10 00',
         '💇 Coiffure','Quick Win','POEI',4,0,'OPCO EP',50,'Prospect',d(7)),
        ('Dessange Franchise IDF (10 salons)','François Petit','Coordinateur','franchise.idf@dessange.fr','01 47 23 56 10',
         '💇 Coiffure','Quick Win','Les deux',5,4,'OPCO EP',58,'Prospect',d(6)),
        ('Beauty Success','Mélanie Colin','DRH','rh@beautysuccess.fr','05 49 88 44 44',
         '🛍️ Retail Beauté','Quick Win','Alternance',0,6,'OPCO Atlas',52,'Prospect',d(4)),
        ('Institut Myriam K','Céline Dupuis','Directrice','info@myriamk.com','01 44 00 04 60',
         '💅 Esthétique/Soins','Quick Win','Les deux',3,4,'OPCO EP',55,'Prospect',d(6)),
        ('Spa Nhood (Centres commerciaux)','Alice Perrin','RH','rh@nhood.eu','01 73 23 00 00',
         '🧖 Spa/Bien-être','Quick Win','POEI',5,0,'OPCO EP',60,'Prospect',d(3)),
        ('So Coiffure (franchise)','Marc Tissier','Gérant','contact@socoiffure.fr','01 39 50 10 10',
         '💇 Coiffure','Quick Win','POEI',4,0,'OPCO EP',48,'Prospect',d(8)),
        ('Espace Beauté Weldom','Hélène Garnier','Manager','beaute@weldom.fr','01 64 84 30 00',
         '🛍️ Retail Beauté','Quick Win','POEI',3,0,'OPCO Atlas',45,'Prospect',d(9)),
        ('Planet Nails (groupe)','Tristan Leroy','Gérant','contact@planetnails.fr','01 42 00 90 90',
         '💅 Esthétique/Soins','Quick Win','POEI',5,0,'OPCO EP',50,'Prospect',d(5)),
        ('Ongle d\'Or (15 salons IDF)','Nadia Ziani','Gérante','contact@ongledorboutique.fr','01 43 55 20 10',
         '💅 Esthétique/Soins','Quick Win','POEI',6,0,'OPCO EP',55,'Prospect',d(4)),
        ('Bleu Libellule (réseau IDF)','Virginie Aubert','RH Réseau','rh@bleulibellule.com','01 53 44 00 00',
         '🛍️ Retail Beauté','Quick Win','Alternance',0,5,'OPCO Atlas',58,'Prospect',d(6)),
        ('Hair Success (franchise)','Gilles Mérand','Manager','contact@hairsuccess.fr','01 60 64 00 00',
         '💇 Coiffure','Quick Win','POEI',4,0,'OPCO EP',50,'Prospect',d(7)),
        ('Top Nails Paris','Thanh Nguyen','Gérant','contact@topnailsparis.fr','01 43 71 00 00',
         '💅 Esthétique/Soins','Quick Win','POEI',4,0,'OPCO EP',48,'Prospect',d(5)),
        ('Maquillage Pro Paris (MUA Studio)','Lucie Renaud','Directrice','lucie@muastudio.fr','01 48 06 40 00',
         '💋 Maquillage pro','Quick Win','Les deux',2,3,'OPCO EP',50,'Prospect',d(7)),
        ('Institut Phytomer Paris','Claire Saunier','Manager','paris@phytomer.com','01 42 60 40 00',
         '💅 Esthétique/Soins','Quick Win','POEI',3,0,'OPCO EP',52,'Prospect',d(8)),
        ('Biocoop Beauté (réseau IDF)','Arnaud Forest','RH','rh@biocoopbeaute.fr','01 43 23 01 00',
         '🛍️ Retail Beauté','Quick Win','POEI',3,0,'OPCO Atlas',45,'Prospect',d(9)),
        ('Colorist (franchise coiffure)','Pauline Guérin','Gérante','contact@colorist.fr','01 41 58 00 00',
         '💇 Coiffure','Quick Win','Alternance',0,4,'OPCO EP',50,'Prospect',d(6)),
        ('Hammam Pacha (groupe)','Yasmine Benali','Directrice','contact@hammampacha.com','01 40 51 33 97',
         '🧖 Spa/Bien-être','Quick Win','POEI',4,0,'OPCO EP',55,'Prospect',d(5)),
        ('Spa By Sothys','Marianne Lesage','Responsable','contact@sothys.com','01 44 07 03 00',
         '🧖 Spa/Bien-être','Quick Win','Les deux',3,4,'OPCO EP',58,'Prospect',d(4)),
        ('Jacques Dessange (ind. IDF)','Roland Gilles','Patron','salon.gilles@dessange.fr','01 46 00 10 00',
         '💇 Coiffure','Quick Win','POEI',3,0,'OPCO EP',48,'Prospect',d(8)),

        # ── LONG TERM / INDÉPENDANTS ─────────────────────────────────
        ('Salon Élégance Vincennes','Christiane Roy','Gérante','elegance.vincennes@gmail.com','01 43 28 45 00',
         '💇 Coiffure','Long Term','POEI',2,0,'OPCO EP',30,'Prospect',d(10)),
        ('Institut Beauté du Marais','Françoise Blanc','Propriétaire','beaute.marais@gmail.com','01 42 74 00 00',
         '💅 Esthétique/Soins','Long Term','POEI',2,0,'OPCO EP',28,'Prospect',d(12)),
        ('Spa Naturel Montreuil','Amina Diallo','Gérante','spa.naturel.montreuil@gmail.com','01 48 57 00 00',
         '🧖 Spa/Bien-être','Long Term','POEI',2,0,'OPCO EP',25,'Prospect',d(14)),
        ('Coiffure & Style Bobigny','Jean-Pierre Ounsa','Gérant','coiffure.bobigny@gmail.com','01 48 30 00 00',
         '💇 Coiffure','Long Term','POEI',2,0,'OPCO EP',22,'Prospect',d(15)),
        ('Beauty Bar Clichy','Samia Abdi','Gérante','beautybar.clichy@gmail.com','01 47 30 00 00',
         '💅 Esthétique/Soins','Long Term','POEI',2,0,'OPCO EP',25,'Prospect',d(11)),
        ('Institut Bien-être Créteil','Nadia Roussel','Propriétaire','bienetre.creteil@gmail.com','01 48 98 00 00',
         '🧖 Spa/Bien-être','Long Term','POEI',2,0,'OPCO EP',20,'Prospect',d(16)),
        ('Nails Art Pantin','Linh Tran','Gérante','nailsart.pantin@gmail.com','01 48 91 00 00',
         '💅 Esthétique/Soins','Long Term','POEI',2,0,'OPCO EP',22,'Prospect',d(13)),
        ('Salon Coiffure Nanterre','Fatima Benali','Gérante','salon.nanterre@gmail.com','01 47 25 00 00',
         '💇 Coiffure','Long Term','POEI',2,0,'OPCO EP',20,'Prospect',d(17)),
        ('Onglerie Prestige Versailles','Thuy Pham','Propriétaire','onglerie.versailles@gmail.com','01 39 50 00 00',
         '💅 Esthétique/Soins','Long Term','POEI',2,0,'OPCO EP',25,'Prospect',d(10)),
        ('Institut Soleil Saint-Denis','Khadija Ouali','Gérante','institut.saint-denis@gmail.com','01 48 22 00 00',
         '💅 Esthétique/Soins','Long Term','POEI',2,0,'OPCO EP',20,'Prospect',d(18)),
        ('Coiffure Tendance Aulnay','Moussa Touré','Gérant','coiffure.aulnay@gmail.com','01 48 68 00 00',
         '💇 Coiffure','Long Term','POEI',2,0,'OPCO EP',18,'Prospect',d(14)),
        ('Lash & Beauty Bar Levallois','Océane Martin','Gérante','lash.levallois@gmail.com','01 47 57 00 00',
         '💅 Esthétique/Soins','Long Term','POEI',2,0,'OPCO EP',22,'Prospect',d(12)),
        ('Salon Coiffure Rosny','Éric Dupont','Gérant','salon.rosny@gmail.com','01 48 55 00 00',
         '💇 Coiffure','Long Term','POEI',2,0,'OPCO EP',18,'Prospect',d(15)),
        ('Spa Aromatique Massy','Isabelle Fouquet','Gérante','spa.massy@gmail.com','01 69 20 00 00',
         '🧖 Spa/Bien-être','Long Term','POEI',2,0,'OPCO EP',20,'Prospect',d(16)),
        ('Institut Beauté Argenteuil','Sarah Koné','Propriétaire','beaute.argenteuil@gmail.com','01 39 80 00 00',
         '💅 Esthétique/Soins','Long Term','POEI',2,0,'OPCO EP',18,'Prospect',d(20)),
        ('Maquillage Mariée Paris 17','Elsa Girard','Maquilleuse','mua.paris17@gmail.com','06 12 34 56 78',
         '💋 Maquillage pro','Long Term','POEI',1,0,'OPCO EP',15,'Prospect',d(18)),
        ('Salon Color Boulogne','Ahmed Setti','Gérant','color.boulogne@gmail.com','01 46 21 00 00',
         '💇 Coiffure','Long Term','POEI',2,0,'OPCO EP',20,'Prospect',d(12)),
        ('Institut Zen Rueil','Marie-Ange Collet','Gérante','zen.rueil@gmail.com','01 47 14 00 00',
         '🧖 Spa/Bien-être','Long Term','POEI',2,0,'OPCO EP',18,'Prospect',d(19)),
        ('Beauty Loft Asnières','Priya Sharma','Gérante','beautyloft.asnieres@gmail.com','01 47 91 00 00',
         '💅 Esthétique/Soins','Long Term','POEI',2,0,'OPCO EP',22,'Prospect',d(11)),
        ('Coiffure Prestige Ivry','Ali Hassan','Gérant','prestige.ivry@gmail.com','01 46 70 00 00',
         '💇 Coiffure','Long Term','POEI',2,0,'OPCO EP',18,'Prospect',d(15)),

        # ── PARTENAIRES ──────────────────────────────────────────────
        ('OPCO EP (Beauté)','Laurent Dupuis','Conseiller Beauté','laurent.dupuis@opco-ep.fr','01 53 27 26 00',
         '🤝 Partenaire','Partner','',0,0,'',60,'Prospect',d(3)),
        ('France Travail — Pôle Emploi IDF','Martine Legrand','Conseillère','martine.legrand@francetravail.fr','3949',
         '🤝 Partenaire','Partner','',0,0,'',55,'Prospect',d(5)),
        ('Mission Locale Paris','Aïssata Camara','Chargée de mission','a.camara@missionlocaleparis.fr','01 53 26 67 00',
         '🤝 Partenaire','Partner','',0,0,'',50,'Prospect',d(7)),
        ('CFA des Métiers de la Beauté IDF','Cécile Renard','Directrice','directeur@cfabeaute-idf.fr','01 44 08 00 00',
         '🤝 Partenaire','Partner','',0,0,'',60,'Prospect',d(4)),
        ("ISIPCA (Institut Sup. Parfumerie)",'Pierre Mercier','Dir. Partenariats','partenariats@isipca.fr','01 39 24 00 00',
         '🤝 Partenaire','Partner','',0,0,'',55,'Prospect',d(8)),
        ('CNAIB (Confédération Nationale)','Fabrice Morel','Délégué','contact@cnaib.fr','01 42 93 29 28',
         '🤝 Partenaire','Partner','',0,0,'',50,'Prospect',d(6)),
        ('Région Île-de-France — Formation','Sophie Dumas','Référente','formation@iledefrance.fr','01 53 85 53 85',
         '🤝 Partenaire','Partner','',0,0,'',55,'Prospect',d(5)),
    ]

    for row in contacts_data:
        (company, name, role, email, phone, sector, segment,
         ftype, nb_postes, nb_alt, opco, score, stage, action_date) = row
        c = Contact(
            company=company, name=name, role=role, email=email, phone=phone,
            sector=sector, segment=segment, stage=stage, score=score,
            formation_type=ftype if ftype else None,
            formation_level=_level(ftype),
            nb_postes=nb_postes, nb_alternants=nb_alt,
            opco=opco if opco else None,
            next_action=_action(ftype, segment),
            next_action_date=action_date,
            action_type='Email',
            alert='🔴 NOUVEAU' if score >= 60 else '',
            created_at=date.today().isoformat(),
        )
        db.session.add(c)

    db.session.commit()
    print(f"✅ {len(contacts_data)} contacts PBA initialisés")

def _level(ftype):
    if ftype == 'POEI': return 'POEI Esthétique'
    if ftype == 'Alternance': return 'CAP / BP / BTS Esthétique'
    if ftype == 'Les deux': return 'POEI + CAP/BP/BTS'
    return ''

def _action(ftype, segment):
    if segment == 'Partner': return 'Prise de contact partenariat'
    if ftype == 'POEI': return 'Envoyer email présentation POEI beauté'
    if ftype == 'Alternance': return 'Envoyer email offre alternance esthétique'
    return 'Envoyer email présentation POEI + Alternance'
