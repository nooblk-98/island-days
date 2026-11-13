# Put Island Days online

Island Days is ready for Cloudflare Pages. The included data was fetched from the Central Bank of Sri Lanka holiday lists (https://www.cbsl.gov.lk/en/about/about-the-bank/bank-holidays-2026 and the 2027 page) on 13 November 2026: 51 public holidays for 2026–2027, each marked as a bank and/or mercantile holiday as gazetted. Multiple holidays may share a date.

The maintained calendar is live at **https://dayoff.itsnooblk.com/**. The repository is connected to Cloudflare Pages: pushes to `main` deploy the saved calendar, and monthly or manual runs refresh the source before deploying. The instructions below are a reference for setting up a separate deployment.

## Recommended: automatic monthly updates

You need a Cloudflare account and a GitHub account. The website itself is static; it needs no database or always-running server.

### 1. Create a Pages project

In Cloudflare, open **Workers & Pages**, choose **Create application**, then the option to upload a static site / use **Pages → Direct Upload**. Dashboard wording can vary.

Name the project **island-days**, or use your own name. Choose the direct-upload path, since GitHub Actions will upload the finished site. You can upload the contents of the supplied `island-days-pages.zip` for an immediate first version. The HTML file must be at the top level of the upload.

Use **main** as the production branch if Cloudflare asks. Record the project name and your Cloudflare **Account ID**. Account ID is an identifier, not the API token.

### 2. Add the source to GitHub

Create a GitHub repository with a **main** branch. Extract `island-days-source.zip` and put the contents of its `island-days` folder at the repository root. In particular, `.github/workflows/` and `package.json` must be at the root. Do not upload the ZIP as a single file.

The repository includes two workflows:

- **Update holidays and deploy**: runs on every push to `main`, on demand, and monthly.
- **Check calendar**: tests proposed changes in pull requests without deploying.

### 3. Connect GitHub to Cloudflare

Create a Cloudflare API token with **Account → Cloudflare Pages → Edit**, limited to the intended account.

In GitHub, open **Settings → Secrets and variables → Actions**. Add these under **Secrets**:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare Pages API token |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

Under **Variables**, add:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | `island-days`, or your exact Pages project name |

Keep the API token in GitHub Secrets. It does not belong in the website files.

The workflow requests repository contents write access so it can save refreshed holiday data. If your organization restricts this permission or protects `main` against bot commits, allow this workflow's data commits under your repository rules; otherwise the run will fail before deployment. You do not need to enable pull-request creation.

### 4. Run the first update

Open **Actions → Update holidays and deploy → Run workflow**, choose **main**, and start it. If Actions are disabled for the repository or a fork, enable them first.

A successful monthly or manual run fetches the Central Bank holiday lists, validates them, runs the tests, builds the website, saves the checked data, and publishes it to Cloudflare Pages. Pushes to `main` test, build, and deploy the saved dataset without fetching the source, so a source outage does not block a site change. Cloudflare will show your actual `pages.dev` address.

Until all three Cloudflare settings are present, the workflow runs the tests and builds the saved calendar, and skips fetching and publishing with a “Cloudflare setup pending” summary. A green check alone does not mean a deployment occurred; check the deployment step and Cloudflare dashboard.

Monthly updates are scheduled for **05:47 Sri Lanka time on the first day of each month** (`17 0 1 * *`, UTC). GitHub schedules can be delayed and run only from the default branch. Keep `main` as the default branch. Public repositories can have schedules disabled after 60 days without repository activity; successful monthly data commits normally keep this repository active. Check Actions if the site reports an overdue update.

## What happens if fetching fails?

The updater retries connection and HTTP failures up to three times. It checks date validity, weekdays, holiday counts, source links, duplicate IDs, the current year, missing previously published future years, and unexpected losses of more than 20% of a year's entries. An error stops the deployment. The current live site and the saved data remain available.

The site displays the **last successful check**, rather than a claim that it is always up to date. After 45 days it labels the update overdue. Monitor failed runs in GitHub Actions and enable your GitHub workflow-failure notifications. If the source blocks automated requests or changes its page layout, review the parser before running again. Do not bypass a challenge page.

Past years remain available when the source rolls forward. A new year is added automatically once the Central Bank publishes its gazetted list. The “Other public holidays” filter excludes the Poya days highlighted by the separate filter; both categories are public holidays.

## Quick upload without automatic updates

Upload `island-days-pages.zip` to a Cloudflare Pages Direct Upload project. This immediately serves the supplied snapshot. **Uploading the ZIP alone does not enable monthly updates.** Use the GitHub setup above for that.

## Preview or update on your computer

Install Node.js 24. In the extracted source folder:

```sh
npm ci
npm test
npm run build
npm run dev
```

Open http://127.0.0.1:4173. Stop the preview with Ctrl+C.

To fetch new data manually:

```sh
npm run refresh
npm test
npm run build
```

To deploy from your computer after signing in to Cloudflare:

```sh
npx wrangler login
npx wrangler pages deploy dist --project-name island-days --branch main
```

Use your own exact project name if different. `npm run build` intentionally uses the saved dataset and does not need to contact the source; `npm run refresh` is the explicit network update step.

## Files you may want to change

| File | Purpose |
| --- | --- |
| `src/index.html` | Site name, introduction, and page structure |
| `src/styles.css` | Colours, typography, and responsive layout |
| `src/app.js` | Views, filters, search, dialogs, downloads |
| `src/calendar.js` | Sri Lanka dates, long weekends, iCalendar export |
| `public/data/holidays.json` | Last successfully fetched dataset |
| `scripts/holidays.mjs` | Central Bank list parser and validation |
| `scripts/refresh.mjs` | Fetch, retry, and atomic data replacement |
| `.github/workflows/update-and-deploy.yml` | Monthly refresh and Cloudflare deployment |

Calendar downloads are one-time `.ics` imports; subscribe to `/holidays.ics` for live updates. Long weekends follow each visitor's "My days off" settings (Saturday–Sunday by default) and require no extra leave. The total counts distinct holiday dates, so two holidays on the same day count once.

This is an independent project with attribution and source links. Check the source's terms for your intended use, and verify dates before making bookings. The live site uses cookie-free Cloudflare Web Analytics (enabled in the Pages project settings); no external fonts or visitor tracking are included.

## Official references

- [Holiday source: Central Bank of Sri Lanka bank holidays](https://www.cbsl.gov.lk/en/about/about-the-bank/bank-holidays-2026)
- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare Pages continuous deployment and API-token setup](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [GitHub scheduled-workflow behaviour](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
