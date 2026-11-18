# FocusFlow AI

An AI-powered personal productivity assistant: smart task management, constraint-based daily planning,
productivity insights, habit tracking, and a Pomodoro focus mode.

**Tech stack:** React 19, TypeScript, Vite, Tailwind CSS, Firebase Authentication, Cloud Firestore, Google Gemini.

## Architecture
FocusFlow AI is a fully static single-page app. There is **no custom backend server**.

- **Authentication and data:** Firebase Authentication (Google sign-in) and Cloud Firestore. Access is controlled
  by the rules in [`firestore.rules`](firestore.rules): each user can only read and write their own documents.
- **AI features:** each user brings their own Gemini API key. Gemini requests are made directly from the
  browser to Google; they do not pass through any server of this project.
- **Productivity engine:** task scoring and insights are computed in the browser (`src/ml/`).

## Gemini API key: how it is stored
When you paste your Gemini key, the app:
1. keeps it in your browser's `localStorage`, and
2. **also saves it, unencrypted, in your own Firestore document** (`user_secrets/{your uid}`) so it syncs across your
   devices. Firestore rules allow only you to read or write that document.

Because the key is stored in plain text in the database, use a key with a quota limit, and delete it in
Settings if you no longer want it stored. Disconnecting removes both copies.

## Run locally
1. `npm install`
2. `npm run dev`, then open http://localhost:3000
3. Sign in and paste your Gemini API key on the first screen (get one at https://aistudio.google.com/apikey)

To use your own Firebase project, replace the values in `firebase-applet-config.json` and `.firebaserc`.
Firebase web config values are not secrets, but you should restrict the API key to your domain in the
Google Cloud Console.

## Deploy (free Spark plan)
1. `npm install -g firebase-tools` and `firebase login`
2. `npm run build`
3. `firebase deploy` (publishes the site and the Firestore rules)

## Tests
`npm test` runs the unit tests (productivity engine, data import/export, and the security-rule scenarios).

## Documentation
- [`security_spec.md`](security_spec.md): Firestore security design and attack scenarios
- [`firebase-blueprint.json`](firebase-blueprint.json): data model

## Contributors
This project was developed by:

- K.A.V Manikanta
- M. Ravi Teja
- B. Vyas Sri Nandan

