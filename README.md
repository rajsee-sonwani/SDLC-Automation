# AI UI Generator

Describe a UI in plain text (or upload a spec/reference file), pick React (Vite) or
Next.js, and get a live preview you can refine with feedback and download as a
runnable project.

- **Backend:** FastAPI + Google Gemini (`google-genai` SDK) — parses the requirement
  into structured JSON, then generates/updates project files.
- **Frontend:** React + Vite + Tailwind. The React preview uses react-live, which
  transpiles and runs the generated component directly in the browser with no
  remote dependency. The Next.js preview instead runs a real Node.js runtime
  in-browser via WebContainers (`@webcontainer/api`) — react-live only transpiles a
  single client component, so it can't represent Next.js's server-side rendering
  and routing model the way an actual Node runtime can.
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

1. Describe the UI you want (typed text), and/or upload a spec/reference file --
   OpenAPI/Swagger (`.yaml`/`.yml`/`.json`), plain text (`.txt`), or PDF (`.pdf`).
   Image upload isn't supported yet. When an OpenAPI/Swagger spec is uploaded, its
   schema is authoritative for `dataFields`' shape; typed text (and text extracted
   from an uploaded `.txt`/`.pdf`) layers UI behavior/features on top of that.
2. Optionally add **additional instructions** — styling rules or other
   constraints/preferences — in the separate field for that; these take precedence
   over the main description if the two conflict.
3. Pick React or Next.js, click **Generate App**.
4. Review the live preview. Any assumptions the model made, or requests it couldn't
   support, are called out above the preview. For the React preview, generated code
   is hidden by default — click **View code** to see it alongside the running app.
5. Type feedback and click **Submit Feedback** to iterate.
6. Click **Download .zip** to get a runnable copy of the project (scaffold + your
   generated files) — `npm install && npm run dev` inside it to run it standalone.
7. Click **Reset** to clear the form and preview and start over.

## Notes

- Generated files only ever live under `backend/storage/projects/{project_id}/` —
  the scaffolds themselves are never modified.
- Generated code is restricted to `react`/`react-dom` (or `next`/`react`/`react-dom`
  for Next.js) — no other npm packages, so exported projects always build.
- There's a `TODO` in `backend/app.py` marking where real auth would need to go
  before this is anything but a local/personal tool — right now a project's only
  protection is an unguessable `project_id`.
- The Next.js preview's WebContainer requires the page to be cross-origin isolated
  (`Cross-Origin-Embedder-Policy: require-corp` / `Cross-Origin-Opener-Policy:
  same-origin`, set in `frontend/vite.config.js` for local dev) and, per
  WebContainers' own requirements, **HTTPS in production** (localhost is exempted
  for local dev only) — remember to serve the frontend over HTTPS with those same
  headers if this is ever deployed beyond localhost.
- The Next.js preview's first load is meaningfully slower than React's — ~107-113s
  measured end to end, since it's a real WebContainer boot + `npm install` + `next
  dev` startup happening live in the browser, not a bug or a stuck preview. That
  cost is paid once per project: a feedback round reuses the already-running
  container and dev server (writing just the changed files) instead of rebooting,
  so later iterations are fast.
