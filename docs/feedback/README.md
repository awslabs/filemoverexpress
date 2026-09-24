# Feedback Page

A simple static feedback form for File Mover Express served via GitHub Pages. No backend, no third-party services — it uses `mailto:` to open the user's email client with structured feedback pre-filled.

## Setup

1. **Enable GitHub Pages** — in repo Settings → Pages, deploy using GitHub Actions with the "Static HTML" workflow pointing at `docs/feedback/`
2. **Set visibility to Public** — so customers outside the org can access it
3. **Push** — once deployed, the form lives at `https://awslabs.github.io/file-mover-express/feedback/`

## How it works

1. User fills out the form (type, interface, OS, version, message)
2. On submit, JavaScript builds a `mailto:` link with a structured body
3. User's email client opens with the feedback pre-filled
4. User hits send (and can remove their signature or identifying info for anonymity)

## Tradeoffs

- **Pro:** Zero infrastructure, zero cost, zero third-party dependencies
- **Pro:** Users can stay anonymous by removing identifying info before sending
- **Con:** Depends on user having an email client configured
- **Con:** User sees the email before sending (could also be a pro — transparency)

## Files

| File | Purpose |
|------|---------|
| `index.html` | The feedback form |
| `README.md` | This guide |
