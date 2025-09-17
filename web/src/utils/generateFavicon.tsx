import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiBlockchaindotcom } from 'react-icons/si';

/**
 * Utility to generate SVG favicon from SiBlockchaindotcom icon
 */
export function generateBlockchainFaviconSVG(size: number = 32, color: string = '#228be6'): string {
  const iconElement = React.createElement(SiBlockchaindotcom, {
    size,
    color,
    style: { display: 'block' }
  });

  const svgMarkup = renderToStaticMarkup(iconElement);
  
  // Extract the path data from the rendered SVG
  const pathMatch = svgMarkup.match(/<path[^>]*d="([^"]*)"[^>]*>/);
  const pathData = pathMatch ? pathMatch[1] : '';

  // Create a proper SVG with viewBox
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
  <path fill="${color}" d="${pathData}"/>
</svg>`;

  return svg;
}

/**
 * Generate favicon as data URL
 */
export function generateFaviconDataURL(size: number = 32, color: string = '#228be6'): string {
  const svg = generateBlockchainFaviconSVG(size, color);
  const base64 = btoa(svg);
  return `data:image/svg+xml;base64,${base64}`;
}

// Generate the SVG content for saving to file
export const blockchainFaviconSVG = generateBlockchainFaviconSVG(32, '#228be6');
