'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Aggregator = 'mean' | 'sum' | 'max';
type Feature = [number, number];

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

const GRAPH_PRESETS = {
  communities: {
    nodes: [
      { x: 120, y: 105 }, { x: 215, y: 75 }, { x: 185, y: 180 },
      { x: 390, y: 140 }, { x: 505, y: 90 }, { x: 525, y: 205 },
      { x: 635, y: 145 },
    ],
    edges: [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [3, 5], [4, 5], [4, 6], [5, 6]],
  },
  ring: {
    nodes: Array.from({ length: 8 }, (_, index) => ({
      x: 375 + Math.cos((index / 8) * Math.PI * 2) * 220,
      y: 150 + Math.sin((index / 8) * Math.PI * 2) * 105,
    })),
    edges: Array.from({ length: 8 }, (_, index) => [index, (index + 1) % 8]),
  },
  bridge: {
    nodes: [
      { x: 90, y: 90 }, { x: 90, y: 210 }, { x: 205, y: 150 },
      { x: 320, y: 150 }, { x: 435, y: 150 },
      { x: 550, y: 90 }, { x: 550, y: 210 }, { x: 665, y: 150 },
    ],
    edges: [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6], [5, 6], [5, 7], [6, 7]],
  },
} as const;

const BASE_FEATURES: Feature[] = [
  [0.95, 0.1], [0.8, 0.25], [0.72, 0.2], [0.5, 0.5],
  [0.18, 0.84], [0.1, 0.95], [0.25, 0.76], [0.62, 0.36],
];

function aggregate(features: Feature[], mode: Aggregator): Feature {
  if (mode === 'max') {
    return [Math.max(...features.map(f => f[0])), Math.max(...features.map(f => f[1]))];
  }
  const total = features.reduce<Feature>((sum, value) => [sum[0] + value[0], sum[1] + value[1]], [0, 0]);
  if (mode === 'sum') return [clamp(total[0] / 2), clamp(total[1] / 2)];
  return [total[0] / features.length, total[1] / features.length];
}

function nodeColor(feature: Feature) {
  const gold = [212, 175, 55];
  const cyan = [92, 205, 211];
  const weight = feature[1] / Math.max(0.001, feature[0] + feature[1]);
  const color = gold.map((channel, index) => Math.round(channel + (cyan[index] - channel) * weight));
  return `rgb(${color.join(',')})`;
}

export function GNNPlayground() {
  const [preset, setPreset] = useState<keyof typeof GRAPH_PRESETS>('communities');
  const [features, setFeatures] = useState<Feature[]>(BASE_FEATURES.slice(0, 7));
  const [aggregator, setAggregator] = useState<Aggregator>('mean');
  const [selected, setSelected] = useState(3);
  const [layer, setLayer] = useState(0);
  const [isPassing, setIsPassing] = useState(false);

  const graph = GRAPH_PRESETS[preset];
  const selectedFeature = features[selected] || [0, 0];
  const spread = useMemo(() => {
    if (!features.length) return 0;
    const mean = features.reduce((sum, item) => sum + item[0], 0) / features.length;
    return features.reduce((sum, item) => sum + Math.abs(item[0] - mean), 0) / features.length;
  }, [features]);

  const changePreset = (next: keyof typeof GRAPH_PRESETS) => {
    setPreset(next);
    setFeatures(BASE_FEATURES.slice(0, GRAPH_PRESETS[next].nodes.length));
    setLayer(0);
    setSelected(0);
  };

  const passMessages = () => {
    if (isPassing) return;
    setIsPassing(true);
    window.setTimeout(() => {
      const next = features.map((feature, index) => {
        const neighbors = graph.edges
          .filter(([a, b]) => a === index || b === index)
          .map(([a, b]) => features[a === index ? b : a]);
        const pooled = aggregate([feature, ...neighbors], aggregator);
        return [
          clamp(sigmoid(pooled[0] * 2.2 - pooled[1] * 0.8) - 0.18),
          clamp(sigmoid(pooled[1] * 2.2 - pooled[0] * 0.8) - 0.18),
        ] as Feature;
      });
      setFeatures(next);
      setLayer(current => current + 1);
      setIsPassing(false);
    }, 650);
  };

  const reset = () => {
    setFeatures(BASE_FEATURES.slice(0, graph.nodes.length));
    setLayer(0);
  };

  return (
    <section id="gnn-lab" className="lab-shell">
      <div className="lab-header">
        <div>
          <span className="lab-index">LAB 01 / GRAPH INTELLIGENCE</span>
          <h3>Message Passing</h3>
        </div>
        <p>Watch each node replace private features with information aggregated from its neighborhood.</p>
      </div>

      <div className="lab-grid">
        <div className="lab-stage">
          <svg viewBox="0 0 750 300" role="img" aria-label="Interactive graph neural network">
            {graph.edges.map(([from, to], index) => {
              const start = graph.nodes[from];
              const end = graph.nodes[to];
              return (
                <g key={`${from}-${to}`}>
                  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="lab-edge" />
                  <AnimatePresence>
                    {isPassing && (
                      <motion.circle
                        key={`pulse-${index}-${layer}`}
                        r="4"
                        fill="#f4c430"
                        initial={{ cx: start.x, cy: start.y, opacity: 0 }}
                        animate={{ cx: end.x, cy: end.y, opacity: [0, 1, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.025 }}
                      />
                    )}
                  </AnimatePresence>
                </g>
              );
            })}
            {graph.nodes.map((node, index) => (
              <g
                key={index}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(index)}
                onKeyDown={event => event.key === 'Enter' && setSelected(index)}
                className="cursor-pointer"
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={selected === index ? 27 : 22}
                  fill={nodeColor(features[index])}
                  stroke={selected === index ? '#fff' : '#151515'}
                  strokeWidth={selected === index ? 3 : 2}
                />
                <text x={node.x} y={node.y + 5} textAnchor="middle" className="lab-node-label">
                  {index + 1}
                </text>
              </g>
            ))}
          </svg>
          <div className="lab-stage-caption">
            <span>Layer {layer}</span>
            <span>Feature spread {spread.toFixed(3)}</span>
            <span>{spread < 0.055 ? 'Over-smoothing detected' : 'Distinct embeddings'}</span>
          </div>
        </div>

        <div className="lab-controls">
          <ControlGroup label="Graph">
            {(Object.keys(GRAPH_PRESETS) as Array<keyof typeof GRAPH_PRESETS>).map(item => (
              <button key={item} onClick={() => changePreset(item)} className={preset === item ? 'active' : ''}>
                {item}
              </button>
            ))}
          </ControlGroup>
          <ControlGroup label="Aggregate">
            {(['mean', 'sum', 'max'] as Aggregator[]).map(item => (
              <button key={item} onClick={() => setAggregator(item)} className={aggregator === item ? 'active' : ''}>
                {item}
              </button>
            ))}
          </ControlGroup>
          <div className="feature-readout">
            <span>Selected node {selected + 1}</span>
            <strong>[{selectedFeature[0].toFixed(2)}, {selectedFeature[1].toFixed(2)}]</strong>
            <div>
              <i style={{ width: `${selectedFeature[0] * 100}%` }} />
              <i style={{ width: `${selectedFeature[1] * 100}%` }} />
            </div>
          </div>
          <div className="lab-actions">
            <button onClick={passMessages} disabled={isPassing}>Pass messages</button>
            <button onClick={reset}>Reset</button>
          </div>
          <p className="lab-note">
            Repeated neighborhood averaging makes embeddings converge. This is over-smoothing: deeper is not automatically more expressive.
          </p>
        </div>
      </div>
    </section>
  );
}

const SIGNALS = ['A', 'B', 'A', 'A', 'B', 'A', 'B', 'A'] as const;
const CASCADE = (() => {
  let publicA = 0;
  let publicB = 0;
  return SIGNALS.map(signal => {
    const social = publicA - publicB;
    const evidence = signal === 'A' ? 1 : -1;
    const decision: 'A' | 'B' = social + evidence >= 0 ? 'A' : 'B';
    if (decision === 'A') publicA += 1;
    else publicB += 1;
    return { signal, decision };
  });
})();

export function CollectiveLab() {
  const [mode, setMode] = useState<'coordination' | 'cascade'>('coordination');
  const [expectation, setExpectation] = useState(62);
  const [choice, setChoice] = useState<'Gold' | 'Cyan' | null>(null);
  const [revealed, setRevealed] = useState(0);

  const goldPayoff = expectation / 25;
  const cyanPayoff = (100 - expectation) / 33.3;
  const recommendation = goldPayoff >= cyanPayoff ? 'Gold' : 'Cyan';

  return (
    <section id="collective-lab" className="lab-shell">
      <div className="lab-header">
        <div>
          <span className="lab-index">LAB 02 / COLLECTIVE BEHAVIOR</span>
          <h3>Beliefs in Public</h3>
        </div>
        <div className="lab-tabs">
          <button onClick={() => setMode('coordination')} className={mode === 'coordination' ? 'active' : ''}>Coordination</button>
          <button onClick={() => setMode('cascade')} className={mode === 'cascade' ? 'active' : ''}>Cascade</button>
        </div>
      </div>

      {mode === 'coordination' ? (
        <div className="collective-grid">
          <div className="coordination-stage">
            <p>You score highly when your choice matches the crowd. Which equilibrium should you select?</p>
            <div className="choice-pair">
              <button onClick={() => setChoice('Gold')} className={choice === 'Gold' ? 'selected gold' : 'gold'}>
                <span>G</span><strong>Gold</strong><small>Expected payoff {goldPayoff.toFixed(1)}</small>
              </button>
              <button onClick={() => setChoice('Cyan')} className={choice === 'Cyan' ? 'selected cyan' : 'cyan'}>
                <span>C</span><strong>Cyan</strong><small>Expected payoff {cyanPayoff.toFixed(1)}</small>
              </button>
            </div>
          </div>
          <div className="lab-controls">
            <label className="range-label" htmlFor="crowd-expectation">
              Expected crowd choosing Gold <strong>{expectation}%</strong>
            </label>
            <input
              id="crowd-expectation"
              type="range"
              min="0"
              max="100"
              value={expectation}
              onChange={event => setExpectation(Number(event.target.value))}
            />
            <div className="equilibrium-readout">
              <span>Best response</span>
              <strong>{recommendation}</strong>
              <p>{choice ? `You chose ${choice}. ` : ''}Expectations can select an equilibrium even when neither option is intrinsically better.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="collective-grid">
          <div className="cascade-stage">
            {CASCADE.map((agent, index) => (
              <div key={index} className={`cascade-agent ${index < revealed ? `revealed decision-${agent.decision}` : ''}`}>
                <span>{index + 1}</span>
                <strong>{index < revealed ? agent.decision : '?'}</strong>
                <small>{index < revealed ? `private ${agent.signal}` : 'hidden'}</small>
              </div>
            ))}
          </div>
          <div className="lab-controls">
            <div className="equilibrium-readout">
              <span>Public sequence</span>
              <strong>{CASCADE.slice(0, revealed).map(item => item.decision).join(' ') || 'No decisions yet'}</strong>
              <p>Agents observe earlier choices, not earlier evidence. Once a lead forms, private disagreement can disappear from public view.</p>
            </div>
            <div className="lab-actions">
              <button onClick={() => setRevealed(value => Math.min(SIGNALS.length, value + 1))} disabled={revealed === SIGNALS.length}>
                Reveal next
              </button>
              <button onClick={() => setRevealed(0)}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="control-group">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}
