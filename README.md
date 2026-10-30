# Commute Ads — private marketing workspace

A dashboard for Commute Ads in Hyderabad, with English–Telugu post drafts, leads, comments, approvals, and private team accounts. Requires Node.js 22 or newer. No dependencies or install step.

![Dashboard](docs/dashboard.png)

## Open on Windows without a command window

1. Download the repository using **Code → Download ZIP** and **Extract All**.
2. Open the extracted folder and double-click **OPEN-DASHBOARD.vbs**. Windows may display it as **OPEN-DASHBOARD**.
3. The app starts in the background and opens your browser. On first use, create your owner account; the launcher fills in the one-time setup code.
4. Use **Team & account** to change your password or add teammates.

Use **STOP-DASHBOARD.vbs** to stop the background server launched from this folder. Closing the browser does not stop the server. Only run one copy at a time. Windows Script Host must be available; the launcher has been reviewed but cannot be executed in this Linux development environment. If Windows does not run VBS files, **START-WINDOWS.bat** remains the diagnostic fallback. It shows startup errors. For manual first-time setup, read the local `.data/setup-code.txt` file and enter its code in the setup form. Do not share that code.

## Update an existing copy

This release changes the server as well as the dashboard. Stop the old app first. Download and extract the new ZIP, then copy **all of its files and folders** into your existing app folder, replacing old files. Keep your existing `.data` folder; it contains your saved work and is not included in the ZIP. Do not update only `public` for this release. Open **OPEN-DASHBOARD.vbs** and refresh with **Ctrl + F5**. Existing workspace records are retained; the first owner account now protects them.

## Share one private workspace through Render — no domain purchase

[Deploy to Render](https://render.com/deploy?repo=https://github.com/chinturaju931-eng/test)

1. Sign in to your Render account. Use the deployment link above, or choose **New → Blueprint** and connect `chinturaju931-eng/test`, branch `main`.
2. Review the Blueprint. It defines one **Starter** web service and a **1 GB persistent disk**. These are paid hosting resources; review Render's current price before deploying. No custom domain is required. Do not use an ephemeral free filesystem for your accounts and team data.
3. Deploy. Render supplies an HTTPS address ending in `.onrender.com`. `RENDER_EXTERNAL_URL` configures the app's allowed origin automatically. Do not manually invent a deployment address.
4. Open your service's **Environment** settings and privately copy the generated **SETUP_CODE**. Open the app's Render address, enter that code, and create your owner account. The code cannot create another owner after setup is complete.
5. In **Team & account**, create an account for each teammate. Share the Render address and their initial credentials privately. Ask each teammate to change their password after signing in. The app does not send account emails.

Only the sign-in page and basic health status are public. Workspace APIs require a signed-in account. There is no public registration. All members can edit workspace content; only the owner can add/remove accounts. Removing access revokes the member's active sessions immediately. Sessions expire after 12 hours and after a server restart. Password changes revoke that user's other sessions.

The hosted workspace is shared by everyone using its Render address. Updates refresh every 20 seconds when you are not editing; Refresh also loads current changes. Saving against an older workspace version produces a conflict instead of silently replacing a teammate's work. Activity records show who made each content change.

Local copies and the hosted workspace are **separate data stores**. Existing local drafts are not automatically transferred to Render. For team work, use the Render address. Local migration requires securely transferring `workspace.json` to the service's persistent DATA_DIR while the service is stopped; do not commit `.data` to GitHub or overwrite a populated team's files. Deploy only one instance per data directory.

The repository contains deployment configuration, not a live deployment. Render deployment and billing authorization happen in your account. No Render API credentials are stored in this project. Automatic deployment is disabled; deploy later changes deliberately from Render.

## Development and configuration

```sh
npm start
npm test
```

Default local address: loopback port 3000. `PORT`, `HOST`, and `DATA_DIR` override the defaults. Data lives in `.data/workspace.json`; salted scrypt password hashes live in `.data/accounts.json`. These files are excluded from Git. Keep backups of the entire data directory; the in-app JSON export contains workspace records, not accounts. There is no email-based password recovery in this release.

Hosted mode uses `NODE_ENV=production`, `HOST=0.0.0.0`, a persistent `DATA_DIR`, an HTTPS `PUBLIC_URL` (or Render's `RENDER_EXTERNAL_URL`), and a random `SETUP_CODE` of at least 24 characters for first-time setup. Production refuses to start without the necessary initial setup configuration. It uses Secure, HttpOnly, SameSite cookies, origin checks, and sign-in throttling. TLS is terminated by the hosting provider. Do not run hosted access in development mode. Setup codes, passwords, and account files must never be committed or shared in chat.

`npm test` exercises the marketing workflows, account privacy, owner permissions, revocation, persistence, concurrent updates, and production cookie/origin behavior. Optional browser smoke testing uses Python Playwright and Chromium: `python scripts/browser-smoke.py`. That script uses isolated temporary data and does not contact LinkedIn. Windows launcher execution and actual Render provisioning require those platforms and are not validated by the Linux test suite.

## Marketing capabilities

- Three post drafts per campaign, with English and Telugu templates. Default planning cadence: one bilingual post every two days (campaign days 1, 3, 5).
- Prospects entered by your team, personalized message drafts, and opt-out suppression.
- Comment drafts using a source post and your own specific observation.
- Editing, review, approval, date planning, and manually recorded completion.
- Company details, activity history, and workspace export.

LinkedIn is not connected. Content uses templates rather than an LLM; topics stay as entered and are not automatically translated. Planned dates do not automatically publish. Posting, messages, and comments are shared manually. Marketing counters reflect workspace records, not LinkedIn engagement metrics.

Business defaults in `brand.js` include 10 tablets in Hyderabad (cab count unconfirmed), the Commute Ads page and website, connect@commuteads.com, and 6300081436. Pricing is discussed after connecting with a client. Target advertisers are brands across sectors with premium campaign budgets; this makes no claim about passengers' income.

Use the existing checkout in cloud tasks; do not create a worktree unless explicitly requested.
