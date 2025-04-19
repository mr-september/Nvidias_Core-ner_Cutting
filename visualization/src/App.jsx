import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as d3 from 'd3'; // Keep D3 import here if needed elsewhere, though it's mainly in components now
import './App.css';
import gpuData from './assets/gpu_data.json';
import consoleData from './assets/console_data.json';

// Import the new components
import CudaPlot from './CudaPlot';
import VramPlot from './VramPlot';


// Define the order of GPU tiers for the X-axis - Keep in App as it's shared config
const columnOrder = ["90 Ti", "90", "80 Ti", "80", "70 Ti", "70", "60 Ti", "60", "50 Ti", "50", "30"];

// Helper function to extract the tier string (e.g., "90 Ti", "80") from a model name
// Keep in App as it's a shared utility, passed to components
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
    const svgRef = useRef(); // Keep ref in App as per constraint
    const [specialFlagshipActive, setSpecialFlagshipActive] = useState({});
    const [activeGenerations, setActiveGenerations] = useState({}); // CUDA generations visibility
    const [showAllCudaGenerations, setShowAllCudaGenerations] = useState(true); // CUDA show all toggle state

    // State related to CUDA tooltip (managed in App, handlers passed to CudaPlot)
    const [tooltipData, setTooltipData] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const tooltipRef = useRef(); // Not strictly needed if D3 manages position directly


    // State related to VRAM chart
    const vramSvgRef = useRef(); // Keep ref in App as per constraint
    const [selectedClasses, setSelectedClasses] = useState({ // VRAM classes visibility
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
    const [showAllGenerations, setShowAllGenerations] = useState(true); // VRAM show all classes toggle state

    // State for showing console data on VRAM chart
    const [showConsoleData, setShowConsoleData] = useState(true);

    // State to track which console platforms are visible
    const [visibleConsolePlatforms, setVisibleConsolePlatforms] = useState({
        "PlayStation": true,
        "Xbox": true
    });

    // State for memory allocation slider (percentage of unified memory used as VRAM)
    const [memoryAllocationPercentage, setMemoryAllocationPercentage] = useState(100);

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

         // Initialize selectedClasses and showAllGenerations for VRAM chart if empty
         // This was originally inside the VRAM useEffect, now initialize here once
         if (Object.keys(selectedClasses).length === 0 && columnOrder && columnOrder.length > 0) {
            const initialClasses = {};
            columnOrder.forEach(cls => {
                // Keep the original default settings if columnOrder hasn't changed
                // Otherwise, default to true for all classes
                initialClasses[cls] = true;
            });
            setSelectedClasses(initialClasses);
            setShowAllGenerations(true);
         }

         // Initialize visibleConsolePlatforms if empty
         if (Object.keys(visibleConsolePlatforms).length === 0 && consoleData && consoleData.length > 0) {
            const platforms = Array.from(new Set(consoleData.map(d => d.platform)));
            const initialPlatforms = {};
             platforms.forEach(p => { initialPlatforms[p] = true; });
             setVisibleConsolePlatforms(initialPlatforms);
         }

    }, [gpuData, consoleData, columnOrder, activeGenerations, selectedClasses, visibleConsolePlatforms]); // Dependencies

    // Function to handle CUDA column hover (kept in App, passed to CudaPlot)
    // Note: The D3 code in CudaPlot will also handle tooltip positioning and content rendering directly,
    // calling these handlers might be redundant unless React-managed tooltips are desired later.
    // Keeping for now as per constraint, but the D3 logic in CudaPlot is the primary handler.
    const handleColumnHover = useCallback((column, event, processedDataByColumn) => {
         // The D3 code in the component handles the actual display and positioning.
         // This React handler *could* be used to update React state (like tooltipData, tooltipPosition)
         // for a React-rendered tooltip, but the original code used D3 to append to body.
         // For now, just keep the function signature as it was in the original useEffect dependency array.
         // The actual tooltip logic is duplicated in the CudaPlot useEffect for strict adherence.
         // This is a good candidate for refactoring later (move tooltip state/rendering to App).
    }, []); // Dependencies match original useCallback

    // Function to hide CUDA tooltip (kept in App, passed to CudaPlot)
    const handleColumnLeave = useCallback(() => {
         // Same note as handleColumnHover - D3 handles hiding in CudaPlot's useEffect.
    }, []); // Dependencies match original useCallback


    // The useEffect hooks that previously drew the charts are removed from App.jsx
    // and now reside within CudaPlot.jsx and VramPlot.jsx


    return (
        <div className="App">
            {/* CUDA Plot Section */}
            <h1 style={{ textAlign: 'center', margin: '20px 0' }}>Nvidia's Core-ner Cutting</h1>
            <p style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 20px', color: '#ddd' }}>
                This visualization tracks NVIDIA's CUDA core counts across GPU generations, tracking how lower-tier cards receive proportionally fewer cores over time compared to flagship models.
            </p>
             <p style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 20px', color: '#ddd' }}>
                This is an open-source project. Please feel free to have a look at the source code and contribute!
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
                setSpecialFlagshipActive={setSpecialFlagshipActive} // Pass setter down
                activeGenerations={activeGenerations}
                setActiveGenerations={setActiveGenerations} // Pass setter down
                showAllCudaGenerations={showAllCudaGenerations}
                setShowAllCudaGenerations={setShowAllCudaGenerations} // Pass setter down
                tooltipData={tooltipData} // Pass state down (redundant if D3 renders)
                tooltipPosition={tooltipPosition} // Pass state down (redundant if D3 renders)
                setTooltipData={setTooltipData} // Pass setter down (redundant if D3 renders)
                setTooltipPosition={setTooltipPosition} // Pass setter down (redundant if D3 renders)
                handleColumnHover={handleColumnHover} // Pass handler down
                handleColumnLeave={handleColumnLeave} // Pass handler down
            />

            <p style={{ fontSize: '0.9em', color: '#aaa', maxWidth: '800px', margin: '15px auto 0', fontStyle: 'italic', textAlign: 'center' }}>
                * Special flagships are defined as those that launch 1-2 years after the original flagship. 780 Ti is an exception where it launched only 6 months after the 780. But hey, you have the power to decide which to use.
            </p>

            {/* VRAM chart section */}
            <div className="vram-chart-section" style={{ marginTop: '80px', paddingTop: '20px', borderTop: '1px solid #444' }}>
                <h2 style={{ textAlign: 'center', margin: '20px 0' }}>VRAM Evolution Over Time</h2>
                <p style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 20px', color: '#ddd' }}>
                    This chart shows how video memory capacity has evolved over time across different GPU classes and consoles. Use the checkboxes in the legend to select which GPU classes to display. The slider adjusts the allocation of unified memory systems (like consoles and some laptop/APU architectures) between CPU and GPU, affecting the effective VRAM amount shown.
                </p>
                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                    {/* Render the VramPlot component */}
                    <VramPlot
                        vramSvgRef={vramSvgRef}
                        gpuData={gpuData}
                        consoleData={consoleData}
                        columnOrder={columnOrder} // Pass shared config
                        getTierFromModel={getTierFromModel} // Pass shared utility
                        selectedClasses={selectedClasses}
                        setSelectedClasses={setSelectedClasses} // Pass setter down
                        showAllGenerations={showAllGenerations} // Note: This state name is misleading (it's for Classes), keep for now as per constraint
                        setShowAllGenerations={setShowAllGenerations} // Pass setter down
                        showConsoleData={showConsoleData}
                        setShowConsoleData={setShowConsoleData} // Pass setter down
                        visibleConsolePlatforms={visibleConsolePlatforms}
                        setVisibleConsolePlatforms={setVisibleConsolePlatforms} // Pass setter down
                        memoryAllocationPercentage={memoryAllocationPercentage}
                        setMemoryAllocationPercentage={setMemoryAllocationPercentage} // Pass setter down
                    />
                </div>
            </div>
             {/* Notes for VRAM chart */}
             <p style={{ fontSize: '0.9em', color: '#aaa', maxWidth: '800px', margin: '15px auto 0', fontStyle: 'italic', textAlign: 'center' }}>
                * Console memory represents total system memory. Unified memory systems (PS4, Xbox One, and newer) dynamically allocate between CPU and GPU. The slider estimates VRAM based on this allocation percentage. Older consoles with dedicated VRAM are shown at their fixed amount regardless of slider position.
            </p>
        </div>
    );
}

export default App;