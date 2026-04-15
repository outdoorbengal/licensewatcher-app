# LicenseWatcher — State Registration Tracker

A dashboard for managing state feed/pet food registrations across US states, with compliance tracking, deadline alerts, and document management. Uses GitHub as a JSON database and deploys to Vercel.

## Architecture

```
┌─────────────────────────┐        ┌──────────────────────────┐
│   Vercel (hosting)      │        │  GitHub (data storage)   │
│                         │        │                          │
│  licensewatcher-app     │──API──▶│  licensewatcher-data     │
│  (React + Vite)         │        │  (private repo)          │
│                         │        │  ├── data/               │
│  Public URL:            │        │  │   ├── registrations   │
│  yourapp.vercel.app     │        │  │   ├── products        │
│                         │        │  │   ├── state-reqs      │
│                         │        │  │   └── settings        │
└─────────────────────────┘        └──────────────────────────┘
```

- **Frontend**: React 18 + Vite → deployed to Vercel
- **Database**: GitHub API — JSON files in a separate private repo
- **Auth**: GitHub Fine-Grained Personal Access Token (scoped to data repo only)

## Project Structure

```
licensewatcher/
├── index.html          # Entry HTML with fonts + animations
├── package.json        # Dependencies (React, Vite)
├── vite.config.js      # Vite config
├── vercel.json         # Vercel deploy config (SPA routing)
├── .gitignore
└── src/
    ├── main.jsx        # React entry point
    └── App.jsx         # Full application (all pages, GitHub DB layer)
```

---

## Deployment Instructions

### Step 1 — Create the data repo

1. Go to https://github.com/new
2. Name: `licensewatcher-data`
3. Visibility: **Private**
4. Leave it empty (no README, no .gitignore) — the app initializes it automatically
5. Click "Create repository"

### Step 2 — Create a fine-grained GitHub token

1. Go to https://github.com/settings/tokens?type=beta
2. Click "Generate new token"
3. Settings:
   - **Token name**: `LicenseWatcher`
   - **Expiration**: 90 days (or custom)
   - **Repository access**: "Only select repositories" → select `licensewatcher-data`
   - **Permissions**:
     - Contents → **Read & Write** ✅ (required now)
     - Metadata → **Read** ✅ (always included)
     - Pull Requests → Read & Write (for Phase 2)
     - Issues → Read & Write (for Phase 2)
     - Actions → Read & Write (for Phase 2)
     - Administration → Read & Write (for Phase 2)
     - Webhooks → Read & Write (for Phase 2)
     - Deployments → Read & Write (for Phase 2)
     - Environments → Read & Write (for Phase 2)
4. Click "Generate token" and **copy it immediately**

### Step 3 — Create the app repo and push code

```bash
# Unpack the project
tar -xzf licensewatcher-project.tar.gz
cd licensewatcher

# Initialize git and push to GitHub
git init
git add .
git commit -m "Initial commit — LicenseWatcher v1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/licensewatcher-app.git
git push -u origin main
```

> **Note**: Create the `licensewatcher-app` repo on GitHub first (can be public or private).

### Step 3 — Deploy to Vercel

**Option A — Via Vercel CLI (recommended for agents)**:
```bash
# Install Vercel CLI globally
npm install -g vercel

# Deploy (follow the prompts)
vercel

# For production deploy:
vercel --prod
```

**Option B — Via Vercel Dashboard**:
1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select `licensewatcher-app`
4. Framework Preset: **Vite** (should auto-detect)
5. Click "Deploy"
6. Your app is live at `https://licensewatcher-app.vercel.app`

### Step 4 — Connect and use

1. Open your Vercel URL in a browser
2. On the setup screen, enter:
   - Your fine-grained token (from Step 2)
   - Your GitHub username
   - Data repo name: `licensewatcher-data`
3. Click "Connect & Initialize"
4. The app creates the data files and you're live
5. Share the URL with your team

---

## How it works

- Every create/update/delete commits to the `licensewatcher-data` repo via GitHub API
- Each change has a descriptive commit message → full audit trail for free
- Dynamic fields (days until deadline, priority) are calculated on the fly
- Token is entered per-browser session (stored in React state, not persisted)

## Auto-redeploy

Once connected to Vercel, any push to `main` on `licensewatcher-app` triggers automatic redeployment. To update the app:

```bash
git add .
git commit -m "Your change description"
git push
```

Vercel rebuilds and deploys in ~30 seconds.

## Future Phases

- **Phase 2**: Email alerts via GitHub Actions cron job + SendGrid/Resend
- **Phase 3**: File storage (PDFs, artworks) via Cloudflare R2 or S3
- **Phase 4**: Multi-tenant auth (Clerk/Auth0), persistent token storage, custom domains
