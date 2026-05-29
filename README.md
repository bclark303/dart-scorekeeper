# Dart Scorekeeper

A local-first X01 dart scoring app built with Next.js.

## Current Version

v0.1.0

## Current Features

- 301 / 501 / 701 X01 scoring
- Straight-out and double-out finishes
- Total-turn score entry
- Dart-by-dart score entry
- Singles, doubles, and larger team matches
- Uneven team sizes
- Dummy-score rotation for missing players
- Undo last turn
- Completed leg history
- Dart details in history
- Compact / full scoring layouts
- Theme and branding settings
- Local browser save/resume
- Feedback form with diagnostics

## Known Limitations

- X01 is the only supported game type right now.
- No graphical dartboard input yet.
- No league, tournament, or backend sync yet.
- Match data is stored only in the current browser/device.
- Clearing browser data may erase saved matches.
- Feedback submission requires an internet connection.

## Local Development

Install dependencies:

```powershell
npm install
```

Run the dev server:

```powershell
npm run dev
```

Build for production:

```powershell
npm run build
```

Run lint checks:

```powershell
npm run lint
```

## Feedback Form Setup

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_FEEDBACK_ENDPOINT=https://formspree.io/f/your-form-id
```

Do not commit `.env.local`.

The project `.gitignore` should include:

```text
.env*.local
```

## Deployment Notes

This app can be deployed to Vercel as a Next.js project.

Required environment variable on Vercel:

```text
NEXT_PUBLIC_FEEDBACK_ENDPOINT
```

Set it to the Formspree endpoint used for tester feedback.

## Tester Notes

For v0.1.0 testing, focus on:

- Total-turn score entry
- Dart-by-dart score entry
- Undo behavior
- Checkouts
- Team rotation
- Uneven teams
- Compact layout on tablets/phones
- Feedback form submissions