import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANDIDATE_PATHS = [
  path.resolve(__dirname, 'admin.html'),
  path.resolve(__dirname, '../src/web/admin.html'),
  path.resolve(__dirname, '../../src/web/admin.html'),
  path.resolve(process.cwd(), 'src/web/admin.html'),
  path.resolve(process.cwd(), 'backend/src/web/admin.html'),
];

export function renderAdminHTML(): string {
  try {
    for (const p of CANDIDATE_PATHS) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf-8');
      }
    }
  } catch (err) {
    console.error('[ERROR READ ADMIN HTML]', err);
  }
  return '<h1>Admin HTML Not Found</h1>';
}
