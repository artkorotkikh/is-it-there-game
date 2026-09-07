import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

// Follow the documented graph, not arbitrary nearby Markdown files. The original
// user brief is an immutable reference and is exempt from entrypoint formatting.
const root = process.cwd();
const visited = new Set();
const errors = [];
const expected = ['AGENTS.md', 'README.md', 'docs/index.md', 'docs/project.md', 'docs/architecture.md', 'docs/plan.md', 'docs/development.md', 'docs/deployment.md', 'docs/status.md', 'docs/reference/minimal_multiplayer_mvp.md'];
for (const path of expected) if (!existsSync(resolve(root, path))) errors.push(`Missing required document: ${path}`);

function validate(path, ancestors = []) {
  const absolute = resolve(root, path);
  if (ancestors.includes(absolute)) { errors.push(`Source cycle: ${path}`); return; }
  if (visited.has(absolute)) { errors.push(`Multiple structural parents for ${path}`); return; }
  visited.add(absolute);
  if (!existsSync(absolute)) return;
  const body = readFileSync(absolute, 'utf8');
  if (!/^---\ntitle: .+\ntags: \[[^\n]*\]\n---\n/.test(body)) errors.push(`Invalid entrypoint frontmatter: ${path}`);
  if ((body.match(/^# /gm) ?? []).length !== 1) errors.push(`Expected exactly one top-level heading: ${path}`);
  for (const match of body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const local = resolve(dirname(absolute), target.split('#')[0]);
    if (!existsSync(local)) errors.push(`Broken link in ${path}: ${target}`);
  }
  for (const match of body.matchAll(/^Source: (.+)$/gm)) {
    const link = /^\[[^\]]+\]\((\.\.?\/[^)]+\.md)\)$/.exec(match[1]);
    if (!link) { errors.push(`Invalid Source directive in ${path}`); continue; }
    const before = body.slice(0, match.index).trimEnd();
    if (!/^## /m.test(before) || before.split('\n').at(-1).startsWith('#')) errors.push(`Source needs heading and description: ${path}`);
    validate(relative(root, resolve(dirname(absolute), link[1])), [...ancestors, absolute]);
  }
}
validate('README.md');
for (const path of expected.filter(path => path !== 'AGENTS.md' && !path.includes('/reference/'))) {
  if (!visited.has(resolve(root, path))) errors.push(`Document not reachable from README: ${path}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Documentation valid: ${visited.size} entrypoints, local links and hierarchy checked. Semantic freshness is an agent responsibility.`);
