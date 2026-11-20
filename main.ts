// Leonida Cover Lab — the hand-in program for the make.fun gta6-cover-art-01 entry (Node 22, standard library
// only). The app beside this file (app/) is a plain static web app a desktop browser runs offline; this program
// hands it in. It checks the app is whole, copies app/ to /output, decodes the screenshots — kept in the repo as
// base64 text (screenshots/*.b64) so the repository stays text-only — into real JPEGs under /output/screenshots,
// and writes /output/dossier.json, the summary the judge reads, with the vendored make.fun library, which is
// left exactly as the kit shipped it.
//
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The entry stands or falls on its export sizes, so refuse to hand in an app that does not declare all three.
const EXPORT_SIZES = ['1080x1080', '1080x1350', '1920x1080'];
const indexPath = join(here, 'app', 'index.html');
if (!existsSync(indexPath)) throw new Error('app/index.html is missing: the app is not whole');
const enginePath = join(here, 'app', 'src', 'cover.js');
const engine = existsSync(enginePath) ? readFileSync(enginePath, 'utf8') : '';
for (const size of EXPORT_SIZES) {
  if (!engine.includes(size)) throw new Error(`the cover engine does not declare export size ${size}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });

// Screenshots travel as base64 text in the repo; decode each one back into the JPEG the scorer expects, and
// never copy the .b64 text itself into the output.
mkdirSync(join(out, 'screenshots'), { recursive: true });
const shotsDir = join(here, 'screenshots');
let shotCount = 0;
if (existsSync(shotsDir)) {
  for (const name of readdirSync(shotsDir).sort()) {
    if (name.endsWith('.b64')) {
      const jpegName = name.slice(0, -'.b64'.length) + '.jpg';
      writeFileSync(join(out, 'screenshots', jpegName), Buffer.from(readFileSync(join(shotsDir, name), 'utf8').trim(), 'base64'));
      shotCount += 1;
    } else if (/\.(png|jpe?g)$/i.test(name)) {
      cpSync(join(shotsDir, name), join(out, 'screenshots', name));
      shotCount += 1;
    }
  }
}
// The judge reads the screenshots first and the gate wants three or four of them; handing in fewer (or none,
// because the .b64 files went missing) would waste the entry, so fail loudly here instead.
if (shotCount < 3 || shotCount > 4) throw new Error(`expected 3 or 4 screenshots, found ${shotCount}`);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry
// the scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB
// of app files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap,
// its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
