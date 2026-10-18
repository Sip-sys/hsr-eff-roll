# HSR Effective Roll Budget

A dependency-free, browser-based calculator for estimating the additional relic rolls needed to reach chosen stat targets, then distributing a selected share of that goal budget across stats. It is designed to run as a static GitHub Pages site.

## Use it locally

Open `index.html` in a browser. The calculator runs entirely on the device; inputs are saved in local browser storage.

## Publish with GitHub Pages

1. Create a GitHub repository and add `index.html`, `styles.css`, `calculator.js`, `app.js`, and `README.md` to its root.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select the default branch and `/ (root)`, then save.
4. Open the Pages URL GitHub provides.

No build step, package manager, API key, or backend is required.

## What to enter

- **Effective roll budget:** the comparison denominator for the result. The example starts at 48; use another value if your build model uses a different budget. The app also compares the full goal requirement with a theoretical 54-roll cap (six +15 five-star relics, all with four starting substats).
- **Target:** the final desired stat, including the unit shown by the stat.
- **Starting effective stat:** the stat value before the additional rolls being planned. Include equipped main stats, buffs, set effects, and any substats you already have; the app calculates only the remaining gap to the target.
- **Roll value:** the stat amount provided by one average five-star substat roll. The defaults use average roll values and can be changed.
- **Stat weight:** how much a roll in that stat counts toward the effective budget. For example, 0.75 means four rolls count as three effective rolls.
- **Equipped main stats:** select the stat on each piece and its value (already included in your starting stats). The selection identifies pieces where that same substat is blocked. Enter the chance for each exact main stat if you want the joint main-stat chance estimate.
- **Drop weights:** edit the exact main-stat chance for each piece and relative substat selection weights. The initial substat weights match the values listed on the [HSR Relic Stats page](https://honkai-star-rail.fandom.com/wiki/Relic/Stats); main-stat odds are editable estimates from that page's community-compiled table.
- **Share of goal budget:** choose a percentage from 0–100. The app scales each stat's required roll equivalents by that percentage and shows the resulting roll allocation, whole hits rounded up per stat, effective rolls, and projected stats.

The **Load Acheron example** button loads an editable E0-style example using CR body, ATK boots and rope, a non-ATK% sphere, and Pioneer / Izumo CR buffs. Starting stats include the main-stat values and buffs. It is a calculator example, not a recommended stat target.

## Calculation

For each target stat:

```text
substat deficit = max(0, target - starting effective stat)
expected rolls = substat deficit / value per roll
effective rolls = expected rolls × stat weight
budget used (%) = sum(effective rolls) / effective roll budget × 100
rolls at selected % = expected rolls × selected percentage
```

The full goal roll budget is the sum of expected rolls needed to reach all listed targets. The selected percentage scales each stat's requirement proportionally; it is a planning allocation, not a stochastic simulation of upgrade rolls. The calculator rounds the selected roll allocation for each stat up to whole hits. Actual substat rolls can be low, medium, or high, so whole hits do not guarantee the projected stat value.

For the “expected pieces with a line” column, the app enumerates four sequential weighted substat selections without replacement, excluding each piece's selected main stat. This estimates how often a stat appears among a random set's four substat lines. It does not estimate the probability of farming a complete build, and it does not model enhancement-roll distribution or set-piece drop rates.

The displayed chance of the selected main stats is the product of the editable per-slot chances. The Acheron example uses CR body, ATK boots, an untracked Lightning DMG sphere, and ATK rope; its sphere chance is the chance for that specific element, even though the orb's damage contribution is not included in the target stats. This probability excludes set selection, piece type drops, and substat quality.

## Project files

- `index.html` — page structure
- `styles.css` — responsive layout and styling
- `calculator.js` — pure calculation and weighted substat-line probability functions
- `app.js` — browser UI, inputs, and local persistence

