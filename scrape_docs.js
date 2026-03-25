const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrape() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://v98store.com/docs', { waitUntil: 'networkidle0' });
  
  // Wait a little bit for the content to render fully
  await new Promise(r => setTimeout(r, 2000));
  
  // Extract all text from main content areas
  const text = await page.evaluate(() => {
    return document.body.innerText;
  });
  
  fs.writeFileSync('e:/portfolio/v98_docs.txt', text);
  console.log('Docs extracted to v98_docs.txt. Length:', text.length);
  
  await browser.close();
}

scrape();
