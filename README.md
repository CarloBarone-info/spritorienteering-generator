# Spritorienteering Generator

React + Vite application for dividing participants from student orchestras into balanced teams.

## Development

Requires Node.js 20.19+ or 22.12+.

    npm install
    npm run dev

Then open the local address printed by Vite (usually http://localhost:5173).

Run checks with `npm test` (assignment logic) and `npm run build` (production bundle).

## Input

Upload an `.xlsx` spreadsheet (first sheet) or a UTF-8 `.csv` / `.tsv` file.
Each column must have an orchestra name in the first row, with participant names underneath.
Columns may have different lengths. Empty cells are skipped. Sample data is in `examples/orchestras.csv`.

## Assignment workflow

1. Upload your list or try the sample data. All names are included by default.
2. Adjust how many imported participants are included. The roster table lets you include or exclude specific people.
3. Set number of teams OR target team size. The other field is calculated automatically.
4. Rename teams and choose participants' teams manually (manual choices are locked).
5. Choose **Mix orchestras evenly** (default) to spread members from each orchestra across teams, or **Fully random** to ignore orchestra membership. Both options keep team sizes even.
6. Use **Fill unassigned** to allocate only unassigned people, or **Reshuffle unlocked** to recalculate automated allocations without changing manually locked people. Switching assignment style does not move anyone until you fill or reshuffle.
7. Click **Download Excel** for a `spritorienteering-teams.xlsx` file with one team per column, a detailed assignments sheet, and an **Unassigned** sheet when needed. Custom team names and orchestra membership are included. The original **Download CSV** option remains available.

The team capacities are balanced (sizes differ by at most one) and the default assignment style attempts to spread each orchestra across teams evenly. The fully random style ignores orchestra membership. If a team count or inclusion change makes a team overfull, some assignments may be cleared, prioritizing preservation of manual choices. No data is uploaded to a server; processing happens in the browser, and edits are not saved across refreshes.

## Files

- `src/App.jsx` — interface and app behavior
- `src/lib/assignments.js` — import, roster, team distribution, CSV and Excel sheet data
- `src/App.css` / `src/index.css` — styling
- `test/team-utils.test.js` — logic tests

## Publish to GitHub Pages

The repository contains an automated deployment workflow at
`.github/workflows/deploy-pages.yml`.

1. Open **Settings > Pages** for this repository.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Open **Actions > Deploy React app to GitHub Pages** and use **Run workflow**
   (or **Re-run jobs** if the deployment ran before Pages was enabled).
4. When the workflow succeeds, open:
   https://carlobarone-info.github.io/spritorienteering-generator/

Subsequent pushes to `main` will automatically rebuild and deploy the site.
The deployment sets `GITHUB_PAGES=true` at build time so Vite uses the correct
repository subpath while local development stays at `http://localhost:5173/`.
