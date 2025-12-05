import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import './App.css';
import gpuData from './assets/gpu_data.json';
import consoleData from './assets/console_data.json';
import gpuDieData from './assets/gpu_die.json';

import CudaPlot from './CudaPlot';
import VramPlot from './VramPlot';
import DieAreaPlot from './DieAreaPlot';


// GPU tier ordering for X-axis (flagship to entry-level)
const columnOrder = ["90 Ti", "90", "80 Ti", "80", "70 Ti", "70", "60 Ti", "60", "50 Ti", "50", "30"];

/**
 * Extracts GPU tier from model name (e.g., "RTX 4090" -> "90")
 * @param {string} modelName - Full GPU model name
 * @returns {string|null} Tier string like "90 Ti" or "80", or null if unrecognized
 */
const getTierFromModel = (modelName) => {
    const name = modelName.toUpperCase();
    const numMatch = name.match(/(\d{2,4})/); // Match 2 to 4 digits often representing the tier part
    if (!numMatch) return null; // Cannot determine tier

    const numStr = numMatch[1];
    const tierNum = parseInt(numStr.slice(-2), 10); // Usually the last two digits

    let baseTier = null;
    if (tierNum >= 90) baseTier = "90";
    else if (tierNum >= 80) baseTier = "80";
    else if (tierNum >= 70) baseTier = "70";
    else if (tierNum >= 60) baseTier = "60";
    else if (tierNum >= 50) baseTier = "50";
    else if (tierNum >= 30) baseTier = "30";
    // Add more tiers if needed

    if (!baseTier) return null; // Unknown tier number

    // Check for modifiers like "Ti" (case-insensitive, space required)
    if (name.includes(" TI")) {
        return `${baseTier} Ti`;
    }
    // Add checks for "SUPER" if needed
    // else if (name.includes(" SUPER")) {
    //     return `${baseTier} Super`;
    // }
    else {
        return baseTier; // Non-Ti version
    }
};


function App() {
    // State related to CUDA chart
    const [toggleMode, setToggleMode] = useState(false);
    const [useLogScale, setUseLogScale] = useState(false);
    const svgRef = useRef();
    const [specialFlagshipActive, setSpecialFlagshipActive] = useState({});
    const [activeGenerations, setActiveGenerations] = useState({});
    const [showAllCudaGenerations, setShowAllCudaGenerations] = useState(true);


    // VRAM chart state
    const vramSvgRef = useRef();
    const [selectedClasses, setSelectedClasses] = useState({
        "90 Ti": true,
        "90": true,
        "80 Ti": true,
        "80": true,
        "70 Ti": false,
        "70": true,
        "60 Ti": false,
        "60": true,
        "50 Ti": false,
        "50": true,
        "30": false
    });
    const [showAllClasses, setShowAllClasses] = useState(true); // Controls "Show All" checkbox for GPU classes

    // State for showing console data on VRAM chart
    const [showConsoleData, setShowConsoleData] = useState(true);

    // State to track which console platforms are visible
    const [visibleConsolePlatforms, setVisibleConsolePlatforms] = useState({
        "PlayStation": true,
        "Xbox": true
    });

    // State for memory allocation slider (percentage of unified memory used as VRAM)
    const [memoryAllocationPercentage, setMemoryAllocationPercentage] = useState(100);
    
    // State related to Die Area Price plot
    const dieAreaSvgRef = useRef();
    const [showAllDieGenerations, setShowAllDieGenerations] = useState(true);

     // Initialize activeGenerations state based on data the first time
     // This was originally inside the CUDA useEffect, now initialize here once
    useEffect(() => {
        if (Object.keys(activeGenerations).length === 0 && gpuData && gpuData.length > 0) {
            const generations = Array.from(new Set(gpuData.map(d => d.series)));
            const generationsObj = {};
            generations.forEach(gen => {
                generationsObj[gen] = true; // All visible by default
            });
            setActiveGenerations(generationsObj);
             // Initialize specialFlagshipActive based on data presence
             const initialSpecialFlagships = {};
             generations.forEach(gen => {
                 const seriesData = gpuData.filter(d => d.series === gen);
                 const hasSpecial = seriesData.some(d => d.specialFlagship);
                 if (hasSpecial) {
                     // Default to regular flagship being active unless specifically needed otherwise
                     initialSpecialFlagships[gen] = false; // Default state is Regular
                 }
             });
             setSpecialFlagshipActive(initialSpecialFlagships);
        }

         // Initialize selectedClasses and showAllClasses for VRAM chart if empty
         if (Object.keys(selectedClasses).length === 0 && columnOrder && columnOrder.length > 0) {
            const initialClasses = {};
            columnOrder.forEach(cls => {
                initialClasses[cls] = true;
            });
            setSelectedClasses(initialClasses);
            setShowAllClasses(true);
         }

         // Initialize visibleConsolePlatforms if empty
         if (Object.keys(visibleConsolePlatforms).length === 0 && consoleData && consoleData.length > 0) {
            const platforms = Array.from(new Set(consoleData.map(d => d.platform)));
            const initialPlatforms = {};
             platforms.forEach(p => { initialPlatforms[p] = true; });
             setVisibleConsolePlatforms(initialPlatforms);
         }

    }, [gpuData, consoleData, columnOrder, activeGenerations, selectedClasses, visibleConsolePlatforms]);

    return (
        <div className="App">
            {/* CUDA Plot Section */}
            <h1 style={{ textAlign: 'center', margin: '20px 0' }}>NVIDIA GPU Analyzer</h1>
            <p style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 20px', color: '#ddd' }}>
                Interactive visualization of NVIDIA GPU specifications, pricing trends, and market positioning across generations.
            </p>
            <p style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 20px', color: '#ddd' }}>
                Each plot can have elements toggled on/off by click on the legend.
            </p>
            <p style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 20px', color: '#ddd' }}>
                This visualization tracks NVIDIA's CUDA core counts across GPU generations, tracking how lower-tier cards receive proportionally fewer cores over time compared to flagship models.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', margin: '10px auto' }}>
                <button
                    onClick={() => setToggleMode(!toggleMode)}
                    style={{ padding: '10px 20px', cursor: 'pointer' }}
                >
                    {toggleMode ? "Show Absolute Tiers" : "Align Flagships (Normalize Start)"}
                </button>
                {/* Only show log scale toggle when in absolute mode (raw CUDA cores) */}
                {!toggleMode && (
                    <button
                        onClick={() => setUseLogScale(!useLogScale)}
                        style={{
                            padding: '10px 20px',
                            cursor: 'pointer',
                            backgroundColor: useLogScale ? '#646cff' : '#444'
                        }}
                    >
                        {useLogScale ? "Linear Scale" : "Log Scale"}
                    </button>
                )}
                 <a
                    href="https://github.com/mr-september/Nvidias_Core-ner_Cutting"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on GitHub"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#242424',
                        transition: 'background-color 0.3s ease'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#444'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#242424'}
                >
                    <svg height="24" width="24" viewBox="0 0 16 16" fill="#ffffff">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                    </svg>
                </a>
            </div>

            {/* Render the CudaPlot component */}
            <CudaPlot
                svgRef={svgRef}
                gpuData={gpuData}
                columnOrder={columnOrder}
                getTierFromModel={getTierFromModel}
                toggleMode={toggleMode}
                useLogScale={useLogScale}
                specialFlagshipActive={specialFlagshipActive}
                setSpecialFlagshipActive={setSpecialFlagshipActive}
                activeGenerations={activeGenerations}
                setActiveGenerations={setActiveGenerations}
                showAllCudaGenerations={showAllCudaGenerations}
                setShowAllCudaGenerations={setShowAllCudaGenerations}
            />

            <p style={{ fontSize: '0.9em', color: '#aaa', maxWidth: '800px', margin: '15px auto 0', fontStyle: 'italic', textAlign: 'center' }}>
                Special flagships are defined as those that launch 1-2 years after the original flagship. 780 Ti is an exception where it launched only 6 months after the 780. But hey, you have the power to decide which to use.
            </p>

            {/* VRAM chart section */}
            <div className="vram-chart-section" style={{ marginTop: '80px', paddingTop: '20px', borderTop: '1px solid #444' }}>
                <h2 style={{ textAlign: 'center', margin: '20px 0' }}>VRAM Evolution Over Time</h2>
                <p style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 20px', color: '#ddd' }}>
                    This chart shows how video memory capacity has evolved over time across different GPU classes and consoles.
                </p>
                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                    {/* Render the VramPlot component */}
                    <VramPlot
                        vramSvgRef={vramSvgRef}
                        gpuData={gpuData}
                        consoleData={consoleData}
                        columnOrder={columnOrder}
                        getTierFromModel={getTierFromModel}
                        selectedClasses={selectedClasses}
                        setSelectedClasses={setSelectedClasses}
                        showAllClasses={showAllClasses}
                        setShowAllClasses={setShowAllClasses}
                        showConsoleData={showConsoleData}
                        setShowConsoleData={setShowConsoleData}
                        visibleConsolePlatforms={visibleConsolePlatforms}
                        setVisibleConsolePlatforms={setVisibleConsolePlatforms}
                        memoryAllocationPercentage={memoryAllocationPercentage}
                        setMemoryAllocationPercentage={setMemoryAllocationPercentage}
                    />
                </div>
            </div>
             {/* Notes for VRAM chart */}
             <p style={{ fontSize: '0.9em', color: '#aaa', maxWidth: '800px', margin: '15px auto 0', fontStyle: 'italic', textAlign: 'center' }}>
                Console memory represents total system memory. Unified memory systems (PS4, Xbox One, and newer) dynamically allocate between CPU and GPU. The slider estimates VRAM based on this allocation percentage. Older consoles with dedicated VRAM are shown at their fixed amount regardless of slider position.
            </p>
             <p style={{ fontSize: '0.9em', color: '#aaa', maxWidth: '800px', margin: '15px auto 0', fontStyle: 'italic', textAlign: 'center' }}>
                The xx60 class is the only class (so far) that had a regression in VRAM capacity.
            </p>

            {/* Die Area Price chart section */}
            <div className="die-area-chart-section" style={{ marginTop: '80px', paddingTop: '20px', borderTop: '1px solid #444' }}>
                <h2 style={{ textAlign: 'center', margin: '20px 0' }}>GPU Price per Die Area Over Time</h2>
                <p style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 20px', color: '#ddd' }}>
                    This chart shows the evolution of price (launch MSRP in USD) per die area ($/mm²) across GPU generations. Individual GPUs are plotted as scatter points and distributions as violin plots.
                </p>
                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                    {/* Render the DieAreaPlot component */}
                    <DieAreaPlot
                        dieAreaSvgRef={dieAreaSvgRef}
                        gpuData={gpuData}
                        gpuDieData={gpuDieData}
                        columnOrder={columnOrder}
                        getTierFromModel={getTierFromModel}
                        activeGenerations={activeGenerations}
                        setActiveGenerations={setActiveGenerations}
                        showAllDieGenerations={showAllDieGenerations}
                        setShowAllDieGenerations={setShowAllDieGenerations}
                    />
                </div>
            </div>
            {/* Notes for Die Area chart */}
            <p style={{ fontSize: '0.9em', color: '#aaa', maxWidth: '800px', margin: '15px auto 0', fontStyle: 'italic', textAlign: 'center' }}>
                Price per die area ($/mm²) tracks manufacturing efficiency and pricing strategy across GPU generations. Lower values may indicate better cost efficiency and/or competitive pricing.
            </p>
        </div>
    );
}

export default App;