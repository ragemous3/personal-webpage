import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/*

Needs the following packages to work

sudo pacman -S --needed \
  chromium \
  nss \
  nspr \
  atk \
  libcups \
  libxcomposite \
  libxdamage \
  libxrandr \
  libxkbcommon \
  libdrm \
  libxfixes \
  libxcursor \
  libxi \
  libxtst \
  pango  http://127.0.0.1:8080/assets/index-aG7nkZOk.js\
  cairo \
  alsa-lib \
  gtk3
  */

const downloadWhenClick = async (
  id,
  page,
  downloadPath,
  expectedFileLength,
) => {
  await page.waitForSelector(`#${id}`, {
    visible: true,
  });
  console.info(`The btn is now visible for ${id}`);

  let fileDownloaded = false;

  while (!fileDownloaded) {
    await page.click(`#${id}`);
    const files = fs.readdirSync(downloadPath);
    if (files.length > expectedFileLength) {
      fileDownloaded = true;
    } else {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.info(`Download completed for ${id}!`);
};

const serveDir = path.resolve(__dirname, 'dist');

const server = http.createServer((req, res) => {
  // Default to index.html if no file is requested
  let filePath = path.join(serveDir, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
    } else {
      // Basic content type detection
      let ext = path.extname(filePath).toLowerCase();
      let type = 'text/html';
      if (ext === '.js') type = 'application/javascript';
      if (ext === '.css') type = 'text/css';
      if (ext === '.json') type = 'application/json';

      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    }
  });
});

server.listen(8000, () => {
  console.info(`Serving ${serveDir} at http://localhost:8000`);
});

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const downloadPath = path.resolve(__dirname, '../../static/content-data/');

  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath);
  } else {
    fs.rmSync(downloadPath, { recursive: true, force: true });
    fs.mkdirSync(downloadPath);
  }

  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath,
    eventsEnabled: true,
  });

  console.info('Going to page');
  await page.goto('http://localhost:8000');

  page.on('console', (msg) => {
    console.log('BROWSER LOG:', msg.text());
  });
  let expectedFileLength = fs.readdirSync(downloadPath).length;
  await downloadWhenClick('download', page, downloadPath, expectedFileLength);
  expectedFileLength = fs.readdirSync(downloadPath).length;

  await downloadWhenClick(
    'download-chunks',
    page,
    downloadPath,
    expectedFileLength,
  );
  await new Promise((r) => setTimeout(r, 5000));
  await browser.close();
  server.close(() => console.info('Server closed'));
})();
