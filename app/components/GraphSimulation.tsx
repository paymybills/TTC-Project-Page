'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Configuration ---
const PARTICLE_COUNT = 60000;
const RANGE = 10;
const PARTICLE_SIZE = 0.08;
const TRANSITION_SPEED = 0.02;

export default function GraphSimulation() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [equation, setEquation] = useState('sin(x + t) * cos(y)');
    const [errorVal, setError] = useState('');
    const [isRotating, setIsRotating] = useState(false);

    // Refs to keep track of Three.js objects across renders
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const particlesRef = useRef<THREE.Points | null>(null);
    const animationIdRef = useRef<number | null>(null);

    // Logic Refs
    const currentFunctionRef = useRef<Function | null>(null);
    const isTimeDependentRef = useRef(false);
    const timeRef = useRef(0);

    const initialPositionsRef = useRef<Float32Array | null>(null);
    const startZRef = useRef<Float32Array | null>(null);
    const targetZRef = useRef<Float32Array | null>(null);
    const startColorsRef = useRef<Float32Array | null>(null);
    const targetColorsRef = useRef<Float32Array | null>(null);
    const transitionProgressRef = useRef(1);

    // --- Math Parsing Utilities ---
    const parseEquation = (equationStr: string) => {
        let cleanEq = equationStr.toLowerCase().replace(/\s+/g, '');
        cleanEq = cleanEq.replace(/\^/g, '**');
        cleanEq = cleanEq.replace(/(?<!\d)\.(?!\d)/g, '*'); // Dot product fix

        const mathMap: Record<string, string> = {
            'sin': 'Math.sin', 'cos': 'Math.cos', 'tan': 'Math.tan',
            'asin': 'Math.asin', 'acos': 'Math.acos', 'atan': 'Math.atan',
            'atan2': 'Math.atan2', 'sqrt': 'Math.sqrt', 'cbrt': 'Math.cbrt',
            'abs': 'Math.abs', 'floor': 'Math.floor', 'ceil': 'Math.ceil',
            'round': 'Math.round', 'max': 'Math.max', 'min': 'Math.min',
            'log': 'Math.log', 'ln': 'Math.log', 'log10': 'Math.log10',
            'exp': 'Math.exp', 'pi': 'Math.PI', 'e': 'Math.E'
        };

        const keys = Object.keys(mathMap).sort((a, b) => b.length - a.length);
        keys.forEach(key => {
            const replacement = mathMap[key];
            if (key === 'pi' || key === 'e') {
                const regex = new RegExp(`(?<![a-z])${key}(?![a-z])`, 'g');
                cleanEq = cleanEq.replace(regex, replacement);
            } else {
                const regex = new RegExp(`(?<![a-z])${key}(?=\\()`, 'g');
                cleanEq = cleanEq.replace(regex, replacement);
            }
        });

        try {
            const f = new Function('x', 'y', 't', `return ${cleanEq};`);
            f(1, 1, 0); // Dry run check
            return f;
        } catch (e: any) {
            console.warn("Equation parse warning:", e.message);
            return null;
        }
    };

    const getPastelColor = (t: number, targetColor: THREE.Color) => {
        const r1 = 0.44, g1 = 0.84, b1 = 1.0; // Cyan #70d6ff
        const r2 = 1.0, g2 = 0.6, b2 = 0.8; // Pink #ff99cc
        const r3 = 1.0, g3 = 1.0, b3 = 1.0; // White

        if (t < 0.5) {
            const n = t * 2;
            targetColor.setRGB(r1 + (r2 - r1) * n, g1 + (g2 - g1) * n, b1 + (b2 - b1) * n);
        } else {
            const n = (t - 0.5) * 2;
            targetColor.setRGB(r2 + (r3 - r2) * n, g2 + (g3 - g2) * n, b2 + (b3 - b2) * n);
        }
    };

    const calculateTargetState = (tVal: number) => {
        if (!particlesRef.current || !initialPositionsRef.current || !targetZRef.current || !targetColorsRef.current) return;

        let minZ = Infinity;
        let maxZ = -Infinity;
        const func = currentFunctionRef.current;

        // Calculate Zs
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const x = initialPositionsRef.current[i * 3];
            const y = initialPositionsRef.current[i * 3 + 2];
            let z = 0;
            try {
                if (func) z = func(x, y, tVal);
                if (!isFinite(z)) z = 0;
                if (z > 20) z = 20;
                if (z < -20) z = -20;
            } catch (e) { z = 0; }

            targetZRef.current[i] = z;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }

        // Calculate Colors
        const zRange = (maxZ - minZ) || 1;
        const tempColor = new THREE.Color();

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const z = targetZRef.current[i];
            let tNorm = (z - minZ) / zRange;
            getPastelColor(tNorm, tempColor);

            targetColorsRef.current[i * 3] = tempColor.r;
            targetColorsRef.current[i * 3 + 1] = tempColor.g;
            targetColorsRef.current[i * 3 + 2] = tempColor.b;
        }
    };

    const updateGraph = (eqStr: string) => {
        setError("");
        const func = parseEquation(eqStr);

        if (!func) {
            setError("Invalid syntax");
            return;
        }

        currentFunctionRef.current = func;

        // Check time dependency
        try {
            const v1 = func(1, 1, 0);
            const v2 = func(1, 1, 1);
            isTimeDependentRef.current = Math.abs(v1 - v2) > 0.0001;
        } catch {
            isTimeDependentRef.current = false;
        }

        if (!particlesRef.current) return;

        // Capture current start state
        const posAttr = particlesRef.current.geometry.attributes.position;
        const colAttr = particlesRef.current.geometry.attributes.color;

        if (!startZRef.current || !startColorsRef.current) return;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            startZRef.current[i] = posAttr.array[i * 3 + 1];
            startColorsRef.current[i * 3] = colAttr.array[i * 3];
            startColorsRef.current[i * 3 + 1] = colAttr.array[i * 3 + 1];
            startColorsRef.current[i * 3 + 2] = colAttr.array[i * 3 + 2];
        }

        calculateTargetState(timeRef.current);
        transitionProgressRef.current = 0;
    };


    useEffect(() => {
        if (!containerRef.current) return;

        // SCENE SETUP
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000); // Pure Black for contrast
        scene.fog = new THREE.FogExp2(0x000000, 0.02);
        sceneRef.current = scene;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        camera.position.set(15, 12, 15);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = false;
        controls.autoRotateSpeed = 2.0;
        controlsRef.current = controls;

        const gridHelper = new THREE.GridHelper(20, 20, 0x333333, 0x111111);
        scene.add(gridHelper);

        // PARTICLE SYSTEM
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const colors = new Float32Array(PARTICLE_COUNT * 3);

        // Init Buffers
        initialPositionsRef.current = new Float32Array(PARTICLE_COUNT * 3);
        startZRef.current = new Float32Array(PARTICLE_COUNT);
        targetZRef.current = new Float32Array(PARTICLE_COUNT);
        startColorsRef.current = new Float32Array(PARTICLE_COUNT * 3);
        targetColorsRef.current = new Float32Array(PARTICLE_COUNT * 3);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const x = (Math.random() - 0.5) * 2 * RANGE;
            const y = (Math.random() - 0.5) * 2 * RANGE;
            const z = 0;

            positions[i * 3] = x;
            positions[i * 3 + 1] = z;
            positions[i * 3 + 2] = y;

            colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1;

            initialPositionsRef.current[i * 3] = x;
            initialPositionsRef.current[i * 3 + 2] = y;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: PARTICLE_SIZE,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);
        particlesRef.current = particles;

        // Resize Handler
        const handleResize = () => {
            if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        // Initial Graph
        updateGraph(equation);

        // ANIMATION LOOP
        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);

            timeRef.current += 0.02;
            if (controlsRef.current) controlsRef.current.update();

            const pSys = particlesRef.current;
            if (pSys) {
                const posAttr = pSys.geometry.attributes.position;
                const colAttr = pSys.geometry.attributes.color;

                // Transition Logic
                if (transitionProgressRef.current < 1) {
                    transitionProgressRef.current += TRANSITION_SPEED;
                    if (transitionProgressRef.current > 1) transitionProgressRef.current = 1;

                    const t = transitionProgressRef.current * transitionProgressRef.current * (3 - 2 * transitionProgressRef.current); // easeInOut
                    const sZ = startZRef.current!;
                    const tZ = targetZRef.current!;
                    const sC = startColorsRef.current!;
                    const tC = targetColorsRef.current!;

                    for (let i = 0; i < PARTICLE_COUNT; i++) {
                        const currentZ = sZ[i] + (tZ[i] - sZ[i]) * t;
                        posAttr.setY(i, currentZ);

                        const i3 = i * 3;
                        colAttr.setXYZ(i,
                            sC[i3] + (tC[i3] - sC[i3]) * t,
                            sC[i3 + 1] + (tC[i3 + 1] - sC[i3 + 1]) * t,
                            sC[i3 + 2] + (tC[i3 + 2] - sC[i3 + 2]) * t
                        );
                    }
                    posAttr.needsUpdate = true;
                    colAttr.needsUpdate = true;
                }
                // Continuous Time Update for Time-Dependent Functions
                else if (isTimeDependentRef.current && currentFunctionRef.current) {
                    // Reuse logic but direct write
                    let minZ = Infinity;
                    let maxZ = -Infinity;
                    // Calc Z
                    const func = currentFunctionRef.current;
                    const initPos = initialPositionsRef.current!;

                    for (let i = 0; i < PARTICLE_COUNT; i++) {
                        const x = initPos[i * 3];
                        const y = initPos[i * 3 + 2];
                        let z = 0;
                        try {
                            z = func(x, y, timeRef.current);
                            if (!isFinite(z)) z = 0;
                            if (z > 20) z = 20; if (z < -20) z = -20;
                        } catch { z = 0; }

                        posAttr.setY(i, z);
                        targetZRef.current![i] = z; // Keep target sync for color
                        if (z < minZ) minZ = z;
                        if (z > maxZ) maxZ = z;
                    }

                    // Calc Color
                    const zRange = (maxZ - minZ) || 1;
                    const tempColor = new THREE.Color();
                    for (let i = 0; i < PARTICLE_COUNT; i++) {
                        const z = targetZRef.current![i];
                        const tNorm = (z - minZ) / zRange;
                        getPastelColor(tNorm, tempColor);
                        colAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
                    }
                    posAttr.needsUpdate = true;
                    colAttr.needsUpdate = true;
                }
            }

            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        };
        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
            if (containerRef.current && rendererRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement);
            }
            // Dispose geometries/materials ideally
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // UI Handlers
    const handleGraph = () => updateGraph(equation);

    const handleToggleRotate = () => {
        if (controlsRef.current) {
            controlsRef.current.autoRotate = !controlsRef.current.autoRotate;
            setIsRotating(controlsRef.current.autoRotate);
        }
    };

    const handlePreset = (eq: string) => {
        setEquation(eq);
        updateGraph(eq);
    };

    return (
        <div className="relative w-full h-[600px] rounded-xl overflow-hidden border border-white/10 bg-black/50 backdrop-blur-sm shadow-2xl">
            {/* Canvas Container */}
            <div ref={containerRef} className="absolute inset-0 z-0" />

            {/* Floating UI Panel */}
            <div className="absolute top-4 left-4 z-10 w-80 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-4 shadow-lg text-xs font-mono">
                <h3 className="text-math-gold uppercase tracking-[0.2em] border-b border-white/10 pb-2 mb-3 text-sm font-bold">
                    MosDes <span className="text-white/40 font-thin ml-2">Console</span>
                </h3>

                <div className="mb-4">
                    <label className="block text-white/50 mb-1">z = f(x, y, t)</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={equation}
                            onChange={(e) => setEquation(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGraph()}
                            className="w-full bg-black border border-white/20 text-math-gold px-2 py-1.5 focus:border-math-gold outline-none rounded-sm font-mono tracking-wider"
                        />
                    </div>
                    {errorVal && <p className="text-red-400 mt-1">{errorVal}</p>}
                </div>

                <div className="flex gap-2 mb-4">
                    <button
                        onClick={handleGraph}
                        className="flex-1 bg-white/10 hover:bg-math-gold hover:text-black border border-white/20 px-3 py-1.5 transition-colors rounded-sm uppercase tracking-wider"
                    >
                        Render
                    </button>
                    <button
                        onClick={handleToggleRotate}
                        className={`flex-1 border border-white/20 px-3 py-1.5 transition-colors rounded-sm uppercase tracking-wider ${isRotating ? 'bg-math-gold text-black' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        {isRotating ? 'Stop' : 'Rotate'}
                    </button>
                </div>

                <div className="space-y-2">
                    <p className="text-white/30 uppercase tracking-widest text-[10px]">Presets</p>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { name: "Wave", eq: "sin(x + t) * cos(y)" },
                            { name: "Ripples", eq: "sin(sqrt(x^2 + y^2) - t * 2)" },
                            { name: "Saddle", eq: "x * y" },
                            { name: "Pyramid", eq: "abs(x) + abs(y)" },
                            { name: "Complex", eq: "(x^2 - y^2) . (x . y)" },
                        ].map(p => (
                            <button
                                key={p.name}
                                onClick={() => handlePreset(p.eq)}
                                className="bg-black border border-white/20 hover:border-math-gold text-white/70 hover:text-white px-2 py-1 rounded-full text-[10px] transition-all"
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-white/30 flex justify-between">
                    <span>Particles: {PARTICLE_COUNT}</span>
                    <span>FPS: 60</span>
                </div>
            </div>
        </div>
    );
}
