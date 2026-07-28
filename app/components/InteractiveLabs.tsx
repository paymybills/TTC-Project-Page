'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
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

const LIFE_COLUMNS = 60;
const LIFE_ROWS = 32;
const LIFE_SIZE = LIFE_COLUMNS * LIFE_ROWS;

type LifePreset = 'glider' | 'pulsar' | 'gun' | 'random';

const LIFE_PRESETS: Record<Exclude<LifePreset, 'random'>, Array<[number, number]>> = {
  glider: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  pulsar: [
    [2, 0], [3, 0], [4, 0], [8, 0], [9, 0], [10, 0],
    [0, 2], [5, 2], [7, 2], [12, 2], [0, 3], [5, 3], [7, 3], [12, 3],
    [0, 4], [5, 4], [7, 4], [12, 4], [2, 5], [3, 5], [4, 5], [8, 5], [9, 5], [10, 5],
    [2, 7], [3, 7], [4, 7], [8, 7], [9, 7], [10, 7],
    [0, 8], [5, 8], [7, 8], [12, 8], [0, 9], [5, 9], [7, 9], [12, 9],
    [0, 10], [5, 10], [7, 10], [12, 10], [2, 12], [3, 12], [4, 12], [8, 12], [9, 12], [10, 12],
  ],
  gun: [
    [0, 4], [0, 5], [1, 4], [1, 5], [10, 4], [10, 5], [10, 6],
    [11, 3], [11, 7], [12, 2], [12, 8], [13, 2], [13, 8], [14, 5],
    [15, 3], [15, 7], [16, 4], [16, 5], [16, 6], [17, 5],
    [20, 2], [20, 3], [20, 4], [21, 2], [21, 3], [21, 4],
    [22, 1], [22, 5], [24, 0], [24, 1], [24, 5], [24, 6],
    [34, 2], [34, 3], [35, 2], [35, 3],
  ],
};

function evolveLife(board: Uint8Array, wrapEdges: boolean) {
  const next = new Uint8Array(LIFE_SIZE);
  let changed = false;

  for (let row = 0; row < LIFE_ROWS; row += 1) {
    for (let column = 0; column < LIFE_COLUMNS; column += 1) {
      let neighbors = 0;
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          if (rowOffset === 0 && columnOffset === 0) continue;
          let nextRow = row + rowOffset;
          let nextColumn = column + columnOffset;
          if (wrapEdges) {
            nextRow = (nextRow + LIFE_ROWS) % LIFE_ROWS;
            nextColumn = (nextColumn + LIFE_COLUMNS) % LIFE_COLUMNS;
          } else if (nextRow < 0 || nextRow >= LIFE_ROWS || nextColumn < 0 || nextColumn >= LIFE_COLUMNS) {
            continue;
          }
          if (board[nextRow * LIFE_COLUMNS + nextColumn] > 0) neighbors += 1;
        }
      }

      const index = row * LIFE_COLUMNS + column;
      const alive = board[index] > 0;
      const survives = alive && (neighbors === 2 || neighbors === 3);
      const born = !alive && neighbors === 3;
      next[index] = survives ? Math.min(board[index] + 1, 12) : born ? 1 : 0;
      if ((next[index] > 0) !== alive) changed = true;
    }
  }

  return { board: next, changed };
}

function boardFromPreset(preset: LifePreset, density: number) {
  const board = new Uint8Array(LIFE_SIZE);
  if (preset === 'random') {
    for (let index = 0; index < LIFE_SIZE; index += 1) {
      if (Math.random() * 100 < density) board[index] = 1;
    }
    return board;
  }

  const pattern = LIFE_PRESETS[preset];
  const patternWidth = Math.max(...pattern.map(([column]) => column)) + 1;
  const patternHeight = Math.max(...pattern.map(([, row]) => row)) + 1;
  const offsetColumn = Math.floor((LIFE_COLUMNS - patternWidth) / 2);
  const offsetRow = Math.floor((LIFE_ROWS - patternHeight) / 2);
  pattern.forEach(([column, row]) => {
    board[(row + offsetRow) * LIFE_COLUMNS + column + offsetColumn] = 1;
  });
  return board;
}

export function LifeLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const drawAliveRef = useRef(true);
  const [board, setBoard] = useState(() => boardFromPreset('gun', 25));
  const [isRunning, setIsRunning] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [speed, setSpeed] = useState(120);
  const [density, setDensity] = useState(25);
  const [wrapEdges, setWrapEdges] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [preset, setPreset] = useState<LifePreset>('gun');

  const population = useMemo(
    () => board.reduce((total, cell) => total + (cell > 0 ? 1 : 0), 0),
    [board],
  );
  const oldestCell = useMemo(
    () => board.reduce((oldest, cell) => Math.max(oldest, cell), 0),
    [board],
  );

  const advance = () => {
    const result = evolveLife(board, wrapEdges);
    setBoard(result.board);
    if (!result.changed) {
      setIsRunning(false);
      setStatus(result.board.some(cell => cell > 0) ? 'Stable configuration' : 'Extinct');
    } else {
      setStatus('Evolving');
    }
    setGeneration(current => current + 1);
  };

  const tick = useEffectEvent(advance);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => tick(), speed);
    return () => window.clearInterval(interval);
  }, [isRunning, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const cellWidth = canvas.width / LIFE_COLUMNS;
    const cellHeight = canvas.height / LIFE_ROWS;
    context.fillStyle = '#030303';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = 'rgba(255,255,255,0.045)';
    context.lineWidth = 1;
    context.beginPath();
    for (let column = 0; column <= LIFE_COLUMNS; column += 1) {
      context.moveTo(column * cellWidth, 0);
      context.lineTo(column * cellWidth, canvas.height);
    }
    for (let row = 0; row <= LIFE_ROWS; row += 1) {
      context.moveTo(0, row * cellHeight);
      context.lineTo(canvas.width, row * cellHeight);
    }
    context.stroke();

    board.forEach((age, index) => {
      if (age === 0) return;
      const column = index % LIFE_COLUMNS;
      const row = Math.floor(index / LIFE_COLUMNS);
      const maturity = Math.min(age / 8, 1);
      const red = Math.round(92 + (244 - 92) * maturity);
      const green = Math.round(205 + (196 - 205) * maturity);
      const blue = Math.round(211 + (48 - 211) * maturity);
      context.shadowColor = `rgba(${red},${green},${blue},0.55)`;
      context.shadowBlur = age === 1 ? 9 : 4;
      context.fillStyle = `rgb(${red},${green},${blue})`;
      context.fillRect(
        column * cellWidth + 1.5,
        row * cellHeight + 1.5,
        Math.max(1, cellWidth - 3),
        Math.max(1, cellHeight - 3),
      );
    });
    context.shadowBlur = 0;
  }, [board]);

  const resetWithPreset = (nextPreset: LifePreset) => {
    setPreset(nextPreset);
    setBoard(boardFromPreset(nextPreset, density));
    setGeneration(0);
    setIsRunning(false);
    setStatus('Ready');
  };

  const paintCell = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const column = Math.floor(((clientX - bounds.left) / bounds.width) * LIFE_COLUMNS);
    const row = Math.floor(((clientY - bounds.top) / bounds.height) * LIFE_ROWS);
    if (column < 0 || column >= LIFE_COLUMNS || row < 0 || row >= LIFE_ROWS) return;
    const index = row * LIFE_COLUMNS + column;
    setBoard(current => {
      if ((current[index] > 0) === drawAliveRef.current) return current;
      const next = current.slice();
      next[index] = drawAliveRef.current ? 1 : 0;
      return next;
    });
    setStatus('Edited');
  };

  return (
    <section id="life-lab" className="lab-shell life-lab">
      <div className="lab-header">
        <div className="lab-title-block">
          <span className="lab-index">LAB 02 / EMERGENT SYSTEMS</span>
          <h3>Life, from Four Rules</h3>
          <p>Draw an initial world, release time, and watch local decisions become global structure.</p>
        </div>
        <div className="life-rule">
          <span>Conway&apos;s rule</span>
          <strong>B3 / S23</strong>
        </div>
      </div>

      <div className="life-grid">
        <div className="life-stage">
          <canvas
            ref={canvasRef}
            width="1200"
            height="640"
            aria-label="Interactive Conway's Game of Life grid. Drag to draw or erase cells."
            onPointerDown={event => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const column = Math.floor(((event.clientX - bounds.left) / bounds.width) * LIFE_COLUMNS);
              const row = Math.floor(((event.clientY - bounds.top) / bounds.height) * LIFE_ROWS);
              const index = row * LIFE_COLUMNS + column;
              drawAliveRef.current = !(board[index] > 0);
              isDrawingRef.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              paintCell(event.clientX, event.clientY);
            }}
            onPointerMove={event => {
              if (isDrawingRef.current) paintCell(event.clientX, event.clientY);
            }}
            onPointerUp={event => {
              isDrawingRef.current = false;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              isDrawingRef.current = false;
            }}
          />
          <div className="life-stage-footer">
            <span><i className="life-dot newborn" />Newborn</span>
            <span><i className="life-dot mature" />Survivor</span>
            <span>Drag empty cells to draw. Drag live cells to erase.</span>
          </div>
        </div>

        <div className="lab-controls life-controls">
          <ControlGroup label="Initial condition">
            {(['glider', 'pulsar', 'gun', 'random'] as LifePreset[]).map(item => (
              <button key={item} onClick={() => resetWithPreset(item)} className={preset === item ? 'active' : ''}>
                {item === 'gun' ? 'Gosper gun' : item}
              </button>
            ))}
          </ControlGroup>

          <div className="life-stats">
            <div><span>Generation</span><strong>{generation.toLocaleString()}</strong></div>
            <div><span>Population</span><strong>{population.toLocaleString()}</strong></div>
            <div><span>Oldest cell</span><strong>{oldestCell}</strong></div>
            <div><span>State</span><strong>{isRunning ? 'Running' : status}</strong></div>
          </div>

          <label className="range-label" htmlFor="life-speed">
            Tick interval <strong>{speed} ms</strong>
          </label>
          <input
            id="life-speed"
            type="range"
            min="40"
            max="500"
            step="20"
            value={speed}
            onChange={event => setSpeed(Number(event.target.value))}
          />

          <label className="range-label" htmlFor="life-density">
            Random density <strong>{density}%</strong>
          </label>
          <input
            id="life-density"
            type="range"
            min="5"
            max="60"
            value={density}
            onChange={event => setDensity(Number(event.target.value))}
          />

          <button
            type="button"
            className={`topology-toggle ${wrapEdges ? 'active' : ''}`}
            onClick={() => setWrapEdges(current => !current)}
            aria-pressed={wrapEdges}
          >
            <span>World topology</span>
            <strong>{wrapEdges ? 'Toroidal / wrapped' : 'Bounded edges'}</strong>
          </button>

          <div className="lab-actions">
            <button
              onClick={() => {
                setIsRunning(current => !current);
                setStatus(isRunning ? 'Paused' : 'Evolving');
              }}
            >
              {isRunning ? 'Pause' : 'Run life'}
            </button>
            <button onClick={advance} disabled={isRunning}>Step</button>
          </div>
          <button
            className="life-clear"
            onClick={() => {
              setBoard(new Uint8Array(LIFE_SIZE));
              setGeneration(0);
              setIsRunning(false);
              setStatus('Empty world');
            }}
          >
            Clear world
          </button>

          <p className="lab-note">
            A cell is born with exactly three neighbors and survives with two or three. Everything else here emerges from repeated local updates.
          </p>
        </div>
      </div>
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
