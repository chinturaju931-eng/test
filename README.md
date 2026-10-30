# CommuteAds marketing studio

A local marketing workspace for CommuteAds, an in-cab tablet advertising business in Hyderabad. Requires Node.js 22 or newer. No dependencies, API keys, or installation step required.

![Commute Ads dashboard](docs/dashboard.png)

## Update an existing Windows copy

For this dashboard redesign, close the running app window, download and extract the latest ZIP, and copy only its `public` folder into your existing app folder. Choose to replace the old files. Double-click `START-WINDOWS.bat` again and refresh the browser with **Ctrl + F5**. Your saved data stays in the existing `.data` folder.

## Open on Windows

1. On GitHub, choose **Code → Download ZIP**.
2. Right-click the downloaded ZIP and choose **Extract All**. Open the extracted folder containing `package.json`.
3. Double-click **START-WINDOWS.bat** (Windows may display it as **START-WINDOWS**). Node.js 22 or newer must already be installed.
4. Keep the window open. Once it says **CommuteAds listening on port 3000**, type `http://127.0.0.1:3000` into your browser's address bar.

This address works on the computer running the app. Closing the startup window stops it. You do not need to run `npm install`.

## Start from a terminal

```sh
cd /workspace/test
npm start
```

The server listens on loopback port 3000. `PORT` changes the port; `HOST` changes the bind address. This is a single-user local application without authentication. Do not expose it publicly without adding authentication and deployment security.

## What works

- Generate three company-page post drafts from a campaign topic using built-in English and Telugu templates. The default is a bilingual post every two days; each batch suggests campaign days 1, 3, and 5, without assigning dates or approving content.
- Add your own prospects and generate introductions using their contact and personalization notes.
- Prepare comments using a source post and your own specific observation. No scraping or automatic post analysis.
- Edit, approve, reject, reopen, and record manual completion of drafts. Editing clears approval and planned dates.
- Plan future post dates in India Standard Time. These dates are reminders only; there is no background scheduler or automatic publishing.
- Suppress opted-out contacts and reject their pending message drafts.
- Save company details, track local activity, and export a JSON backup.

All initial counters are real workspace counts, starting at zero. No sample leads or fabricated campaign results are included. Fleet and pricing fields are reference notes; templates do not invent metrics or include those figures automatically.

Business defaults are in `brand.js`: 10 tablets in Hyderabad (cab count unconfirmed), the CommuteAds LinkedIn page and website, connect@commuteads.com, and 6300081436. Pricing is discussed after connecting with a client. Target advertisers are brands and agencies across sectors with budgets for premium campaigns; this does not claim that cab passengers have a particular income. Brand settings lets you change these details and language/cadence preferences. Existing saved settings are preserved when new fields are added. Both language sections include the business contact details; topics stay as entered and are not automatically translated.

## LinkedIn and AI integrations

This first version uses deterministic templates, not an LLM. No LinkedIn credentials are requested or stored. Posts, messages, and comments are copied for manual sharing; marking an item completed records your action and does not verify it on LinkedIn. Company-page outbound messaging is limited by LinkedIn account capabilities.

Automatic company-page publishing is a separate integration requiring an approved LinkedIn application, appropriate organization permissions, secure token storage, and API/version validation. Automated comments and cold messaging are not connected. No browser bots or mass-send mechanism are included.

## Data and tests

Data persists in `.data/workspace.json`, ignored by Git. Back up this directory or export through Brand settings. `DATA_DIR` selects another data directory. Run only one server process per data directory. An application restart retains saved records; live processes do not survive environment snapshots.

```sh
npm test
```

Tests start an isolated server with temporary data. They exercise draft generation, review transitions, planned dates, opt-out enforcement, persistence across restart, input validation, static serving, and cross-origin write protection. They do not contact LinkedIn.

Use the existing checkout in cloud tasks; do not create a Git worktree unless explicitly requested.
