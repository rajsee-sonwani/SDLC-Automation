# AI UI Generator

Describe a UI in plain text, pick React (Vite) or Next.js, and get a live preview
you can refine with feedback and download as a runnable project.

- **Backend:** FastAPI + Google Gemini (`google-genai` SDK) — parses the requirement
  into structured JSON, then generates/updates project files.
- **Frontend:** React + Vite + Tailwind, with Sandpack for the live preview.
- **Scaffolds:** static `scaffolds/react-vite/` and `scaffolds/nextjs/` templates that
  get copied into a new project on each generation.

## 1. Get a free Gemini API key

Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and create a
key — no card required.

> Note: this project uses `gemini-3.6-flash`. `gemini-2.5-flash` (an older default in
> some docs/tutorials) returned `404 "no longer available to new users"` when this was
> built — if you hit that, check which flash model is current for your account at the
> link above.

## 2. Backend setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt

copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
# then edit .env and paste in your GEMINI_API_KEY
```

Run the backend:

```bash
uvicorn app:app --reload --port 8000
```

## 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). The frontend expects the
backend at `http://localhost:8000` by default — override with a `VITE_API_BASE_URL`
env var if needed.

## 4. Use it

1. Describe the UI you want, pick React or Next.js, click **Generate App**.
2. Review the live preview. Any assumptions the model made, or requests it couldn't
   support, are called out above the preview.
3. Type feedback and click **Submit Feedback** to iterate.
4. Click **Download .zip** to get a runnable copy of the project (scaffold + your
   generated files) — `npm install && npm run dev` inside it to run it standalone.

## Notes

- Generated files only ever live under `backend/storage/projects/{project_id}/` —
  the scaffolds themselves are never modified.
- Generated code is restricted to `react`/`react-dom` (or `next`/`react`/`react-dom`
  for Next.js) — no other npm packages, so exported projects always build.
- There's a `TODO` in `backend/app.py` marking where real auth would need to go
  before this is anything but a local/personal tool — right now a project's only
  protection is an unguessable `project_id`.
