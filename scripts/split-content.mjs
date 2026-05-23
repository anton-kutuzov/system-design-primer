import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const repoFull = process.env.GITHUB_REPOSITORY ?? '';
const [, repoNameEnv] = repoFull.split('/');
const repo = repoNameEnv || 'system-design-primer';
const basePrefix = `/${repo}`;

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

function transliterate(text) {
  return [...text].map((ch) => TRANSLIT[ch] ?? ch).join('');
}

function latinSlug(text) {
  const lower = text.toLowerCase().trim();
  const tr = transliterate(lower);
  return tr.replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

function nativeSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

function parseSections(markdown) {
  const lines = markdown.split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^## (.+?)\s*$/);
    if (m) {
      if (current) sections.push(current);
      current = { title: m[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function collectSubAnchors(sectionLines) {
  const out = [];
  for (const line of sectionLines) {
    const m = line.match(/^#{3,6} (.+?)\s*$/);
    if (m) out.push(nativeSlug(m[1].trim()));
  }
  return out;
}

function rewriteImagePaths(content) {
  let out = content;
  out = out.replace(/\]\(images\//g, `](${basePrefix}/images/`);
  out = out.replace(/src=(["'])images\//g, `src=$1${basePrefix}/images/`);
  return out;
}

function rewriteAnchors(content, anchorToPage) {
  return content.replace(/\]\(#([^)]+)\)/g, (full, anchor) => {
    const target =
      anchorToPage.get(anchor) ??
      anchorToPage.get(anchor.toLowerCase()) ??
      anchorToPage.get(nativeSlug(anchor)) ??
      anchorToPage.get(latinSlug(anchor));
    return target ? `](${target})` : full;
  });
}

function escapeYaml(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function frontmatter({ title, description, order }) {
  const lines = ['---', `title: "${escapeYaml(title)}"`];
  if (description) lines.push(`description: "${escapeYaml(description)}"`);
  if (typeof order === 'number') lines.push('sidebar:', `  order: ${order}`);
  lines.push('---', '', '');
  return lines.join('\n');
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

async function main() {
  const contentRoot = path.join(root, 'src', 'content', 'docs');
  await fs.rm(contentRoot, { recursive: true, force: true });
  await fs.mkdir(contentRoot, { recursive: true });

  const englishRaw = await fs.readFile(path.join(root, 'README.md'), 'utf-8');
  const englishSections = parseSections(englishRaw);

  const slugs = englishSections.map((sec, i) => {
    const base = latinSlug(sec.title);
    return base || `section-${String(i + 1).padStart(2, '0')}`;
  });
  const seen = new Map();
  for (let i = 0; i < slugs.length; i++) {
    const s = slugs[i];
    if (!seen.has(s)) { seen.set(s, 1); continue; }
    const n = seen.get(s) + 1;
    seen.set(s, n);
    slugs[i] = `${s}-${n}`;
  }

  const englishSubToParent = new Map();
  for (let i = 0; i < englishSections.length; i++) {
    for (const subSlug of collectSubAnchors(englishSections[i].lines)) {
      if (!englishSubToParent.has(subSlug)) {
        englishSubToParent.set(subSlug, slugs[i]);
      }
    }
  }

  const langs = [
    {
      dir: 'ru',
      source: 'README-ru.md',
      title: 'System Design Primer',
      intro:
        'Полный перевод [The System Design Primer](https://github.com/donnemartin/system-design-primer) на русский язык. ' +
        'Учебник по проектированию крупномасштабных систем и подготовке к собеседованию по системному дизайну.\n\n' +
        'Используйте меню слева для навигации по разделам.',
    },
    { dir: 'en', source: 'README.md', title: 'The System Design Primer', intro: 'Learn how to design large-scale systems. Prep for the system design interview.' },
    { dir: 'ja', source: 'README-ja.md', title: 'システム設計入門', intro: '大規模なシステムを設計する方法を学ぶ。' },
    { dir: 'zh-hans', source: 'README-zh-Hans.md', title: '系统设计入门', intro: '学习如何设计大型系统。' },
    { dir: 'zh-tw', source: 'README-zh-TW.md', title: '系統設計入門', intro: '學習如何設計大規模系統。' },
  ];

  for (const lang of langs) {
    await splitLanguage(lang, contentRoot, slugs, englishSubToParent);
  }

  await fs.writeFile(
    path.join(root, 'src', 'sidebar.generated.json'),
    JSON.stringify(slugs, null, 2),
    'utf-8',
  );

  await copyAssets();
  console.log(`✓ ${slugs.length} стабильных slug'ов для ${langs.length} локалей`);
}

async function splitLanguage(lang, contentRoot, slugs, englishSubToParent) {
  const raw = await fs.readFile(path.join(root, lang.source), 'utf-8');
  const sections = parseSections(raw);
  const dir = path.join(contentRoot, lang.dir);
  await fs.mkdir(dir, { recursive: true });

  const anchorToPage = new Map();
  for (let i = 0; i < sections.length; i++) {
    const slug = slugs[i];
    if (!slug) continue;
    const url = `${basePrefix}/${lang.dir}/${slug}/`;
    anchorToPage.set(slug, url);
    const native = nativeSlug(sections[i].title);
    if (native && !anchorToPage.has(native)) anchorToPage.set(native, url);
    for (const subSlug of collectSubAnchors(sections[i].lines)) {
      if (!anchorToPage.has(subSlug)) {
        anchorToPage.set(subSlug, `${url}#${subSlug}`);
      }
    }
  }

  if (englishSubToParent) {
    for (const [subSlug, parentSlug] of englishSubToParent) {
      if (!anchorToPage.has(subSlug)) {
        anchorToPage.set(subSlug, `${basePrefix}/${lang.dir}/${parentSlug}/#${subSlug}`);
      }
    }
  }

  await fs.writeFile(
    path.join(dir, 'index.md'),
    frontmatter({ title: lang.title, order: 0 }) + (lang.intro || ''),
    'utf-8',
  );

  for (let i = 0; i < sections.length; i++) {
    const slug = slugs[i];
    if (!slug) continue;
    const sec = sections[i];
    let body = sec.lines.join('\n').replace(/^\n+/, '');
    body = rewriteImagePaths(body);
    body = rewriteAnchors(body, anchorToPage);
    await fs.writeFile(
      path.join(dir, `${slug}.md`),
      frontmatter({ title: sec.title, order: i + 1 }) + body,
      'utf-8',
    );
  }
  console.log(`  ${lang.dir}: ${sections.length} разделов`);
}

async function copyAssets() {
  const imagesSrc = path.join(root, 'images');
  const imagesDest = path.join(root, 'public', 'images');
  await fs.rm(imagesDest, { recursive: true, force: true });
  await copyDir(imagesSrc, imagesDest);

  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#252529"/>
  <line x1="20" y1="22" x2="44" y2="42" stroke="#5eead4" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <circle cx="20" cy="22" r="5" fill="#fafafa"/>
  <circle cx="44" cy="42" r="5" fill="#5eead4"/>
</svg>
`;
  await fs.mkdir(path.join(root, 'public'), { recursive: true });
  await fs.writeFile(path.join(root, 'public', 'favicon.svg'), favicon, 'utf-8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
