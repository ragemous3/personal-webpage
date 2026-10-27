import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';
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

const downloadWhenClick = async (id, page, downloadPath, expectedFileLength) => {
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

const serveDirectory = path.resolve(__dirname, 'dist');

const server = http.createServer((request, response) => {
  // Default to index.html if no file is requested
  const filePath = path.join(serveDirectory, request.url === '/' ? 'index.html' : request.url);
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end('File not found');
    } else {
      // Basic content type detection
      const extension = path.extname(filePath).toLowerCase();
      let type = 'text/html';
      if (extension === '.js') type = 'application/javascript';
      if (extension === '.css') type = 'text/css';
      if (extension === '.json') type = 'application/json';

      response.writeHead(200, { 'Content-Type': type });
      response.end(data);
    }
  });
});

server.listen(8000, () => {
  console.info(`Serving ${serveDirectory} at http://localhost:8000`);
});

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const downloadPath = path.resolve(__dirname, '../../static/content-data/');

if (fs.existsSync(downloadPath)) {
  fs.rmSync(downloadPath, { recursive: true, force: true });
  fs.mkdirSync(downloadPath);
} else {
  fs.mkdirSync(downloadPath);
}

const client = await page.createCDPSession();
await client.send('Page.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath,
  eventsEnabled: true,
});

console.info('Going to page');
await page.goto('http://localhost:8000');

page.on('console', (message) => {
  console.info('BROWSER LOG:', message.text());
});
let expectedFileLength = fs.readdirSync(downloadPath).length;
await downloadWhenClick('download', page, downloadPath, expectedFileLength);
expectedFileLength = fs.readdirSync(downloadPath).length;

await downloadWhenClick('download-chunks', page, downloadPath, expectedFileLength);
await new Promise((r) => setTimeout(r, 5000));
await browser.close();
server.close(() => console.info('Server closed'));
