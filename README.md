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
5. Use **Fill unassigned** to allocate only unassigned people, or **Reshuffle unlocked** to recalculate automated allocations without changing manually locked people.
6. Export assigned teams to a UTF-8 CSV file.

The team capacities are balanced (sizes differ by at most one) and random assignment attempts to spread each orchestra across teams evenly. If a team count or inclusion change makes a team overfull, some assignments may be cleared, prioritizing preservation of manual choices. No data is uploaded to a server; processing happens in the browser, and edits are not saved across refreshes.

## Files

- `src/App.jsx` — interface and app behavior
- `src/lib/assignments.js` — import, roster, team distribution, CSV export
- `src/App.css` / `src/index.css` — styling
- `test/team-utils.test.js` — logic tests
