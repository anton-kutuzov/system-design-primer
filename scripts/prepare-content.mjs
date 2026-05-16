import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const repoFull = process.env.GITHUB_REPOSITORY ?? '';
const [, repoNameEnv] = repoFull.split('/');
const repo = repoNameEnv || 'system-design-primer';
const basePrefix = `/${repo}`;

const langs = [
  {
    dir: '',
    source: 'README-ru.md',
    title: 'Введение в проектирование систем',
    description:
      'Учебник по проектированию крупномасштабных систем на русском языке: ' +
      'масштабируемость, балансировка нагрузки, кэширование, базы данных, ' +
      'репликация, шардирование, очереди сообщений и микросервисы.',
  },
  {
    dir: 'en',
    source: 'README.md',
    title: 'The System Design Primer',
    description:
      'Learn how to design large-scale systems. Prep for the system design interview.',
  },
  {
    dir: 'ja',
    source: 'README-ja.md',
    title: 'システム設計入門',
    description: '大規模なシステムを設計する方法を学ぶ。システム設計面接の準備。',
  },
  {
    dir: 'zh-hans',
    source: 'README-zh-Hans.md',
    title: '系统设计入门',
    description: '学习如何设计大型系统。为系统设计面试做准备。',
  },
  {
    dir: 'zh-tw',
    source: 'README-zh-TW.md',
    title: '系統設計入門',
    description: '學習如何設計大規模系統。為系統設計面試做準備。',
  },
];

function processMarkdown(content) {
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && lines[i].trim().startsWith('*[')) {
    lines.splice(i, 1);
  }
  let out = lines.join('\n');

  out = out.replace(/^# .+\n+/m, '');
  out = out.replace(/\]\(images\//g, `](${basePrefix}/images/`);
  out = out.replace(/src=(["'])images\//g, `src=$1${basePrefix}/images/`);

  return out.trimStart();
}

function escapeYaml(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function frontmatter({ title, description }) {
  return [
    '---',
    `title: "${escapeYaml(title)}"`,
    `description: "${escapeYaml(description)}"`,
    'template: doc',
    '---',
    '',
    '',
  ].join('\n');
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

const contentRoot = path.join(root, 'src', 'content', 'docs');
await fs.rm(contentRoot, { recursive: true, force: true });
await fs.mkdir(contentRoot, { recursive: true });

for (const lang of langs) {
  const sourcePath = path.join(root, lang.source);
  const targetDir = path.join(contentRoot, lang.dir);
  const targetPath = path.join(targetDir, 'index.md');

  try {
    const raw = await fs.readFile(sourcePath, 'utf-8');
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetPath, frontmatter(lang) + processMarkdown(raw), 'utf-8');
    console.log(`  ${lang.source}  →  ${path.posix.join('src/content/docs', lang.dir || '', 'index.md')}`);
  } catch (err) {
    console.warn(`  skip ${lang.source}: ${err.message}`);
  }
}

try {
  const imagesSrc = path.join(root, 'images');
  const imagesDest = path.join(root, 'public', 'images');
  await fs.rm(imagesDest, { recursive: true, force: true });
  await copyDir(imagesSrc, imagesDest);
  console.log('  images/  →  public/images/');
} catch (err) {
  console.warn(`  skip images: ${err.message}`);
}

await fs.mkdir(path.join(root, 'public'), { recursive: true });

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#252529"/>
  <line x1="20" y1="22" x2="44" y2="42" stroke="#5eead4" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <circle cx="20" cy="22" r="5" fill="#fafafa"/>
  <circle cx="44" cy="42" r="5" fill="#5eead4"/>
</svg>
`;
await fs.writeFile(path.join(root, 'public', 'favicon.svg'), favicon, 'utf-8');

const ogImage = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#252529"/>

  <g stroke="#5eead4" stroke-width="1.5" opacity="0.4" stroke-linecap="round">
    <line x1="200" y1="180" x2="380" y2="320"/>
    <line x1="380" y1="320" x2="600" y2="220"/>
    <line x1="600" y1="220" x2="820" y2="380"/>
    <line x1="820" y1="380" x2="1000" y2="260"/>
    <line x1="380" y1="320" x2="500" y2="480"/>
    <line x1="600" y1="220" x2="700" y2="460"/>
  </g>
  <g>
    <circle cx="200" cy="180" r="5" fill="#fafafa"/>
    <circle cx="380" cy="320" r="6" fill="#5eead4"/>
    <circle cx="600" cy="220" r="5" fill="#fafafa"/>
    <circle cx="820" cy="380" r="6" fill="#5eead4"/>
    <circle cx="1000" cy="260" r="5" fill="#fafafa"/>
    <circle cx="500" cy="480" r="4" fill="#fafafa" opacity="0.7"/>
    <circle cx="700" cy="460" r="4" fill="#fafafa" opacity="0.7"/>
  </g>

  <text x="80" y="540" font-family="Inter, -apple-system, sans-serif" font-size="64" font-weight="600" fill="#fafafa" letter-spacing="-1.8">System Design Primer</text>
  <text x="80" y="585" font-family="Inter, -apple-system, sans-serif" font-size="26" font-weight="400" fill="#5eead4" letter-spacing="-0.3" opacity="0.85">Перевод на русский · масштабируемые системы</text>
</svg>
`;
await fs.writeFile(path.join(root, 'public', 'og-image.svg'), ogImage, 'utf-8');
