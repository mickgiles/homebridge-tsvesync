#!/usr/bin/env node
/**
 * Patches tsvesync to use HTTP PUT instead of POST for bypassV2 write commands.
 * The VeSync API silently ignores POST for setHumidityMode and setTargetHumidity
 * on certain devices (e.g. Dual 200S). The working homebridge-levoit-humidifiers
 * plugin uses PUT for all bypassV2 commands.
 *
 * License note: this approach was informed by homebridge-levoit-humidifiers
 * (Apache-2.0), which uses PUT for its VeSync API calls.
 */
const fs = require('fs');
const path = require('path');

function findFile(dir, target) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const result = findFile(fullPath, target);
      if (result) return result;
    } else if (fullPath.endsWith(target)) {
      return fullPath;
    }
  }
  return null;
}

const target = path.join('tsvesync', 'dist', 'lib', 'fans', 'humidifier.js');
const filePath = findFile(path.join(__dirname, '..', 'node_modules'), target);

if (!filePath) {
  console.log('[patch-tsvesync] tsvesync humidifier.js not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');
const original = content;

// Patch setMode and setHumidity to use PUT instead of POST
content = content.replace(
  /await this\.callApi\('\/cloud\/v2\/deviceManaged\/bypassV2', 'post'/g,
  "await this.callApi('/cloud/v2/deviceManaged/bypassV2', 'put'"
);

if (content !== original) {
  fs.writeFileSync(filePath, content);
  const count = (original.match(/bypassV2', 'post'/g) || []).length;
  console.log(`[patch-tsvesync] Patched ${count} POST->PUT calls in ${filePath}`);
} else {
  console.log('[patch-tsvesync] Already patched or no changes needed');
}
