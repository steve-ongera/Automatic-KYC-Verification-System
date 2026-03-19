# VerifyID — Automatic KYC Verification System

A full-stack KYC (Know Your Customer) verification system with:
- **Backend**: Django + DRF + JWT Auth
- **Frontend**: React + Vite + Bootstrap Icons

---

## Project Structure

```
kyc_system/
├── backend/
│   ├── kyc_project/          # Django project config
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── kyc_app/              # Single core application
│   │   ├── models.py         # All data models
│   │   ├── serializers.py    # DRF serializers
│   │   ├── views.py          # ViewSets + API views
│   │   ├── urls.py           # App-level URLs
│   │   ├── admin.py
│   │   └── apps.py
│   ├── manage.py
│   └── requirements.txt
│
└── frontend/
    ├── index.html            # Entry HTML with SEO + Bootstrap Icons
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx            # Router + Auth context
        ├── components/
        │   ├── Layout.jsx
        │   ├── Navbar.jsx
        │   └── Sidebar.jsx
        ├── pages/
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   ├── Dashboard.jsx
        │   ├── Applications.jsx
        │   ├── ApplicationDetail.jsx
        │   ├── KYCForm.jsx
        │   ├── Alerts.jsx
        │   ├── Users.jsx
        │   ├── Logs.jsx
        │   └── Profile.jsx
        ├── services/
        │   └── api.js
        └── styles/
            └── main.css
```

---

## Backend Setup

```bash
cd backend

# 1. Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run migrations
python manage.py makemigrations
python manage.py migrate

# 4. Create superuser
python manage.py createsuperuser

# 5. Run server
python manage.py runserver
```

### API Endpoints (base: /api/v1/)

| Method | URL | Description |
|--------|-----|-------------|
| POST | /auth/register/ | Register new user |
| POST | /auth/login/ | Login & get JWT tokens |
| POST | /auth/logout/ | Blacklist refresh token |
| GET/PATCH | /auth/profile/ | Get/update profile |
| POST | /auth/token/refresh/ | Refresh access token |
| GET | /dashboard/stats/ | Dashboard statistics |
| GET/POST | /kyc-applications/ | List / create KYC apps |
| GET/PATCH | /kyc-applications/{id}/ | Detail / update |
| POST | /kyc-applications/{id}/submit/ | Submit for review |
| POST | /kyc-applications/{id}/upload-documents/ | Upload files |
| POST | /kyc-applications/{id}/run-ocr/ | Trigger OCR |
| POST | /kyc-applications/{id}/run-face-match/ | Trigger face match |
| POST | /kyc-applications/{id}/review/ | Admin review |
| GET | /alerts/ | List alerts |
| POST | /alerts/{id}/resolve/ | Resolve alert |
| GET | /users/ | List users (admin) |
| GET | /logs/ | Audit logs |

---

## Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Run dev server (proxies /api to Django on :8000)
npm run dev

# 3. Build for production
npm run build
```

---

## Integrating Real OCR & Face Recognition

In `kyc_app/views.py`, replace the mock functions:

### OCR (Tesseract)
```python
import pytesseract
from PIL import Image

def process_ocr(image_field, document_side):
    img = Image.open(image_field)
    raw_text = pytesseract.image_to_string(img)
    # Parse extracted fields from raw_text...
```

### Face Recognition
```python
import face_recognition

def perform_face_match(selfie_field, id_doc_field):
    selfie = face_recognition.load_image_file(selfie_field)
    doc = face_recognition.load_image_file(id_doc_field)
    selfie_enc = face_recognition.face_encodings(selfie)
    doc_enc = face_recognition.face_encodings(doc)
    if not selfie_enc or not doc_enc:
        return 0.0, False, 0
    distance = face_recognition.face_distance([doc_enc[0]], selfie_enc[0])[0]
    score = 1 - distance
    return score, score >= 0.75, 0
```

---

## User Roles

| Role | Access |
|------|--------|
| `customer` | Own KYC form, profile, dashboard |
| `compliance_officer` | All applications, alerts, logs |
| `admin` | Everything including user management |

---

## Tech Stack

**Backend**: Python 3.11+, Django 5.0, DRF 3.15, SimpleJWT, Pillow  
**Frontend**: React 18, React Router 6, Vite 5, Axios, Bootstrap Icons  
**Planned**: Tesseract OCR, face_recognition / DeepFace, PostgreSQL (prod)