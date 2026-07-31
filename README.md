# Urban Pure — Website

Static marketing site. No build step, no dependencies.

## Structure

```
index.html          entry point
css/styles.css      styles
js/main.js          page behaviour
js/caustics.js      water-caustics effect
images/, assets/    imagery
netlify.toml        Netlify config (publish = repo root)
```

## Run locally

Any static server works:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open http://localhost:8000

## Deploy

Pushes to `main` auto-deploy to Netlify. Pull requests get deploy previews.
