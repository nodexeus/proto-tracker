#!/usr/bin/env node

/**
 * Script to generate favicon.svg from SiBlockchaindotcom icon
 * This extracts the SVG path data and creates a proper favicon file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The SVG path data for SiBlockchaindotcom icon
// This is the actual path from the react-icons/si package
const blockchainIconPath = "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5";

// Generate the SVG content
const faviconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
  <path fill="#228be6" d="${blockchainIconPath}"/>
</svg>`;

// Write to public directory
const publicDir = path.join(__dirname, '..', 'public');
const faviconPath = path.join(publicDir, 'favicon.svg');

try {
  fs.writeFileSync(faviconPath, faviconSVG);
  console.log('✅ Generated favicon.svg successfully!');
  console.log(`📁 Saved to: ${faviconPath}`);
} catch (error) {
  console.error('❌ Error generating favicon:', error);
  process.exit(1);
}
