import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import './App.css';
import gpuData from './assets/gpu_data.json';

// Define the order of GPU tiers for the X-axis
// This defines the columns from left to right
const columnOrder = ["90", "80 Ti", "80", "70 Ti", "70", "60 Ti", "60", "50 Ti", "50"];

// Helper function to extract the tier string (e.g., "90 Ti", "80") from a model name
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
    // Add more tiers if needed (e.g., 30)

    if (!baseTier) return null; // Unknown tier number

    // Check for modifiers like "Ti" (case-insensitive, space required)
    if (name.includes(" TI")) {
        return `${baseTier} Ti`;
    }
    // Add checks for "SUPER" if needed, potentially before "Ti" or after non-Ti
    // else if (name.includes(" SUPER")) {
    //     return `${baseTier} Super`; // Adjust columnOrder if Super is added
    // }
    else {
        return baseTier; // Non-Ti version
    }
};


function App() {
    const [toggleMode, setToggleMode] = useState(false);
    const svgRef = useRef();
    // Track which generations are using special flagship instead of regular flagship
    const [specialFlagshipActive, setSpecialFlagshipActive] = useState({});
    
    // Add state for the tooltip
    const [tooltipData, setTooltipData] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const tooltipRef = useRef();
    
    // Function to handle column hover
    const handleColumnHover = useCallback((column, event, processedDataByColumn) => {
        if (column && processedDataByColumn) {
            // Get all GPUs in this column, sorted by series (oldest to newest)
            const gpus = processedDataByColumn[column]?.sort((a, b) => {
                const seriesA = parseInt(a.series, 10) || 0;
                const seriesB = parseInt(b.series, 10) || 0;
                return seriesA - seriesB;
            });
            
            if (gpus && gpus.length > 0) {
                // Calculate tooltip position
                const rect = event.currentTarget.getBoundingClientRect();
                const x = event.clientX - rect.left + 15; // Offset from cursor
                const y = event.clientY - rect.top;
                
                setTooltipData({
                    column,
                    gpus
                });
                setTooltipPosition({ x, y });
            }
        }
    }, []);
    
    // Function to hide tooltip
    const handleColumnLeave = useCallback(() => {
        setTooltipData(null);
    }, []);

    useEffect(() => {
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove(); // Clear previous renders

        // --- Chart Dimensions and Margins ---
        const margin = { top: 60, right: 250, bottom: 50, left: 60 };
        const width = 900 - margin.left - margin.right;
        const height = 450 - margin.top - margin.bottom;

        svg.attr('width', width + margin.left + margin.right)
           .attr('height', height + margin.top + margin.bottom);

        // Add a rounded border for the chart area with transparent fill
        svg.append("rect")
            .attr("x", margin.left - 10)
            .attr("y", margin.top - 10)
            .attr("width", width + 20)
            .attr("height", height + 20)
            .attr("rx", 15)
            .attr("ry", 15)
            .attr("fill", "transparent")
            .attr("class", "chart-background");

        const chartGroup = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Add tooltip container to the DOM
        const tooltipContainer = d3.select('body')
            .append('div')
            .attr('class', 'tooltip-container')
            .style('position', 'absolute')
            .style('visibility', 'hidden');

        // --- Scales ---
        const xScale = d3.scalePoint()
            .domain(columnOrder)
            .range([0, width])
            .padding(0.5);

        const yScale = d3.scaleLinear()
            .domain([0, 110])
            .range([height, 0]);

        const generations = Array.from(new Set(gpuData.map(d => d.series)));
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(generations);

        // --- Axes ---
        // X-Axis
        const xAxis = d3.axisBottom(xScale)
            .tickFormat(d => {
                if (d === "90" && toggleMode) return "Flagship";
                return `xx${d}`;
            });

        chartGroup.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis)
            .selectAll("text")
              .style("text-anchor", "middle") // Ensure labels are centered
              .attr("dy", "1em"); // Adjust vertical position if needed


        // Y-Axis
        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => `${d}%`);

        chartGroup.append("g")
            .attr("class", "y-axis")
            .call(yAxis);

        // Y-Axis Gridlines
        const yGridlines = d3.axisLeft(yScale)
            .tickSize(-width)
            .tickFormat("");

        chartGroup.append("g")
            .attr("class", "grid")
            .call(yGridlines)
            .selectAll("line")
                .attr("stroke", "#e0e0e0")
                .attr("stroke-opacity", 0.7);
        chartGroup.select(".grid .domain").remove();

        // Create an object to organize data by column
        const processedDataByColumn = {};
        columnOrder.forEach(column => {
            processedDataByColumn[column] = [];
        });
        
        // --- Process Data and Draw Lines/Points ---
        generations.forEach(series => {
            const seriesData = gpuData.filter(d => d.series === series);

            // Find regular flagship
            let regularFlagship = seriesData.find(d => d.flagship);
            // Find special flagship (if any)
            let specialFlagship = seriesData.find(d => d.specialFlagship);
            
            // Determine which flagship to use based on user selection
            let useSpecial = specialFlagshipActive[series] && specialFlagship;
            
            // Select the flagship to use for calculations
            let flagship = useSpecial ? specialFlagship : regularFlagship;
            
            if (!flagship) {
                 // Fallback: find highest CUDA card if no explicit flagship
                 flagship = [...seriesData].sort((a, b) => (b.cudaCores || 0) - (a.cudaCores || 0))[0];
                 if (!flagship) {
                    console.warn(`No valid flagship found for series ${series}. Skipping.`);
                    return; // Skip this series if no flagship can be determined
                 }
                 console.warn(`No explicit flagship for series ${series}. Using ${flagship.model} as fallback.`);
            }
            
            const flagshipCores = flagship.cudaCores;
            const flagshipTier = getTierFromModel(flagship.model); // Get the tier string ("90 Ti", "80", etc.)
            const flagshipColumnIndex = columnOrder.indexOf(flagshipTier); // Get the index of the flagship's column

            if (flagshipColumnIndex === -1) {
                console.warn(`Flagship tier "${flagshipTier}" for series ${series} not found in columnOrder. Skipping series.`);
                return; // Can't position this series if flagship tier is unknown
            }


            const processedData = seriesData
                .map(d => {
                    const tier = getTierFromModel(d.model);
                    const columnIndex = columnOrder.indexOf(tier);
                    return {
                        ...d,
                        normalizedCores: d.cudaCores != null && flagshipCores ? (d.cudaCores / flagshipCores) * 100 : null,
                        tier: tier,
                        columnIndex: columnIndex, // Store the original column index
                    };
                })
                .filter(d => {
                    // Filter out special flagships unless they are explicitly toggled on
                    if (d.specialFlagship && !specialFlagshipActive[series]) {
                        return false;
                    }
                    return d.normalizedCores !== null && d.columnIndex !== -1;
                }) // Filter out points with no data or unknown tier
                .sort((a, b) => a.columnIndex - b.columnIndex); // Sort by column index for line drawing


            // --- Define Line Generator ---
            const line = d3.line()
                .defined(d => d.normalizedCores !== null) // Ensure point has data
                .x(d => {
                    // Determine if this GPU should be moved to the flagship column in toggle mode
                    // Only move special flagships when toggled on, or regular flagship when no special is active
                    const shouldMoveToFlagshipColumn = toggleMode && (
                        (useSpecial && d.specialFlagship) ||  // Move special flagship when special is active
                        (d.flagship && !useSpecial)           // Move regular flagship only when special is not active
                    );
                    
                    if (!toggleMode || !shouldMoveToFlagshipColumn) {
                        // Use original position
                        return xScale(columnOrder[d.columnIndex]);
                    } else {
                        // Only move the appropriate flagship to the "90" column in toggle mode
                        const targetIndex = columnOrder.indexOf("90");
                        if (targetIndex !== -1) {
                            return xScale(columnOrder[targetIndex]);
                        }
                        return xScale(columnOrder[d.columnIndex]); // Fallback
                    }
                })
                .y(d => yScale(d.normalizedCores)) // Use yScale for Y position
                .defined(d => d.normalizedCores !== null); // Only define if cores exist


             // --- Draw Line ---
             chartGroup.append('path')
                .datum(processedData)
                .attr('class', 'series-line')
                .attr('fill', 'none')
                .attr('stroke', colorScale(series))
                .attr('stroke-width', 2)
                .attr('d', line);

             // --- Draw Points ---
             chartGroup.selectAll(`.dot-${series.replace(/\s+/g, '-')}`) // Sanitize class name
                .data(processedData)
                .enter().append('circle')
                .attr('class', `series-dot dot-${series.replace(/\s+/g, '-')}`)
                .attr('cx', d => {
                    // Determine if this GPU should be moved to the flagship column in toggle mode
                    // Only move special flagships when toggled on, or regular flagship when no special is active
                    const shouldMoveToFlagshipColumn = toggleMode && (
                        (useSpecial && d.specialFlagship) ||  // Move special flagship when special is active
                        (d.flagship && !useSpecial)           // Move regular flagship only when special is not active
                    );
                    
                    if (!toggleMode || !shouldMoveToFlagshipColumn) {
                        // Use original position
                        return xScale(columnOrder[d.columnIndex]);
                    } else {
                        // Only move the appropriate flagship to the "90" column in toggle mode
                        const targetIndex = columnOrder.indexOf("90");
                        if (targetIndex !== -1) {
                            return xScale(columnOrder[targetIndex]);
                        }
                        return xScale(columnOrder[d.columnIndex]); // Fallback
                    }
                })
                .attr('cy', d => yScale(d.normalizedCores))
                .attr('r', 4) // All points visible (they're already filtered)
                .attr('fill', colorScale(series))
                .append('title') // Basic tooltip for individual points
                    .text(d => `${d.model} (${d.series})\nCores: ${d.cudaCores}\nNormalized: ${d.normalizedCores.toFixed(1)}%`);
            
            // Also add this data to our column-organized collection for the hover overlay
            processedData.forEach(d => {
                if (d.tier && processedDataByColumn[d.tier]) {
                    processedDataByColumn[d.tier].push(d);
                }
            });
        });

        // --- Enhanced Legend with Flagship Info and Special Flagship Toggle ---
        const legend = chartGroup.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width + 20}, 0)`); // Position legend to the right

        // Collect flagship info for each generation
        const generationInfo = generations.map(series => {
            const seriesData = gpuData.filter(d => d.series === series);
            const regularFlagship = seriesData.find(d => d.flagship);
            const specialFlagship = seriesData.find(d => d.specialFlagship);
            return {
                series,
                regularFlagship,
                specialFlagship,
                // Use special flagship if active for this series and special exists, else use regular
                activeFlagship: specialFlagshipActive[series] && specialFlagship ? specialFlagship : regularFlagship
            };
        });

        const legendItems = legend.selectAll(".legend-item")
            .data(generationInfo)
            .enter().append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 35})`); // Increased spacing for additional text
        
        // Color rectangle
        legendItems.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", d => colorScale(d.series));

        // Series name
        legendItems.append("text")
            .attr("x", 20)
            .attr("y", 12) // Vertically align text with rect
            .text(d => d.series)
            .style("font-size", "12px")
            .attr("alignment-baseline", "middle")
            .style("font-weight", "bold");

        // Flagship model name
        legendItems.append("text")
            .attr("x", 20)
            .attr("y", 27) // Position below the series name
            .text(d => {
                const flagshipToShow = specialFlagshipActive[d.series] && d.specialFlagship ? d.specialFlagship : d.regularFlagship;
                return flagshipToShow ? `Flagship: ${flagshipToShow.model}` : "No flagship";
            })
            .style("font-size", "10px")
            .attr("alignment-baseline", "middle")
            .attr("class", "flagship-text");

        // Add toggle buttons for series with special flagships
        legendItems
            .filter(d => d.specialFlagship) // Only for generations with special flagships
            .append("rect")
            .attr("x", 125)
            .attr("y", 17)
            .attr("width", 60)
            .attr("height", 18)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("fill", d => specialFlagshipActive[d.series] ? "#646cff" : "#444")
            .attr("cursor", "pointer")
            .attr("class", "toggle-btn")
            .on("click", function(event, d) {
                // Toggle the special flagship state for this series
                setSpecialFlagshipActive(prev => ({
                    ...prev,
                    [d.series]: !prev[d.series]
                }));
            });

        // Button text
        legendItems
            .filter(d => d.specialFlagship) // Only for generations with special flagships
            .append("text")
            .attr("x", 155)
            .attr("y", 28)
            .text(d => specialFlagshipActive[d.series] ? "Special" : "Regular")
            .style("font-size", "10px")
            .style("text-anchor", "middle")
            .style("fill", "#fff")
            .attr("pointer-events", "none") // Make text not capture clicks
            .attr("class", "toggle-text");
            
        // Create column overlays for hover effect
        columnOrder.forEach(column => {
            const columnX = xScale(column);
            const columnWidth = width / (columnOrder.length + 1); // Approximate width for each column
            
            // Add transparent overlay rectangle for each column
            chartGroup.append('rect')
                .attr('class', 'column-overlay')
                .attr('x', columnX - columnWidth / 2)
                .attr('y', 0)
                .attr('width', columnWidth)
                .attr('height', height)
                .on('mousemove', function(event) {
                    const rect = svgRef.current.getBoundingClientRect();
                    const mouseX = event.clientX - rect.left;
                    const mouseY = event.clientY - rect.top;
                    
                    // Show and position tooltip
                    d3.select('.tooltip-container')
                        .style('visibility', 'visible')
                        .style('left', `${event.clientX + 15}px`)
                        .style('top', `${event.clientY}px`);
                    
                    // Generate tooltip content
                    let tooltipTitle = "";
                    let tooltipGpus = [];
                    
                    if (column === "90" && toggleMode) {
                        // Special case for 90 column in toggle mode - show aligned flagships
                        tooltipTitle = `<div style="font-weight: bold; margin-bottom: 8px;">Aligned Flagships</div>`;
                        
                        // Find all flagships that have been aligned
                        generations.forEach(series => {
                            const seriesData = gpuData.filter(d => d.series === series);
                            const useSpecial = specialFlagshipActive[series];
                            let flagship;
                            
                            if (useSpecial) {
                                flagship = seriesData.find(d => d.specialFlagship);
                            }
                            
                            if (!flagship) {
                                flagship = seriesData.find(d => d.flagship);
                            }
                            
                            if (flagship) {
                                const tier = getTierFromModel(flagship.model);
                                const flagshipCores = flagship.cudaCores;
                                
                                // Add this flagship to the tooltip
                                tooltipGpus.push({
                                    ...flagship,
                                    normalizedCores: 100, // All flagships are normalized to 100%
                                    series
                                });
                            }
                        });
                    } else {
                        // Regular column behavior
                        tooltipTitle = `<div style="font-weight: bold; margin-bottom: 8px;">xx${column} Class</div>`;
                        
                        // Get GPUs in this column, sorted by release year/series (oldest to newest)
                        tooltipGpus = processedDataByColumn[column]?.sort((a, b) => {
                            const seriesA = parseInt(a.series, 10) || 0;
                            const seriesB = parseInt(b.series, 10) || 0;
                            return seriesA - seriesB;
                        }) || [];
                    }
                    
                    // Start building the tooltip content with the title
                    let tooltipContent = tooltipTitle;
                    
                    if (tooltipGpus && tooltipGpus.length > 0) {
                        tooltipGpus.forEach(gpu => {
                            tooltipContent += `
                                <div class="gpu-item">
                                    <span class="model-name">
                                        <span class="color-indicator" style="background-color: ${colorScale(gpu.series)};"></span>
                                        ${gpu.model}
                                    </span>
                                    <div class="cores-info">
                                        Cores: ${gpu.cudaCores}<br>
                                        Normalized: ${gpu.normalizedCores.toFixed(1)}%
                                    </div>
                                </div>
                            `;
                        });
                    } else {
                        tooltipContent += '<div>No GPUs in this class</div>';
                    }
                    
                    d3.select('.tooltip-container').html(tooltipContent);
                })
                .on('mouseout', function() {
                    d3.select('.tooltip-container').style('visibility', 'hidden');
                });
        });

    }, [toggleMode, gpuData, specialFlagshipActive]); // Include specialFlagshipActive in dependencies

    return (
        <div className="App">
            <h1 style={{ textAlign: 'center', margin: '20px 0' }}>Nvidia's Core-ner Cutting</h1>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', margin: '10px auto' }}>
                <button
                    onClick={() => setToggleMode(!toggleMode)}
                    style={{ padding: '10px 20px', cursor: 'pointer' }}
                >
                    {toggleMode ? "Show Absolute Tiers" : "Align Flagships (Normalize Start)"}
                </button>
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
            {/* Use the ref here */}
            <svg ref={svgRef} style={{ display: 'block', margin: '20px auto' }}></svg>
            <p style={{ fontSize: '0.9em', color: '#aaa', maxWidth: '800px', margin: '15px auto 0', fontStyle: 'italic', textAlign: 'center' }}>
                * I typically define special flagships as those that launch 1-2 years after the original flagship. 780 Ti is an exception where it launched only 6 months after the 780. But hey, you have the power to decide which to use.
            </p>
        </div>
    );
}

export default App;
