const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) results = results.concat(walk(file));
        else if (file.endsWith('.jsx')) results.push(file);
    });
    return results;
}

const files = walk('client/src');
files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const hasMotionUsage = /<motion\.|motion\.|motion\(/.test(content);
    const hasImport = /import.*motion.*from ['"]framer-motion['"]/.test(content);
    if (hasMotionUsage && !hasImport) {
        console.log('MISSING IMPORT in:', file);
    }
});
