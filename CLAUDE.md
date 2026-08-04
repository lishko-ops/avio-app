# Standing project rules

These are permanent, standing instructions for this repo. Apply them to every
future request without asking for confirmation each time.

1. **Auto-merge to `main`.** For every change the user requests: commit it,
   push it, open a PR (if not already open), and merge it into `main`
   immediately — do not wait for manual approval or leave it sitting as an
   open PR. This overrides the default "always confirm before pushing/merging"
   behavior for this repo specifically.
2. **Auto-deploy.** `main` is published automatically via GitHub Pages
   (`.github/workflows/deploy-pages.yml`, triggered on every push to `main`).
   Do not skip or disable this workflow. After merging, the user should see
   the change live at the Pages URL within a minute or two, with no extra
   steps needed on their end.
