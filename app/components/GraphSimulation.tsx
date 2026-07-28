'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { compile, type EvalFunction } from 'mathjs';

// --- Configuration ---
const PARTICLE_COUNT = 28000;
const RANGE = 10;
const PARTICLE_SIZE = 0.08;
const TRANSITION_SPEED = 0.02;

interface GraphSimulationProps {
    onInteractionStateChange?: (isActive: boolean) => void;
}

export default function GraphSimulation({ onInteractionStateChange }: GraphSimulationProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [equation, setEquation] = useState('sin(x + t) * cos(y)');
    const [errorVal, setError] = useState('');
    const [isRotating, setIsRotating] = useState(false);
    const [viewMode, setViewMode] = useState<'particles' | 'vectors'>('particles');
    const [isWebGLUnavailable, setIsWebGLUnavailable] = useState(false);
    const viewModeRef = useRef<'particles' | 'vectors'>('particles');
    const isVisibleRef = useRef(true);

    // Refs to keep track of Three.js objects across renders
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const particlesRef = useRef<THREE.Points | null>(null);
    const arrowsMeshRef = useRef<THREE.InstancedMesh | null>(null);
    const animationIdRef = useRef<number | null>(null);

    // Logic Refs
    const currentFunctionRef = useRef<((x: number, y: number, t: number) => number) | null>(null);
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
        const allowed = new Set([
            'x', 'y', 't', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
            'sqrt', 'cbrt', 'abs', 'floor', 'ceil', 'round', 'max', 'min',
            'log', 'log10', 'exp', 'pi', 'e',
        ]);
        const names = equationStr.toLowerCase().match(/[a-z_]+/g) || [];
        if (names.some(name => !allowed.has(name))) return null;
        try {
            const expression: EvalFunction = compile(equationStr.toLowerCase());
            const evaluate = (x: number, y: number, t: number) => Number(expression.evaluate({ x, y, t }));
            evaluate(1, 1, 0);
            return evaluate;
        } catch (error) {
            console.warn("Equation parse warning:", error);
            return null;
        }
    };

    useEffect(() => {
        viewModeRef.current = viewMode;
        if (particlesRef.current) particlesRef.current.visible = viewMode === 'particles';
        if (arrowsMeshRef.current) arrowsMeshRef.current.visible = viewMode === 'vectors';
    }, [viewMode]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const observer = new IntersectionObserver(([entry]) => {
            isVisibleRef.current = entry.isIntersecting;
        }, { threshold: 0.05 });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

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
            } catch { z = 0; }

            targetZRef.current[i] = z;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }

        // Calculate Colors
        const zRange = (maxZ - minZ) || 1;
        const tempColor = new THREE.Color();

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const z = targetZRef.current[i];
            const tNorm = (z - minZ) / zRange;
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

        const capabilityCanvas = document.createElement('canvas');
        const webglContext = capabilityCanvas.getContext('webgl2') || capabilityCanvas.getContext('webgl');
        if (!webglContext) {
            setIsWebGLUnavailable(true);
            return;
        }

        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch (error) {
            console.warn('MosDes WebGL renderer unavailable:', error);
            setIsWebGLUnavailable(true);
            return;
        }
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

        // VECTOR SYSTEM (InstancedMesh)
        // Reduce count for arrows to avoid performance hit (e.g., 1/6th)
        const VECTOR_COUNT = Math.floor(PARTICLE_COUNT / 6);
        const coneGeom = new THREE.ConeGeometry(0.1, 0.4, 6);
        coneGeom.rotateX(Math.PI / 2); // Point along Z (which we'll orient to normal)
        const coneMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const arrowMesh = new THREE.InstancedMesh(coneGeom, coneMat, VECTOR_COUNT);
        arrowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        arrowMesh.visible = false;
        scene.add(arrowMesh);
        arrowsMeshRef.current = arrowMesh;

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
            if (!isVisibleRef.current || document.hidden) return;

            timeRef.current += 0.02;
            if (controlsRef.current) controlsRef.current.update();

            const pSys = particlesRef.current;
            const aSys = arrowsMeshRef.current;

            if (pSys) {
                const posAttr = pSys.geometry.attributes.position;
                const colAttr = pSys.geometry.attributes.color;

                // Re-render switch logic
                pSys.visible = viewModeRef.current === 'particles';
                if (aSys) aSys.visible = viewModeRef.current === 'vectors';

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

                // VECTOR UPDATE
                if (viewModeRef.current === 'vectors' && aSys && initialPositionsRef.current) {
                    const VECTOR_COUNT = aSys.count;
                    const dummy = new THREE.Object3D();
                    const initPos = initialPositionsRef.current;
                    const posArr = posAttr.array;
                    const delta = 0.1;
                    const func = currentFunctionRef.current;
                    const t = timeRef.current;

                    for (let i = 0; i < VECTOR_COUNT; i++) {
                        const sourceIdx = i * 6;
                        if (sourceIdx >= PARTICLE_COUNT) break;

                        const x = initPos[sourceIdx * 3];
                        const y = initPos[sourceIdx * 3 + 2];
                        const z = posArr[sourceIdx * 3 + 1];

                        let dzdx = 0, dzdy = 0;
                        if (func) {
                            try {
                                const zx = func(x + delta, y, t);
                                const zy = func(x, y + delta, t);
                                dzdx = (zx - z) / delta;
                                dzdy = (zy - z) / delta;
                            } catch { }
                        }

                        const normal = new THREE.Vector3(-dzdx, 1, -dzdy).normalize();

                        dummy.position.set(x, z, y);
                        dummy.lookAt(x + normal.x, z + normal.y, y + normal.z);
                        dummy.scale.setScalar(0.5);

                        dummy.updateMatrix();
                        aSys.setMatrixAt(i, dummy.matrix);

                        aSys.setColorAt(i, new THREE.Color().setHSL(0.6 - (1 - normal.y) * 0.5, 1, 0.5));
                    }
                    aSys.instanceMatrix.needsUpdate = true;
                    if (aSys.instanceColor) aSys.instanceColor.needsUpdate = true;
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
            controls.dispose();
            geometry.dispose();
            material.dispose();
            coneGeom.dispose();
            coneMat.dispose();
            renderer.dispose();
        };
        // The scene is created once; mutable controls are synchronized through refs.
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
        <div
            className="relative w-full h-[600px] rounded-xl overflow-hidden border border-white/10 bg-black/50 backdrop-blur-sm shadow-2xl transition-all duration-500"
            onMouseEnter={() => onInteractionStateChange?.(true)}
            onMouseLeave={() => onInteractionStateChange?.(false)}
        >
            {/* Canvas Container */}
            <div ref={containerRef} className="absolute inset-0 z-0" />

            {isWebGLUnavailable && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-black px-6 text-center">
                    <div className="max-w-md border border-math-gold/25 bg-black/80 p-8">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-math-gold">Renderer unavailable</span>
                        <h3 className="mt-3 font-serif text-3xl text-white">MosDes needs WebGL.</h3>
                        <p className="mt-3 text-sm leading-relaxed text-white/50">
                            Hardware acceleration is unavailable in this browser. The rest of the research labs remain fully interactive.
                        </p>
                    </div>
                </div>
            )}

            {/* Floating UI Panel */}
            {!isWebGLUnavailable && <div className="absolute top-4 left-4 z-10 w-80 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-4 shadow-lg text-xs font-mono">
                <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-3">
                    <h3 className="text-math-gold uppercase tracking-[0.2em] text-sm font-bold">
                        MosDes <span className="text-white/40 font-thin ml-2">Console</span>
                    </h3>
                    <button
                        onClick={() => setViewMode(prev => prev === 'particles' ? 'vectors' : 'particles')}
                        className={`px-2 py-0.5 rounded text-[10px] uppercase border ${viewMode === 'vectors' ? 'bg-math-gold text-black border-math-gold' : 'border-white/20 text-white/50'}`}
                    >
                        {viewMode === 'vectors' ? 'Vectors' : 'Particles'}
                    </button>
                </div>

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
                            { name: "Peaks", eq: "(x^2 - y^2) * exp(-(x^2 + y^2) / 20)" },
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
                    <span>WebGL / Live</span>
                </div>
            </div>}
        </div>
    );
}
