const fs = require('fs');
const path = require('path');

function replaceInFile(file, replacers) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  for (const r of replacers) {
    if (content.includes(r[0]) || r[0] instanceof RegExp) {
      const oldLength = content.length;
      content = content.replace(r[0], r[1]);
      if (content.length !== oldLength || content !== fs.readFileSync(file, 'utf8')) {
          modified = true;
      }
    }
  }
  if (modified) {
    fs.writeFileSync(file, content);
    console.log('Updated:', file);
  }
}

// Admin API
replaceInFile('e:/portfolio/admin/src/services/api.js', [
  ['http://localhost:5000', 'https://api.nguyenquangson.id.vn']
]);

// Client Pages
const clientPages = ['Projects.jsx', 'Contact.jsx', 'BlogDetail.jsx', 'Blog.jsx'];
for (const p of clientPages) {
  replaceInFile('e:/portfolio/client/src/pages/' + p, [
    [/http:\/\/localhost:5000/g, 'https://api.nguyenquangson.id.vn']
  ]);
}

// Playground
replaceInFile('e:/portfolio/client/src/pages/Playground.jsx', [
  [/\/api\/ai/g, 'https://api.nguyenquangson.id.vn/api/ai']
]);
