from dotenv import load_dotenv
load_dotenv()  # charge .env automatiquement si présent

from app import app, db
from init_db import seed

with app.app_context():
    db.create_all()
    seed()

print("🚀 PBA CRM démarré → http://localhost:5051")
app.run(host='0.0.0.0', port=5051, debug=False)
