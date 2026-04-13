const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

async function build() {
  // Build React App
  await esbuild.build({
    entryPoints: ['app/app.tsx'],
    bundle: true,
    outfile: 'public/build/app.js',
    minify: true,
  });

  // Transform Markdown Docs
  const docsDir = path.join(__dirname, '../docs');
  const files = fs.readdirSync(docsDir);
  const docsData = {};

  for (const file of files) {
    if (file.endsWith('.md')) {
      const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
      docsData[file] = marked.parse(content);
    }
  }

  // Write out as JSON so frontend can easily load it
  fs.writeFileSync('public/build/docs.json', JSON.stringify(docsData));

  console.log('Build completed!');
}

build().catch(console.error);
