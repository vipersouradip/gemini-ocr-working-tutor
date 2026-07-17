<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/2ddab912-560a-4f46-806a-061a43211337

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Add your keys to [.env.local](.env.local):
   - `GEMINI_API_KEY` — required (default OCR/tutor engine and the fallback for every other provider).
   - `MATHPIX_APP_ID` and `MATHPIX_APP_KEY` — required only if you pick the **Mathpix API** OCR option (get them at https://mathpix.com/, Account → API keys).
   - `DEEPSEEK_API_KEY` / `MISTRAL_API_KEY` — optional alternative tutor/OCR providers.
3. Run the app:
   `npm run dev`  (serves at http://localhost:3000; set `PORT` in `.env.local` to use another port)

## OCR engines

Choose the OCR engine from the **OCR** dropdown in the header:

- **Gemini 3.5 Flash** (default) — vision model that returns equations, bounding boxes, and LaTeX in one call.
- **Mathpix API** — specialized math OCR. Needs `MATHPIX_APP_ID` / `MATHPIX_APP_KEY`. Uses the `v3/text` endpoint with `include_line_data` to get per-line LaTeX and pixel contours, which are normalized to the 0–1000 coordinate space the canvas overlays use. Non-equation lines (page numbers, diagrams, tables) are filtered out.
- **Mistral Pixtral** — vision model alternative.

If a non-Gemini engine is unavailable or fails, the server automatically falls back to Gemini.
