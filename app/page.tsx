'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';

// Visualization descriptions for the Insight Box
const VIZ_DESCRIPTIONS: Record<string, { title: string; text: string }> = {
  graph: {
    title: "Network Theory",
    text: "You are seeing an Erdős–Rényi random graph. Particles represent nodes, and lines represent edges. The gentle float simulates the dynamic nature of social or data networks."
  },
  orbit: {
    title: "Orbital Mechanics",
    text: "Particles are arranged in concentric rings using polar coordinates (r, θ). This visualizes Keplerian orbits or electron shells in physics."
  },
  matrix: {
    title: "Linear Algebra",
    text: "A structured 3D lattice representing a Vector Space. The wave motion distorts the grid, visualizing a linear transformation or vector field manipulation."
  },
  threebody: {
    title: "The Three-Body Problem",
    text: "Three distinct gravitational clusters interact chaotically. While the system appears stable, small perturbations can lead to unpredictable trajectories."
  },
  lorenz: {
    title: "The Lorenz Attractor",
    text: "A visualization of the 'Butterfly Effect'. Points follow differential equations (dx/dt, dy/dt). They orbit two strange attractors, never repeating the same path twice."
  },
  neural: {
    title: "Multi-Layer Perceptron",
    text: "A visualization of Deep Learning. Particles form Input, Hidden, and Output layers. The passing 'Pulse' represents the Forward Pass of data tensors through the network."
  },
  quant: {
    title: "Monte Carlo Simulation",
    text: "Geometric Brownian Motion. Each particle trace represents a possible future price path of an asset, fanning out as time (and uncertainty/volatility) increases."
  },
  nash: {
    title: "Nash Equilibrium",
    text: "A Hyperbolic Paraboloid (Saddle Point). In Game Theory, this represents the Minimax solution where one player minimizes loss while the other maximizes gain."
  },
  // NEW VIZ MODES
  golden: {
    title: "The Golden Ratio",
    text: "Phyllotaxis Optimization. Nature uses the ratio φ (1.618...) to pack seeds efficiently. Each particle is placed at 137.5° from the previous one."
  },
  topology: {
    title: "Topology",
    text: "The Klein Bottle. A non-orientable surface that has no distinct 'inside' or 'outside'. It demonstrates how space can be twisted and reconnected in higher dimensions."
  },
  calculus: {
    title: "Calculus & Motion",
    text: "Riemann Surface. A Helicoid surface representing multi-valued functions in complex analysis. It visualizes the geometry of smooth, continuous change."
  },
  series: {
    title: "Fourier Series",
    text: "Spherical Harmonics. Complex resonant states on a sphere. This shows how overlapping frequencies (Series) create intricate 3D interference patterns."
  }
};

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [vizMode, setVizMode] = useState('graph');
  const [insight, setInsight] = useState(VIZ_DESCRIPTIONS['graph']);
  const [isUpdatingInsight, setIsUpdatingInsight] = useState(false);
  const [isOverlayMinimized, setIsOverlayMinimized] = useState(false);

  // Auto-minimize overlay on mobile after generic interaction or time
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleScroll = () => {
      // Only minimize on mobile/small screens if needed, or generally
      if (window.innerWidth < 768) {
        setIsOverlayMinimized(true);
      }
    };

    // Initial timer
    timeout = setTimeout(() => {
      if (window.innerWidth < 768) setIsOverlayMinimized(true);
    }, 5000);

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeout);
    };
  }, []);

  // Configuration Ref to share state with Three.js loop without re-renders
  const configRef = useRef({
    particleCount: 1200, // Will be adjusted in useEffect based on window
    connectionDistance: 3.5,
    baseSpeed: 0.002,
    color: new THREE.Color(0xD4AF37),
    white: new THREE.Color(0xFFFFFF),
    mode: 'graph'
  });

  // Handle Mode Switching and Insight Animation
  const changeVizMode = (mode: string) => {
    setVizMode(mode);
    configRef.current.mode = mode;

    setIsUpdatingInsight(true);
    setTimeout(() => {
      setInsight(VIZ_DESCRIPTIONS[mode]);
      setIsUpdatingInsight(false);
    }, 500);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // SCENE SETUP
    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.02);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 25;
    camera.position.y = 8;
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // STATE VARIABLES
    let particles: THREE.Points;
    let linesMesh: THREE.LineSegments;
    let animationId: number;
    let mouse = new THREE.Vector2();
    const isMobile = window.innerWidth < 768;

    configRef.current.particleCount = isMobile ? 800 : 1500;

    // TARGET POSITIONS
    const targets = {
      graph: [] as number[], orbit: [] as number[], matrix: [] as number[], threebody: [] as number[],
      neural: [] as number[], quant: [] as number[], nash: [] as number[], lorenz: [] as number[],
      golden: [] as number[], topology: [] as number[], calculus: [] as number[], series: [] as number[]
    };

    // INITIALIZATION
    const createParticles = () => {
      const pCount = configRef.current.particleCount;
      const particleGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(pCount * 3);
      const colors = new Float32Array(pCount * 3);

      let lx = 0.1, ly = 0, lz = 0;
      const sigma = 10, rho = 28, beta = 8 / 3, dt = 0.01;

      for (let i = 0; i < pCount; i++) {
        // 1. Graph (Cloud)
        const x = (Math.random() - 0.5) * 40;
        const y = (Math.random() - 0.5) * 40;
        const z = (Math.random() - 0.5) * 20;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        targets.graph.push(x, y, z);

        // Color Initialization
        const isGold = Math.random() > 0.6;
        const color = isGold ? configRef.current.color : configRef.current.white;
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        // 2. Orbit (Rings)
        const orbitAngle = Math.random() * Math.PI * 2;
        const ring = Math.floor(Math.random() * 3);
        const baseRad = 6 + (ring * 5);
        const ringRad = baseRad + (Math.random() - 0.5) * 2;
        targets.orbit.push(Math.cos(orbitAngle) * ringRad, (Math.random() - 0.5) * 2, Math.sin(orbitAngle) * ringRad);

        // 3. Matrix (Grid)
        const spacing = 3.5;
        const mx = ((i % 15) - 7) * spacing;
        const my = ((Math.floor(i / 15) % 15) - 7) * spacing;
        const mz = ((Math.floor(i / 225)) - 2) * spacing;
        targets.matrix.push(mx, my, mz);

        // 4. Three Body (Clusters)
        const clusterIdx = i % 3;
        const tAngle = Math.random() * Math.PI * 2;
        const tRad = Math.random() * 4;
        if (clusterIdx === 0) { targets.threebody.push(-12 + Math.cos(tAngle) * tRad, Math.sin(tAngle) * tRad, 0); }
        else if (clusterIdx === 1) { targets.threebody.push(12 + Math.cos(tAngle) * tRad, Math.sin(tAngle) * tRad, 0); }
        else { targets.threebody.push(Math.cos(tAngle) * (tRad + 10), 12 + Math.sin(tAngle) * tRad, Math.sin(tAngle) * 5); }

        // 5. Neural (Layers)
        const layer = i % 5;
        const layerX = (layer - 2) * 7;
        const layerY = (Math.random() - 0.5) * 16;
        const layerZ = (Math.random() - 0.5) * 16;
        targets.neural.push(layerX, layerY, layerZ);

        // 6. Quant (Fan)
        const quantX = ((i / pCount) * 45) - 20;
        const timeRatio = (quantX + 20) / 45;
        const volatility = Math.pow(timeRatio, 1.5) * 18;
        const pathOffset = (Math.random() - 0.5) * volatility;
        targets.quant.push(quantX, pathOffset + (timeRatio * 8), (Math.random() - 0.5) * (volatility + 2));

        // 7. Nash (Saddle)
        const saddleRange = 12;
        const sx = (Math.random() - 0.5) * 2 * saddleRange;
        const sz = (Math.random() - 0.5) * 2 * saddleRange;
        const sy = (sx * sx - sz * sz) * 0.08;
        targets.nash.push(sx, sy, sz);

        // 8. Lorenz
        const dx = sigma * (ly - lx) * dt;
        const dy = (lx * (rho - lz) - ly) * dt;
        const dz = (lx * ly - beta * lz) * dt;
        lx += dx; ly += dy; lz += dz;
        targets.lorenz.push(lx * 0.8, ly * 0.8, (lz - 25) * 0.8);

        // 9. Golden Ratio (Phyllotaxis)
        // angle = i * 137.5 deg, r = c * sqrt(n)
        const phi = 137.5 * (Math.PI / 180);
        const theta = i * phi;
        const radius = 0.5 * Math.sqrt(i);
        targets.golden.push(Math.cos(theta) * radius, (i / pCount) * 10 - 5, Math.sin(theta) * radius);

        // 10. Topology (Klein Bottle - Figure 8 Immersion)
        // u in [0, 2pi], v in [0, 2pi]
        const u = (i / pCount) * Math.PI * 2;
        const v = (i % 50) * (Math.PI * 2 / 50);
        const r = 3;

        const cosU = Math.cos(u), sinU = Math.sin(u);
        const cosU2 = Math.cos(u / 2), sinU2 = Math.sin(u / 2);
        const cosV = Math.cos(v), sinV = Math.sin(v);
        const sin2V = Math.sin(2 * v);

        // Figure-8 Klein Bottle equations
        const kx = (r + cosU2 * sinV - sinU2 * sin2V) * cosU;
        const ky = (r + cosU2 * sinV - sinU2 * sin2V) * sinU;
        const kz = sinU2 * sinV + cosU2 * sin2V;

        targets.topology.push(kx * 4, ky * 4, kz * 4);

        // 11. Calculus (Riemann Surface - Helicoid)
        // x = r cos(v), y = r sin(v), z = v
        // u = r (radius), v = theta (angle)
        const cU = (i / pCount) * 10 - 5; // Radius range
        const cV = (i % 50) * 0.2 * Math.PI; // Angle

        const hx = cU * Math.cos(cV);
        const hy = cU * Math.sin(cV);
        const hz = cV / 2 - 5; // Height scaled

        targets.calculus.push(hx * 2, hy * 2, hz * 2);

        // 12. Series (Spherical Harmonics)
        // r = |Y(theta, phi)|^2 or similar
        // r = constant + amplitude * sin(m*theta) * sin(n*phi)
        const sTheta = Math.random() * Math.PI * 2;
        const sPhi = Math.acos(2 * Math.random() - 1);
        const sR = 10 + 5 * Math.sin(6 * sTheta) * Math.cos(5 * sPhi);
        targets.series.push(
          sR * Math.sin(sPhi) * Math.cos(sTheta),
          sR * Math.sin(sPhi) * Math.sin(sTheta),
          sR * Math.cos(sPhi)
        );
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const sprite = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/disc.png');

      const particleMaterial = new THREE.PointsMaterial({
        size: 0.25, vertexColors: true, map: sprite, alphaTest: 0.5,
        transparent: true, opacity: 0.85, sizeAttenuation: true
      });

      particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);
    };

    const createLines = () => {
      const linesGeometry = new THREE.BufferGeometry();
      const linesMaterial = new THREE.LineBasicMaterial({
        color: 0xD4AF37, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending
      });
      linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
      scene.add(linesMesh);
    };

    // UPDATE LOOPS
    const updateLines = () => {
      const mode = configRef.current.mode;
      if (mode === 'lorenz' || mode === 'quant' || mode === 'series' || mode === 'topology' || mode === 'calculus') {
        linesMesh.visible = false;
        return;
      }

      linesMesh.visible = true;
      const positions = particles.geometry.attributes.position.array as Float32Array;
      const linePositions = [];
      const checkLimit = isMobile ? 15 : 40;
      const limit = configRef.current.particleCount;
      const step = isMobile ? 3 : 2;

      for (let i = 0; i < limit; i += step) {
        for (let j = i + 1; j < Math.min(i + checkLimit, limit); j++) {
          const dx = positions[i * 3] - positions[j * 3];
          const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
          const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
          const distSq = dx * dx + dy * dy + dz * dz;

          let threshold = 12;
          if (mode === 'neural') threshold = 30;
          if (mode === 'nash') threshold = 8;
          if (mode === 'matrix') threshold = 14;

          if (distSq < threshold) {
            linePositions.push(
              positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
              positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
            );
          }
        }
      }
      linesMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    };

    const onMouseMove = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    const onWindowResize = () => {
      if (!camera || !renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const positions = particles.geometry.attributes.position.array as Float32Array;
      const colors = particles.geometry.attributes.color.array as Float32Array;
      const time = Date.now() * 0.001;
      const mode = configRef.current.mode;

      camera.position.x += (mouse.x * 3 - camera.position.x) * 0.05;
      camera.position.y += (mouse.y * 3 + 10 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      // Rotation
      if (['lorenz', 'nash', 'orbit'].includes(mode)) {
        particles.rotation.y = time * 0.1; linesMesh.rotation.y = time * 0.1;
      } else {
        particles.rotation.y = 0; linesMesh.rotation.y = 0;
      }

      // Neural Pulse
      if (mode === 'neural') {
        const waveSpeed = 4;
        const wavePos = ((time * waveSpeed) % 40) - 20;
        for (let i = 0; i < configRef.current.particleCount; i++) {
          const i3 = i * 3;
          const x = positions[i3];
          const dist = Math.abs(x - wavePos);
          const glow = Math.exp(- (dist * dist) / 10);
          colors[i3] = 0.83 + (0.17 * glow);
          colors[i3 + 1] = 0.68 + (0.32 * glow);
          colors[i3 + 2] = 0.21 + (0.79 * glow);
        }
        particles.geometry.attributes.color.needsUpdate = true;
      }

      // Universal Rotation Reset & Logic
      // Default: Reset all to 0 first
      particles.rotation.set(0, 0, 0);
      linesMesh.rotation.set(0, 0, 0);

      // Apply specific rotations per mode
      if (['lorenz', 'nash', 'orbit'].includes(mode)) {
        particles.rotation.y = time * 0.1;
        linesMesh.rotation.y = time * 0.1;
      } else if (mode === 'topology') {
        particles.rotation.y = time * 0.1;
        particles.rotation.x = time * 0.1;
        // No lines for topology
      } else if (mode === 'calculus') {
        particles.rotation.z = time * 0.1;
        // No lines for calculus
      } else if (mode === 'series') {
        particles.rotation.y = time * 0.2;
        // No lines for series
      } else if (mode === 'limitless') {
        // Keep if we revert, or for legacy safety
        particles.rotation.y = time * 0.05;
        particles.rotation.x = time * 0.05;
      }

      // Movement
      for (let i = 0; i < configRef.current.particleCount; i++) {
        const i3 = i * 3;
        let tx = 0, ty = 0, tz = 0;

        // Note: In a real refactor, use a map or switch, but maintaining provided logic structure
        if (mode === 'graph') {
          tx = targets.graph[i3]; ty = targets.graph[i3 + 1]; tz = targets.graph[i3 + 2];
        } else if (mode === 'orbit') {
          tx = targets.orbit[i3]; ty = targets.orbit[i3 + 1] + Math.sin(time * 2 + i) * 1.5; tz = targets.orbit[i3 + 2];
        } else if (mode === 'matrix') {
          tx = targets.matrix[i3]; ty = targets.matrix[i3 + 1] + Math.sin(time + tx * 0.3) * 2; tz = targets.matrix[i3 + 2];
        } else if (mode === 'threebody') {
          tx = targets.threebody[i3] + Math.sin(time * 2 + i) * 2;
          ty = targets.threebody[i3 + 1] + Math.cos(time * 1.5 + i) * 2;
          tz = targets.threebody[i3 + 2] + Math.sin(time + i) * 2;
        } else if (mode === 'neural') {
          tx = targets.neural[i3]; ty = targets.neural[i3 + 1]; tz = targets.neural[i3 + 2];
        } else if (mode === 'quant') {
          tx = targets.quant[i3]; ty = targets.quant[i3 + 1] + Math.sin(time * 2 + tx * 0.1) * 2; tz = targets.quant[i3 + 2];
        } else if (mode === 'nash') {
          tx = targets.nash[i3]; ty = targets.nash[i3 + 1]; tz = targets.nash[i3 + 2];
        } else if (mode === 'lorenz') {
          tx = targets.lorenz[i3]; ty = targets.lorenz[i3 + 1]; tz = targets.lorenz[i3 + 2];
        } else if (mode === 'golden') {
          tx = targets.golden[i3]; ty = targets.golden[i3 + 1]; tz = targets.golden[i3 + 2];
        } else if (mode === 'topology') {
          tx = targets.topology[i3]; ty = targets.topology[i3 + 1]; tz = targets.topology[i3 + 2];
        } else if (mode === 'calculus') {
          tx = targets.calculus[i3]; ty = targets.calculus[i3 + 1]; tz = targets.calculus[i3 + 2];
        } else if (mode === 'series') {
          tx = targets.series[i3]; ty = targets.series[i3 + 1]; tz = targets.series[i3 + 2];
        }

        positions[i3] += (tx - positions[i3]) * 0.04;
        positions[i3 + 1] += (ty - positions[i3 + 1]) * 0.04;
        positions[i3 + 2] += (tz - positions[i3 + 2]) * 0.04;
      }

      particles.geometry.attributes.position.needsUpdate = true;
      updateLines();
      renderer.render(scene, camera);
    };

    // EXECUTE
    createParticles();
    createLines();
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousemove', onMouseMove);
    animate();

    return () => {
      window.removeEventListener('resize', onWindowResize);
      document.removeEventListener('mousemove', onMouseMove);
      if (containerRef.current && renderer) {
        containerRef.current.removeChild(renderer.domElement);
      }
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <>
      <div ref={containerRef} id="canvas-container" className="fixed top-0 left-0 w-full h-full -z-10 bg-math-black" />

      {/* Navigation */}
      <nav className="fixed w-full z-50 top-0 left-0 border-b border-white/10 bg-math-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              {/* Logo Image with Blend Mode to remove white background */}
              <div className="w-10 h-10 relative overflow-hidden rounded-full mr-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/ttc-logo.png"
                  alt="The Turing Circle"
                  className="w-full h-full object-cover mix-blend-screen scale-110"
                />
              </div>
              <span className="font-serif text-2xl font-bold tracking-wide text-white">THE TURING CIRCLE</span>
            </div>
            <div className="flex items-center gap-4">
              {/* Mobile: Join Club Button Visible */}
              <a href="https://theturingcircle.vercel.app/" target="_blank" className="md:hidden btn-gold px-3 py-1.5 text-xs rounded-sm uppercase">Join</a>

              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-8 text-sm font-medium tracking-widest uppercase">
                  <a href="#home" className="nav-link text-white hover:text-math-gold px-3 py-2 transition-colors">Home</a>
                  <a href="#manifesto" className="nav-link text-white/70 hover:text-math-gold px-3 py-2 transition-colors">Manifesto</a>
                  <a href="#research" className="nav-link text-white/70 hover:text-math-gold px-3 py-2 transition-colors">Foundations</a>
                  <a href="#domains" className="nav-link text-white/70 hover:text-math-gold px-3 py-2 transition-colors">Domains</a>
                  <a href="https://theturingcircle.vercel.app/" target="_blank" className="btn-gold px-4 py-2 rounded-sm uppercase">Join Club</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Insight Overlay */}
      <div className="fixed bottom-4 left-4 right-4 z-40 md:right-8 md:bottom-8 md:w-auto md:left-auto md:max-w-sm">
        <motion.div
          className="glass-panel p-4 md:p-6 border-l-2 border-l-math-gold bg-black/20 backdrop-blur-md cursor-pointer"
          onClick={() => setIsOverlayMinimized(!isOverlayMinimized)}
          animate={{
            opacity: isUpdatingInsight ? 0 : (isOverlayMinimized ? 0.6 : 1),
            y: isUpdatingInsight ? 10 : (isOverlayMinimized ? 120 : 0),
            scale: isOverlayMinimized ? 0.9 : 1
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <h4 className="text-math-gold font-serif text-lg italic mb-2">{insight.title}</h4>
          <p className="text-xs text-gray-300 leading-relaxed">{insight.text}</p>
          <div className="mt-3 flex gap-2 items-center">
            <div className="w-2 h-2 rounded-full bg-math-gold animate-pulse"></div>
            <span className="text-[10px] uppercase tracking-widest text-white/50">Live Render</span>
          </div>
        </motion.div>
      </div>

      <main className="relative z-10 pt-20">

        {/* Helper Comps for Console Buttons */}
        <div className="hidden">
          {/* Tailwind Classes Generator for dynamically used colors since we can't rely on JIT fully in pure string interpolation sometimes without safelist, but here we use standard classes */}
        </div>

        {/* Hero Section */}
        <section id="home" className="min-h-screen flex items-center justify-center relative">
          <div className="text-center px-4 max-w-6xl mx-auto">
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}
              className="font-sans text-math-gold tracking-[0.3em] uppercase text-xs md:text-sm mb-4"
            >
              The Language of the Universe
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2 }}
              className="font-serif text-5xl md:text-7xl lg:text-8xl font-thin leading-tight mb-8"
            >
              The Geometry of <br />
              <span className="italic text-math-gold-light">Thought</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.4 }}
              className="text-white/60 text-lg md:text-xl font-light mb-12 max-w-2xl mx-auto"
            >
              Visualizing the invisible structures that govern reality.
            </motion.p>

            {/* Foundation Controls */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }}
              className="inline-block"
            >
              <div className="flex flex-wrap gap-4 justify-center items-center">
                {['graph', 'orbit', 'matrix', 'threebody', 'lorenz'].map((m) => (
                  <button
                    key={m}
                    onClick={() => changeVizMode(m)}
                    className={`relative bg-black/40 border px-5 py-3 font-sans text-xs uppercase tracking-widest transition-all duration-300 w-32 flex items-center justify-center gap-2 overflow-hidden
                                    ${vizMode === m ? 'border-math-gold text-white bg-math-gold/10' : 'border-white/15 text-white/70 hover:border-math-gold hover:text-white'}
                                `}
                  >
                    <span className={`absolute left-0 top-0 w-0.5 h-full bg-math-gold transition-transform duration-300 ${vizMode === m ? 'scale-y-100' : 'scale-y-0'}`}></span>
                    {m === 'threebody' ? '3-Body' : m === 'lorenz' ? 'Chaos' : m}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[10px] uppercase tracking-widest text-white/30">Foundations Console</p>
            </motion.div>
          </div>
        </section>

        {/* Manifesto */}
        <section id="manifesto" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="font-serif text-4xl text-math-gold mb-6">The Map of Mathematics</h2>
                <div className="w-16 h-1 bg-math-gold mb-8"></div>
                <p className="text-gray-300 font-light leading-relaxed mb-6">
                  Mathematics is not just equations; it&apos;s a vast landscape of interconnected ideas. Inspired by Quanta Magazine&apos;s visualizations, we aim to map these territories.
                </p>
                <p className="text-gray-300 font-light leading-relaxed">
                  From the rigid structures of <strong className="text-white">Algebra</strong> to the fluid deformations of <strong className="text-white">Topology</strong>, we explore the nexus where these fields meet art and technology.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { symbol: 'φ', label: 'Golden Ratio', mode: 'golden' },
                  { symbol: 'τ', label: 'Topology', mode: 'topology' },
                  { symbol: '∫', label: 'Calculus', mode: 'calculus' },
                  { symbol: 'Σ', label: 'Series', mode: 'series' }
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => changeVizMode(item.mode)}
                    className="glass-panel p-6 text-center border border-math-gold/20 bg-black/20 backdrop-blur-sm hover:border-math-gold transition-colors w-full"
                  >
                    <div className="text-3xl font-serif text-math-gold mb-2">{item.symbol}</div>
                    <div className="text-xs uppercase tracking-widest text-white/60">{item.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Research (Foundations Cards) */}
        <section id="research" className="py-24 bg-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="font-serif text-4xl text-white mb-4">Core Foundations</h2>
              <p className="text-white/50 font-mono text-sm">/root/simulations/foundations</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Dynamical Systems */}
              <div className="glass-panel p-8 group cursor-pointer border border-white/10 hover:border-math-gold/50 bg-black/20 transition-all" onClick={() => changeVizMode('threebody')}>
                <div className="h-24 mb-6 border border-white/10 bg-black/10 relative overflow-hidden flex items-center justify-center">
                  <div className="w-12 h-12 border border-math-gold rounded-full animate-[spin_8s_linear_infinite] opacity-50 group-hover:opacity-100"></div>
                </div>
                <h3 className="text-lg font-serif text-white mb-2 group-hover:text-math-gold transition-colors">Dynamical Systems</h3>
              </div>

              {/* Random Graphs */}
              <div className="glass-panel p-8 group cursor-pointer border border-white/10 hover:border-math-gold/50 bg-black/20 transition-all" onClick={() => changeVizMode('graph')}>
                <div className="h-24 mb-6 border border-white/10 bg-black/10 relative overflow-hidden flex items-center justify-center">
                  <div className="flex gap-1 opacity-50 group-hover:opacity-100">
                    <div className="w-1 h-8 bg-math-gold/50"></div>
                    <div className="w-1 h-5 bg-white/50"></div>
                    <div className="w-1 h-10 bg-math-gold/50"></div>
                  </div>
                </div>
                <h3 className="text-lg font-serif text-white mb-2 group-hover:text-math-gold transition-colors">Random Graphs</h3>
              </div>

              {/* Cellular Automata */}
              <div className="glass-panel p-8 group cursor-pointer border border-white/10 hover:border-math-gold/50 bg-black/20 transition-all" onClick={() => changeVizMode('matrix')}>
                <div className="h-24 mb-6 border border-white/10 bg-black/10 relative overflow-hidden flex items-center justify-center">
                  <div className="grid grid-cols-4 gap-1 opacity-50 group-hover:opacity-100">
                    <div className="w-1 h-1 bg-white"></div><div className="w-1 h-1 bg-math-gold"></div>
                    <div className="w-1 h-1 bg-white"></div><div className="w-1 h-1 bg-white"></div>
                    <div className="w-1 h-1 bg-math-gold"></div><div className="w-1 h-1 bg-white"></div>
                  </div>
                </div>
                <h3 className="text-lg font-serif text-white mb-2 group-hover:text-math-gold transition-colors">Cellular Automata</h3>
              </div>

              {/* Chaos Theory */}
              <div className="glass-panel p-8 group cursor-pointer border border-white/10 hover:border-math-gold/50 bg-black/20 transition-all" onClick={() => changeVizMode('lorenz')}>
                <div className="h-24 mb-6 border border-white/10 bg-black/10 relative overflow-hidden flex items-center justify-center">
                  <div className="w-10 h-10 border border-white/30 rounded-[50%_20%_50%_20%] rotate-45 group-hover:border-math-gold transition-colors"></div>
                </div>
                <h3 className="text-lg font-serif text-white mb-2 group-hover:text-math-gold transition-colors">Chaos Theory</h3>
              </div>
            </div>
          </div>
        </section>

        {/* Domains Console */}
        <section id="domains" className="py-32 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <span className="text-math-gold font-mono text-xs uppercase tracking-widest block mb-2">Applied Mathematics</span>
              <h2 className="font-serif text-5xl text-white mb-6">The Domain Console</h2>
              <p className="text-gray-400 max-w-2xl font-light text-lg">
                Where abstract theory meets high-stakes application. Toggle the modules below to visualize our specific domains of study.
              </p>
            </div>

            <div className="bg-transparent border-none p-0 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-1">

                {/* Neural Net */}
                <button onClick={() => changeVizMode('neural')} className="group relative bg-black/20 hover:bg-black/40 backdrop-blur-sm p-8 text-left transition-all border border-white/10 hover:border-math-gold/30 h-48 flex flex-col justify-between overflow-hidden">
                  <div className="flex justify-between items-start z-10 relative">
                    <span className="text-math-gold text-xl font-serif">I.</span>
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                  </div>
                  <div className="z-10 relative">
                    <h3 className="text-white font-bold mb-1 group-hover:text-math-gold transition-colors">Neural Networks</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Machine Learning</p>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-math-gold/50 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                </button>

                {/* Quant */}
                <button onClick={() => changeVizMode('quant')} className="group relative bg-black/20 hover:bg-black/40 backdrop-blur-sm p-8 text-left transition-all border border-white/10 hover:border-math-gold/30 h-48 flex flex-col justify-between overflow-hidden">
                  <div className="flex justify-between items-start z-10 relative">
                    <span className="text-math-gold text-xl font-serif">II.</span>
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                  </div>
                  <div className="z-10 relative">
                    <h3 className="text-white font-bold mb-1 group-hover:text-math-gold transition-colors">Monte Carlo</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Quant Finance</p>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-math-gold/50 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                </button>

                {/* Nash */}
                <button onClick={() => changeVizMode('nash')} className="group relative bg-black/20 hover:bg-black/40 backdrop-blur-sm p-8 text-left transition-all border border-white/10 hover:border-math-gold/30 h-48 flex flex-col justify-between overflow-hidden">
                  <div className="flex justify-between items-start z-10 relative">
                    <span className="text-math-gold text-xl font-serif">III.</span>
                    <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                  </div>
                  <div className="z-10 relative">
                    <h3 className="text-white font-bold mb-1 group-hover:text-math-gold transition-colors">Nash Equilibrium</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Game Theory</p>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-math-gold/50 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                </button>

              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-black py-12 mt-12 text-center md:text-left">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <span className="font-serif text-2xl font-bold text-white">THE TURING CIRCLE</span>
              <p className="text-white/40 text-xs mt-1">Est. 2025</p>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-white/40 hover:text-math-gold text-sm">Discord</a>
              <a href="#" className="text-white/40 hover:text-math-gold text-sm">GitHub</a>
            </div>
          </div>
        </footer>

      </main>
    </>
  );
}
