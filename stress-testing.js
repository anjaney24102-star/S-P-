(() => {
  const portfolio = [
    { name: 'Corporate loans', value: 96_000_000 },
    { name: 'Investment-grade bonds', value: 84_000_000 },
    { name: 'Rate & FX derivatives', value: 60_000_000 },
  ];
  const totalValue = portfolio.reduce((sum, asset) => sum + asset.value, 0);
  const capitalBase = 60_000_000;
  const scenarioDefaults = [
    { id: 'contained', name: 'Contained', description: 'Temporary disruption; markets recover quickly.', probability: 55, severity: 100, color: '#4f8066', lossRates: [0.035, 0.055, 0.025], liquidity: 4_500_000, timeline: [0, 0.78, 0.52, 0.21, 0.08] },
    { id: 'escalation', name: 'Escalation', description: 'Prolonged disruption lifts commodity prices and credit spreads.', probability: 30, severity: 100, color: '#d28b42', lossRates: [0.14, 0.20, 0.18], liquidity: 13_000_000, timeline: [0, 0.25, 0.58, 0.86, 1] },
    { id: 'extreme', name: 'Extreme', description: 'Global supply-chain crisis, correlated declines and defaults.', probability: 15, severity: 100, color: '#c86555', lossRates: [0.32, 0.40, 0.46], liquidity: 30_000_000, timeline: [0, 0.20, 0.55, 0.90, 1.15] },
  ];
  const scenarios = scenarioDefaults.map((scenario) => ({ ...scenario }));
  const pathways = [
    { title: 'Suez bottleneck to airline credit', loss: 620_000, exposure: 8_400_000, narrative: 'A blockade at the Suez corridor lifts crude and jet-fuel prices. Higher operating costs weaken Northstar Airlines\' repayment capacity, widening the bank\'s loan credit spread.', country: ['Egypt', 'Suez corridor'], industry: ['Crude oil & jet fuel', 'Energy prices +22%'], borrower: ['Northstar Airlines', 'Air transport'], asset: ['Senior term loan', 'Loan · $8.4M exposure'] },
    { title: 'Red Sea delays to freight bonds', loss: 380_000, exposure: 6_000_000, narrative: 'Longer Red Sea transit times raise freight costs and disrupt delivery schedules. Meridian Freight faces margin pressure, reducing the value of its outstanding corporate bond.', country: ['Yemen', 'Red Sea route'], industry: ['Container shipping', 'Transit times +18 days'], borrower: ['Meridian Freight', 'Logistics'], asset: ['Senior unsecured bond', 'Bond · $6.0M exposure'] },
    { title: 'Fuel shock to derivative counterparty', loss: 240_000, exposure: 5_000_000, narrative: 'A sustained fuel shock strains the airline borrower\'s liquidity. The bank marks down its airline FX swap as counterparty credit valuation adjustment widens.', country: ['Saudi Arabia', 'Gulf energy exports'], industry: ['Aviation fuel', 'USD funding pressure'], borrower: ['Northstar Airlines', 'Counterparty risk'], asset: ['Airline FX swap', 'Derivative · $5.0M exposure'] },
  ];
  const totalPathwayLoss = pathways.reduce((sum, pathway) => sum + pathway.loss, 0);
  const scenarioExplorer = document.createElement('div');
  scenarioExplorer.className = 'scenario-explorer';
  scenarioExplorer.innerHTML = `<div class="scenario-explorer-heading"><div><div class="section-kicker">GEOPOLITICAL EVENT · MULTI-SCENARIO</div><h3>Adjust assumptions</h3><p>Probabilities stay normalized to 100%; severity scales each scenario's modeled shocks.</p></div><button class="scenario-reset" id="scenario-reset" type="button" aria-label="Reset scenario assumptions">Reset assumptions</button></div><div class="scenario-cards">${scenarios.map((scenario) => `<article class="scenario-card" data-scenario="${scenario.id}" style="--scenario-color:${scenario.color}"><div class="scenario-card-heading"><span class="scenario-swatch"></span><div><h4>${scenario.name}</h4><p>${scenario.description}</p></div></div><label class="scenario-slider-label" for="probability-${scenario.id}"><span>Probability</span><output id="probability-value-${scenario.id}">${scenario.probability}%</output></label><input id="probability-${scenario.id}" data-probability="${scenario.id}" type="range" min="0" max="100" step="1" value="${scenario.probability}" aria-label="${scenario.name} scenario probability"><label class="scenario-slider-label" for="severity-${scenario.id}"><span>Severity</span><output id="severity-value-${scenario.id}">${scenario.severity}%</output></label><input id="severity-${scenario.id}" data-severity="${scenario.id}" type="range" min="50" max="150" step="5" value="${scenario.severity}" aria-label="${scenario.name} scenario severity"><div class="scenario-card-results"><div><span>PEAK LOSS</span><b id="loss-${scenario.id}"></b></div><div><span>LIQUIDITY DRAW</span><b id="liquidity-${scenario.id}"></b></div><div><span>CAPITAL USED</span><b id="capital-${scenario.id}"></b></div></div></article>`).join('')}</div><div class="scenario-chart-panel"><div class="scenario-chart-heading"><div><div class="section-kicker">PORTFOLIO VALUE PATHS</div><h3>Scenario fan chart</h3><p>Shaded band shows the full scenario range; the line is probability-weighted.</p></div><div class="fan-legend"><span><i></i>Scenario range</span><span><b></b>Weighted value</span></div></div><div class="scenario-chart-scroll"><svg id="scenario-fan-chart" viewBox="0 0 820 250" role="img" aria-label="Fan chart comparing possible portfolio values through six months"></svg></div><div class="fan-note">Horizon: today to 6 months · Values use the selected severity sliders.</div></div>`;
  document.querySelector('.stress-summary').after(scenarioExplorer);
  const probabilityTotal = document.createElement('span');
  probabilityTotal.id = 'scenario-probability-total';
  probabilityTotal.className = 'scenario-probability-total';
  scenarioExplorer.querySelector('.scenario-explorer-heading').append(probabilityTotal);
  const contagionSection = document.createElement('section');
  contagionSection.className = 'contagion-section';
  contagionSection.id = 'contagion';
  contagionSection.setAttribute('aria-labelledby', 'contagion-title');
  contagionSection.innerHTML = `<div class="contagion-heading"><div><div class="section-kicker">EVENT TRANSMISSION · GEOPOLITICAL</div><h2 id="contagion-title">Event-to-portfolio contagion</h2><p>Illustrative shipping-blockade pathways through the synthetic wholesale book.</p></div><div class="contagion-total"><span>TOTAL PATHWAY LOSS</span><b id="contagion-total-loss">$1.24M</b></div></div><div class="contagion-meta"><span id="contagion-trigger">Shipping blockade · illustrative event path</span><div class="contagion-legend"><span><i class="indirect-key"></i>Indirect transmission</span><span><i class="direct-key"></i>Direct bank exposure</span></div></div><div class="contagion-layout"><div class="contagion-graph-wrap" role="region" aria-label="Interactive event transmission graph; scroll horizontally to inspect all nodes"><svg id="contagion-graph" viewBox="0 0 990 320" role="group" aria-label="Shipping blockade contagion pathways"></svg></div><aside class="contagion-detail" aria-live="polite"><div class="section-kicker">SELECTED PATHWAY</div><h3 id="contagion-path-title"></h3><p id="contagion-narrative"></p><div class="contagion-detail-metrics"><div><span>ESTIMATED LOSS</span><b id="contagion-path-loss"></b></div><div><span>INSTRUMENT EXPOSURE</span><b id="contagion-exposure"></b></div></div><div class="contagion-breakdown-heading">Loss by pathway</div><ul id="contagion-breakdown" class="contagion-breakdown"></ul></aside></div><div class="contagion-footnote">Loss contributions are illustrative scenario estimates, not model forecasts. They are allocated across synthetic exposures and are not additive to any separately reported stress-test loss.</div>`;
  document.getElementById('stress-testing').after(contagionSection);
  const elements = {
    scenario: document.getElementById('stress-scenario'),
    run: document.getElementById('stress-run'),
    rows: document.getElementById('stress-rows'),
    before: document.getElementById('stress-before'),
    after: document.getElementById('stress-after'),
    change: document.getElementById('stress-change'),
    changePct: document.getElementById('stress-change-pct'),
    scenarioLabel: document.getElementById('stress-scenario-label'),
    beforeBar: document.getElementById('stress-before-bar'),
    afterBar: document.getElementById('stress-after-bar'),
    beforeChart: document.getElementById('stress-before-chart'),
    afterChart: document.getElementById('stress-after-chart'),
    live: document.getElementById('stress-live'),
    sourceNote: document.getElementById('stress-source-note'),
    contagionGraph: document.getElementById('contagion-graph'),
    contagionTitle: document.getElementById('contagion-path-title'),
    contagionNarrative: document.getElementById('contagion-narrative'),
    contagionLoss: document.getElementById('contagion-path-loss'),
    contagionExposure: document.getElementById('contagion-exposure'),
    contagionBreakdown: document.getElementById('contagion-breakdown'),
    contagionTotal: document.getElementById('contagion-total-loss'),
    contagionTrigger: document.getElementById('contagion-trigger'),
  };
  let lastSignalId = null;
  let activeSignal = null;
  let selectedPathway = 0;

  elements.scenario.innerHTML = scenarios.map((scenario) => `<option value="${scenario.id}">${scenario.name}</option>`).join('');
  elements.scenario.setAttribute('aria-label', 'Highlight a scenario outcome');
  elements.run.textContent = 'Recalculate scenarios';
  document.querySelector('.stress-controls label').textContent = 'Highlight outcome';
  document.querySelector('.stress-trigger').textContent = 'Auto-trigger: Geopolitical · impact > 7';
  document.querySelector('.stress-details h3').textContent = 'Asset-level expected impact · 3 months';
  document.querySelectorAll('.stress-table thead th')[3].textContent = 'EXPECTED SHOCK';
  document.querySelector('.stress-footnote').textContent = 'Scenario losses, liquidity draws and capital usage are illustrative estimates. No correlations, regulatory capital rules, collateral or management actions are modeled; not a forecast or investment advice.';

  const money = (value) => `$${(value / 1_000_000).toFixed(1)}M`;
  const lossMoney = (value) => `$${(value / 1_000).toFixed(0)}K`;
  const scenarioById = (id) => scenarios.find((scenario) => scenario.id === id);
  const scenarioLossAt = (scenario, timeIndex) => portfolio.reduce((sum, asset, assetIndex) => sum + asset.value * scenario.lossRates[assetIndex] * scenario.severity / 100 * scenario.timeline[timeIndex], 0);
  const updateProbabilityControls = () => {
    scenarios.forEach((scenario) => {
      document.getElementById(`probability-${scenario.id}`).value = scenario.probability;
      document.getElementById(`probability-value-${scenario.id}`).textContent = `${scenario.probability}%`;
      document.getElementById(`severity-${scenario.id}`).value = scenario.severity;
      document.getElementById(`severity-value-${scenario.id}`).textContent = `${scenario.severity}%`;
    });
    const totalProbability = scenarios.reduce((sum, scenario) => sum + scenario.probability, 0);
    document.getElementById('scenario-probability-total').textContent = `${totalProbability}% assigned · capital $60M · liquidity buffer $45M`;
  };
  const renderScenarioFan = () => {
    const times = ['Today', '1 week', '1 month', '3 months', '6 months'];
    const left = 62;
    const right = 796;
    const top = 22;
    const bottom = 201;
    const xAt = (index) => left + (right - left) * index / (times.length - 1);
    const scenarioValues = scenarios.map((scenario) => times.map((_, index) => totalValue - scenarioLossAt(scenario, index)));
    const lowestValue = Math.min(...scenarioValues.flat());
    const minimum = Math.max(0, Math.floor((lowestValue - 5_000_000) / 20_000_000) * 20_000_000);
    const maximum = totalValue;
    const yAt = (value) => bottom - (value - minimum) / (maximum - minimum || 1) * (bottom - top);
    const rangeTop = times.map((_, index) => Math.min(...scenarioValues.map((values) => values[index])));
    const rangeBottom = times.map((_, index) => Math.max(...scenarioValues.map((values) => values[index])));
    const band = `${rangeBottom.map((value, index) => `${index ? 'L' : 'M'} ${xAt(index)} ${yAt(value)}`).join(' ')} ${rangeTop.map((value, reverseIndex) => { const index = rangeTop.length - 1 - reverseIndex; return `L ${xAt(index)} ${yAt(rangeTop[index])}`; }).join(' ')} Z`;
    const gridStep = Math.max(20_000_000, Math.ceil((maximum - minimum) / 4 / 20_000_000) * 20_000_000);
    let grid = '';
    for (let value = Math.ceil(minimum / gridStep) * gridStep; value <= maximum; value += gridStep) {
      const y = yAt(value);
      grid += `<path class="fan-gridline" d="M ${left} ${y} H ${right}"/><text class="fan-axis-label" x="${left - 8}" y="${y + 3}" text-anchor="end">$${(value / 1_000_000).toFixed(0)}M</text>`;
    }
    const scenarioLines = scenarios.map((scenario, scenarioIndex) => {
      const points = scenarioValues[scenarioIndex].map((value, index) => `${index ? 'L' : 'M'} ${xAt(index)} ${yAt(value)}`).join(' ');
      return `<path class="fan-scenario-line" d="${points}" stroke="${scenario.color}"/><circle class="fan-scenario-end" cx="${xAt(times.length - 1)}" cy="${yAt(scenarioValues[scenarioIndex].at(-1))}" r="3.5" fill="${scenario.color}"/>`;
    }).join('');
    const totalProbability = scenarios.reduce((sum, scenario) => sum + scenario.probability, 0) || 1;
    const weightedValues = times.map((_, index) => totalValue - scenarios.reduce((sum, scenario) => sum + scenarioLossAt(scenario, index) * scenario.probability / totalProbability, 0));
    const weightedLine = weightedValues.map((value, index) => `${index ? 'L' : 'M'} ${xAt(index)} ${yAt(value)}`).join(' ');
    const xLabels = times.map((time, index) => `<text class="fan-axis-label" x="${xAt(index)}" y="${bottom + 22}" text-anchor="middle">${time}</text>`).join('');
    document.getElementById('scenario-fan-chart').innerHTML = `${grid}<path class="fan-range" d="${band}"/><path class="fan-weighted-line" d="${weightedLine}"/>${scenarioLines}${xLabels}`;
  };
  const renderScenarioResults = () => {
    const peakIndex = (scenario) => scenario.timeline.indexOf(Math.max(...scenario.timeline));
    scenarios.forEach((scenario) => {
      const peakLoss = scenarioLossAt(scenario, peakIndex(scenario));
      const liquidityDraw = scenario.liquidity * scenario.severity / 100;
      const capitalConsumed = peakLoss / capitalBase * 100;
      document.getElementById(`loss-${scenario.id}`).textContent = money(peakLoss);
      document.getElementById(`liquidity-${scenario.id}`).textContent = money(liquidityDraw);
      document.getElementById(`capital-${scenario.id}`).textContent = `${money(peakLoss)} · ${capitalConsumed.toFixed(0)}%`;
    });
    const totalProbability = scenarios.reduce((sum, scenario) => sum + scenario.probability, 0) || 1;
    const comparisonTime = 3;
    const expectedLoss = scenarios.reduce((sum, scenario) => sum + scenarioLossAt(scenario, comparisonTime) * scenario.probability / totalProbability, 0);
    const afterValue = totalValue - expectedLoss;
    const changePercent = -expectedLoss / totalValue * 100;
    elements.before.textContent = money(totalValue);
    elements.after.textContent = money(afterValue);
    elements.change.textContent = `-${money(expectedLoss)}`;
    elements.changePct.textContent = `${changePercent.toFixed(2)}% of portfolio`;
    elements.scenarioLabel.textContent = 'Probability-weighted · 3 months';
    elements.beforeChart.textContent = money(totalValue);
    elements.afterChart.textContent = money(afterValue);
    elements.beforeBar.style.width = '100%';
    elements.afterBar.style.width = `${Math.max(0, afterValue / totalValue * 100)}%`;
    elements.rows.innerHTML = portfolio.map((asset, assetIndex) => {
      const expectedAssetLoss = scenarios.reduce((sum, scenario) => sum + asset.value * scenario.lossRates[assetIndex] * scenario.severity / 100 * scenario.timeline[comparisonTime] * scenario.probability / totalProbability, 0);
      return `<tr><td>${asset.name}</td><td>${money(asset.value)}</td><td>${(asset.value / totalValue * 100).toFixed(0)}%</td><td class="shock-negative">-${(expectedAssetLoss / asset.value * 100).toFixed(2)}%</td><td>${money(asset.value - expectedAssetLoss)}</td></tr>`;
    }).join('');
    renderScenarioFan();
  };
  const rebalanceProbabilities = (scenarioId, nextValue) => {
    const selected = scenarioById(scenarioId);
    const others = scenarios.filter((scenario) => scenario.id !== scenarioId);
    const remaining = 100 - nextValue;
    const otherTotal = others.reduce((sum, scenario) => sum + scenario.probability, 0);
    selected.probability = nextValue;
    let assigned = 0;
    others.forEach((scenario, index) => {
      const nextProbability = index === others.length - 1
        ? remaining - assigned
        : otherTotal ? Math.round(remaining * scenario.probability / otherTotal) : Math.floor(remaining / others.length);
      scenario.probability = nextProbability;
      assigned += nextProbability;
    });
    updateProbabilityControls();
  };
  const renderContagionGraph = () => {
    const rowCenters = [68, 163, 258];
    const columnXs = { country: 205, industry: 395, borrower: 585, asset: 795 };
    const nodeWidth = 145;
    const nodeHeight = 56;
    const eventCenterY = 163;
    const edges = pathways.map((pathway, index) => {
      const centerY = rowCenters[index];
      const selected = index === selectedPathway ? ' is-selected' : '';
      const firstEdge = `<path class="contagion-edge${selected}" d="M 162 ${eventCenterY} C 180 ${eventCenterY}, 182 ${centerY}, ${columnXs.country} ${centerY}"/>`;
      const middleEdges = [['country', 'industry'], ['industry', 'borrower'], ['borrower', 'asset']].map(([from, to]) => {
        const startX = columnXs[from] + nodeWidth;
        const endX = columnXs[to];
        return `<path class="contagion-edge${selected}" d="M ${startX} ${centerY} L ${endX} ${centerY}"/>`;
      }).join('');
      const lossX = (columnXs.borrower + nodeWidth + columnXs.asset) / 2;
      return `${firstEdge}${middleEdges}<text class="contagion-edge-loss${selected}" x="${lossX}" y="${centerY - 9}" text-anchor="middle">${lossMoney(pathway.loss)}</text>`;
    }).join('');
    const nodes = pathways.map((pathway, index) => {
      const centerY = rowCenters[index];
      const selected = index === selectedPathway ? ' is-selected' : '';
      return ['country', 'industry', 'borrower', 'asset'].map((column) => {
        const [title, subtitle] = pathway[column];
        const direct = column === 'borrower' || column === 'asset';
        const x = columnXs[column];
        const y = centerY - nodeHeight / 2;
        const nodeAriaLabel = `${title}; select ${pathway.title}`;
        return `<g class="contagion-node ${direct ? 'direct' : 'indirect'}${selected}" data-pathway="${index}" role="button" tabindex="0" aria-pressed="${index === selectedPathway}" aria-label="${nodeAriaLabel}"><rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="4"/><text class="contagion-node-title" x="${x + 10}" y="${y + 23}">${title}</text><text class="contagion-node-subtitle" x="${x + 10}" y="${y + 41}">${subtitle}</text></g>`;
      }).join('');
    }).join('');
    const eventNode = `<g class="contagion-node event-node" data-pathway="0" role="button" tabindex="0" aria-label="Shipping blockade event; select a pathway"><rect x="12" y="${eventCenterY - nodeHeight / 2}" width="150" height="${nodeHeight}" rx="4"/><text class="contagion-node-title" x="22" y="${eventCenterY - 3}">Shipping blockade</text><text class="contagion-node-subtitle" x="22" y="${eventCenterY + 15}">Geopolitical event</text></g>`;
    elements.contagionGraph.innerHTML = `<defs><marker id="contagion-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#c2c9c3"/></marker></defs><text class="contagion-column-label" x="12" y="18">EVENT</text><text class="contagion-column-label" x="205" y="18">COUNTRY / ROUTE</text><text class="contagion-column-label" x="395" y="18">INDUSTRY / SHOCK</text><text class="contagion-column-label" x="585" y="18">BORROWER</text><text class="contagion-column-label" x="795" y="18">BANK INSTRUMENT</text><g class="contagion-edges">${edges}</g>${eventNode}${nodes}`;
  };
  const selectContagionPathway = (index) => {
    selectedPathway = index;
    const pathway = pathways[index];
    elements.contagionTitle.textContent = pathway.title;
    elements.contagionNarrative.textContent = pathway.narrative;
    elements.contagionLoss.textContent = lossMoney(pathway.loss);
    elements.contagionExposure.textContent = money(pathway.exposure);
    elements.contagionBreakdown.innerHTML = pathways.map((item, pathwayIndex) => `<li class="${pathwayIndex === index ? 'current' : ''}"><span>${item.title}</span><b>${lossMoney(item.loss)}</b></li>`).join('');
    renderContagionGraph();
  };
  elements.contagionGraph.addEventListener('click', (event) => {
    const node = event.target.closest('[data-pathway]');
    if (node) selectContagionPathway(Number(node.dataset.pathway));
  });
  elements.contagionGraph.addEventListener('keydown', (event) => {
    const node = event.target.closest('[data-pathway]');
    if (node && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      selectContagionPathway(Number(node.dataset.pathway));
    }
  });
  elements.contagionTotal.textContent = `$${(totalPathwayLoss / 1_000_000).toFixed(2)}M`;
  selectContagionPathway(selectedPathway);

  const runStressTest = (scenarioId = elements.scenario.value, signal = activeSignal) => {
    activeSignal = signal;
    elements.scenario.value = scenarioById(scenarioId) ? scenarioId : 'contained';
    updateProbabilityControls();
    renderScenarioResults();
    elements.sourceNote.textContent = signal ? `${signal.event.classification} event · ${signal.company.name} · ${new Date(signal.timestamp).toLocaleTimeString()}` : 'Probability-weighted scenario comparison';
    elements.live.classList.toggle('triggered', Boolean(signal));
    elements.live.querySelector('span').textContent = signal ? `Scenarios triggered · impact ${signal.impact.score}/10` : 'Waiting for a qualifying event';
    elements.contagionTrigger.textContent = signal
      ? `Live NLP trigger · ${signal.event.classification} · ${signal.company.name} · impact ${signal.impact.score}/10; showing illustrative shipping-blockade pathways`
      : 'Shipping blockade · illustrative event path';
  };

  scenarioExplorer.addEventListener('input', (event) => {
    const { probability, severity } = event.target.dataset;
    if (probability) rebalanceProbabilities(probability, Number(event.target.value));
    if (severity) {
      scenarioById(severity).severity = Number(event.target.value);
      updateProbabilityControls();
    }
    renderScenarioResults();
  });
  elements.scenario.addEventListener('change', () => runStressTest(elements.scenario.value));
  elements.run.addEventListener('click', () => runStressTest(elements.scenario.value));
  document.getElementById('scenario-reset').addEventListener('click', () => {
    scenarios.forEach((scenario, index) => Object.assign(scenario, scenarioDefaults[index]));
    runStressTest('contained');
  });
  runStressTest('contained');

  const pollSignals = async () => {
    try {
      const response = await fetch('/api/v1/signals/recent?limit=20', { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const result = await response.json();
      const signal = result.data?.find((item) => item.event.classification === 'Geopolitical' && item.impact.score > 7 && item.signal_id !== lastSignalId);
      if (!signal) return;
      lastSignalId = signal.signal_id;
      runStressTest('escalation', signal);
    } catch {
      // The prototype remains usable when the API is not running alongside the page.
    }
  };

  pollSignals();
  window.setInterval(pollSignals, 15_000);
})();