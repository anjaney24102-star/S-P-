const fs = require('fs');
const path = require('path');
const { toJsonLines } = require('../src/utils/signalExport');

const baseUrl = (process.env.RISK_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const exportRequested = process.argv.includes('--export');

async function main() {
  const firstResponse = await fetch(`${baseUrl}/signals/recent?page=1&limit=100`);
  if (!firstResponse.ok) throw new Error(`Signal API returned HTTP ${firstResponse.status}`);
  const firstPage = await firstResponse.json();
  const signals = [...firstPage.data];
  const pages = Math.ceil(firstPage.meta.total / firstPage.meta.limit);
  for (let page = 2; page <= pages; page += 1) {
    const response = await fetch(`${baseUrl}/signals/recent?page=${page}&limit=100`);
    if (!response.ok) throw new Error(`Signal API returned HTTP ${response.status}`);
    signals.push(...(await response.json()).data);
  }

  const highestImpact = [...signals].sort((a, b) => b.impact.score - a.impact.score).slice(0, 5);
  process.stdout.write(`${JSON.stringify(highestImpact, null, 2)}\n`);
  if (exportRequested) {
    const outputPath = path.resolve(process.cwd(), 'signals.jsonl');
    fs.writeFileSync(outputPath, toJsonLines(signals), 'utf8');
    process.stdout.write(`Exported ${signals.length} signals to ${outputPath}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
