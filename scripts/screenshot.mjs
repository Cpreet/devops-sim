#!/usr/bin/env node
/**
 * Capture a screenshot of the app (localhost:5173 or devops-sim.netlify.app).
 * Usage: node scripts/screenshot.mjs [url]
 * Output: docs/assets/level1-screenshot.png
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || 'https://devops-sim.netlify.app';
const outPath = join(__dirname, '..', 'docs', 'assets', 'level1-screenshot.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

// Wait for canvas (Phaser) to be visible
await page.waitForSelector('canvas', { timeout: 10000 }).catch(() => {});

// Extra moment for any initial render
await page.waitForTimeout(1500);

await page.screenshot({ path: outPath, fullPage: false });
await browser.close();

console.log('Screenshot saved to', outPath);
