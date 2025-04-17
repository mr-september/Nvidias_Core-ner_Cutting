import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import './App.css';
import gpuData from './assets/gpu_data.json';

// Define the order of GPU tiers for the X-axis
// This defines the columns from left to right
const columnOrder = ["90", "80 Ti", "80", "70 Ti", "70", "60 Ti", "60", "50 Ti", "50", "30"];

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
    else if (tierNum >= 30) baseTier = "30";
    // Add more tiers if needed

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
    const [useLogScale, setUseLogScale] = useState(false);
    const svgRef = useRef();
    // Track which generations are using special flagship instead of regular flagship
    const [specialFlagshipActive, setSpecialFlagshipActive] = useState({});
    
    // New state to track which generations are visible for CUDA cores chart (all visible by default)
    const [activeGenerations, setActiveGenerations] = useState({});
    
    // New state to track which generations are visible for VRAM chart (all visible by default)
    const [vramActiveGenerations, setVramActiveGenerations] = useState({});
    
    // Add state for the tooltip
    const [tooltipData, setTooltipData] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const tooltipRef = useRef();
    
    // New state variables for VRAM chart
    const vramSvgRef = useRef();
    const [selectedClasses, setSelectedClasses] = useState({
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
    const [showAllGenerations, setShowAllGenerations] = useState(true);

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
        const margin = { top: 60, right: 250, bottom: 50, left: 90 }; // Increased left margin from 60 to 90 for y-axis label
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

        // Find maximum CUDA cores for absolute mode
        const maxCudaCores = d3.max(gpuData, d => d.cudaCores);
        // Round up to nice value for y-axis
        const yMaxAbsolute = Math.ceil(maxCudaCores / 1000) * 1000;
        
        // Create appropriate scale based on toggle mode and log scale setting
        let yScale;
        if (toggleMode) {
            // Always use linear scale for normalized mode (percentage)
            yScale = d3.scaleLinear()
                .domain([0, 110])
                .range([height, 0]);
        } else if (useLogScale) {
            // Use log scale for absolute mode when toggled on
            yScale = d3.scaleLog()
                .domain([100, 30000]) // Start at 100 instead of 10 for log scale
                .range([height, 0])
                .nice();
        } else {
            // Default linear scale for absolute mode
            yScale = d3.scaleLinear()
                .domain([0, yMaxAbsolute])
                .range([height, 0]);
        }

        const generations = Array.from(new Set(gpuData.map(d => d.series)));
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(generations);
        
        // Initialize active generations if empty (all visible by default)
        if (Object.keys(activeGenerations).length === 0) {
            const generationsObj = {};
            generations.forEach(gen => {
                generationsObj[gen] = true; // All visible by default
            });
            setActiveGenerations(generationsObj);
        }

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
              
        // Add X axis label
        chartGroup.append("text")
            .attr("class", "x-axis-label")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + 40)
            .attr("fill", "#ddd")
            .style("font-size", "12px")
            .text("GPU Class");

        // Y-Axis with dynamic formatting based on mode
        let yAxis;
        if (toggleMode) {
            // Percentage mode
            yAxis = d3.axisLeft(yScale)
                .tickFormat(d => `${d}%`);
        } else if (useLogScale) {
            // Log scale mode for CUDA cores
            yAxis = d3.axisLeft(yScale)
                .tickFormat(d => d3.format(",")(d));
        } else {
            // Linear scale for CUDA cores
            yAxis = d3.axisLeft(yScale)
                .tickFormat(d => d3.format(",")(d));
        }

        chartGroup.append("g")
            .attr("class", "y-axis")
            .call(yAxis);
            
        // Add Y axis label
        chartGroup.append("text")
            .attr("class", "y-axis-label")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("y", toggleMode ? -45 : -55) // Move the label further left when showing CUDA cores
            .attr("x", -height / 2)
            .attr("fill", "#ddd")
            .style("font-size", "12px")
            .text(toggleMode ? "Percentage of Flagship CUDA Cores" : 
                  (useLogScale ? "Number of CUDA Cores (Log Scale)" : "Number of CUDA Cores"));

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
        // Find the 2000 series flagship for normalizing the 1600 series
        const series2000Data = gpuData.filter(d => d.series === "2000");
        const regularFlagship2000 = series2000Data.find(d => d.flagship);
        const specialFlagship2000 = series2000Data.find(d => d.specialFlagship);
        const useSpecial2000 = specialFlagshipActive["2000"] && specialFlagship2000;
        const flagship2000 = useSpecial2000 ? specialFlagship2000 : regularFlagship2000;
            
        generations.forEach(series => {
            // Skip this generation if it's set to inactive
            if (activeGenerations[series] === false) return;
            
            const seriesData = gpuData.filter(d => d.series === series);

            // Find regular flagship
            let regularFlagship = seriesData.find(d => d.flagship);
            // Find special flagship (if any)
            let specialFlagship = seriesData.find(d => d.specialFlagship);
            
            // Determine which flagship to use based on user selection
            let useSpecial = specialFlagshipActive[series] && specialFlagship;
            
            // Select the flagship to use for calculations
            // For 1600 series, use the 2000 series flagship
            let flagship;
            if (series === "1600" && flagship2000) {
                flagship = flagship2000; // Use 2000 series flagship for 1600 series normalization
            } else {
                flagship = useSpecial ? specialFlagship : regularFlagship;
            }
            
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
                .y(d => toggleMode ? 
                   yScale(d.normalizedCores) : 
                   yScale(d.cudaCores)) // Use different y value based on mode
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
                .attr('cy', d => toggleMode ? 
                   yScale(d.normalizedCores) : 
                   yScale(d.cudaCores)) // Use different y value based on mode
                .attr('r', 4) // All points visible (they're already filtered)
                .attr('fill', colorScale(series))
                .append('title') // Basic tooltip for individual points
                    .text(d => toggleMode ? 
                      `${d.model} (${d.series})\nCores: ${d.cudaCores}\nNormalized: ${d.normalizedCores.toFixed(1)}%` :
                      `${d.model} (${d.series})\nCores: ${d.cudaCores.toLocaleString()}`);
            
            // Also add this data to our column-organized collection for the hover overlay
            processedData.forEach(d => {
                if (d.tier && processedDataByColumn[d.tier]) {
                    processedDataByColumn[d.tier].push(d);
                }
            });
        });

        // --- Add special connection between 1600 series and 2000 series ---
        // Find the GTX 1660 Ti from the 1600 series
        const gtx1660Ti = gpuData.find(d => d.model === "GTX 1660 Ti" && d.series === "1600");
        // Find the RTX 2080 Ti from the 2000 series
        const rtx2080Ti = gpuData.find(d => d.model === "RTX 2080 Ti" && d.series === "2000");

        if (gtx1660Ti && rtx2080Ti && toggleMode) {  // Only show this connection in toggle mode
            // Calculate normalized CUDA cores for 1660 Ti relative to 2080 Ti's flagship value
            // Find 2000 series flagship
            const series2000Data = gpuData.filter(d => d.series === "2000");
            const flagship2000 = series2000Data.find(d => d.flagship) || rtx2080Ti;
            
            const gtx1660TiNormalizedCores = (gtx1660Ti.cudaCores / flagship2000.cudaCores) * 100;
            const tier1660Ti = getTierFromModel(gtx1660Ti.model);
            const tier2080Ti = getTierFromModel(rtx2080Ti.model);
            
            if (tier1660Ti && tier2080Ti) {
                const columnIndex1660Ti = columnOrder.indexOf(tier1660Ti);
                const columnIndex2080Ti = columnOrder.indexOf(tier2080Ti);
                
                if (columnIndex1660Ti !== -1 && columnIndex2080Ti !== -1) {
                    // Draw a dashed connection line between the two points
                    chartGroup.append('path')
                        .attr('stroke', colorScale("1600"))  // Using the 1600 series color
                        .attr('stroke-width', 1.5)
                        .attr('stroke-dasharray', '5,5')  // Dashed line
                        .attr('fill', 'none')
                        .attr('d', d3.line()([
                            [xScale(columnOrder[columnIndex1660Ti]), yScale(gtx1660TiNormalizedCores)],
                            [xScale(columnOrder[columnIndex2080Ti]), yScale(100)]  // 100% is the flagship reference
                        ]));
                        
                    // Add a small label to explain the connection
                    chartGroup.append('text')
                        .attr('x', (xScale(columnOrder[columnIndex1660Ti]) + xScale(columnOrder[columnIndex2080Ti])) / 2)
                        .attr('y', (yScale(gtx1660TiNormalizedCores) + yScale(100)) / 2 - 10)
                        .attr('text-anchor', 'middle')
                        .attr('font-size', '10px')
                        .attr('fill', 'rgba(80, 80, 80, 0.9)')
                        .text('Same generation');
                }
            }
        }

        // --- Enhanced Legend with Flagship Info and Special Flagship Toggle ---
        const legend = chartGroup.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width + 20}, 0)`); // Position legend to the right
            
        // Add "GPU Generation" title to legend - centered
        legend.append("text")
            .attr("x", 90) // Centered position
            .attr("y", -20)
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", "#ddd")
            .attr("text-anchor", "middle") // Center the text
            .text("GPU Generation");

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
        
        // Color rectangle with toggle functionality
        legendItems.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", d => activeGenerations[d.series] ? colorScale(d.series) : "#555") // Dim when inactive
            .attr("stroke", d => colorScale(d.series))
            .attr("stroke-width", 1)
            .attr("cursor", "pointer")
            .attr("opacity", d => activeGenerations[d.series] ? 1 : 0.5) // Dim inactive generations
            .on("click", function(event, d) {
                // Toggle this generation's visibility
                setActiveGenerations(prev => ({
                    ...prev,
                    [d.series]: !prev[d.series]
                }));
            });

        // Series name with toggle functionality
        legendItems.append("text")
            .attr("x", 20)
            .attr("y", 12) // Vertically align text with rect
            .text(d => d.series)
            .style("font-size", "12px")
            .attr("alignment-baseline", "middle")
            .style("font-weight", "bold")
            .attr("fill", d => activeGenerations[d.series] ? "#ddd" : "#777") // Dim text when inactive
            .attr("cursor", "pointer")
            .on("click", function(event, d) {
                // Toggle this generation's visibility (same as rect click)
                setActiveGenerations(prev => ({
                    ...prev,
                    [d.series]: !prev[d.series]
                }));
            });

        // Flagship model name
        legendItems.append("text")
            .attr("x", 20)
            .attr("y", 27) // Position below the series name
            .text(d => {
                // Special case for 1600 series - use 2080 Ti as flagship
                if (d.series === "1600") {
                    // Find the 2000 series flagship
                    const series2000Data = gpuData.filter(gpu => gpu.series === "2000");
                    const flagship2000 = specialFlagshipActive["2000"] && series2000Data.find(gpu => gpu.specialFlagship) 
                        ? series2000Data.find(gpu => gpu.specialFlagship) 
                        : series2000Data.find(gpu => gpu.flagship);
                    
                    return flagship2000 ? `Flagship: ${flagship2000.model}` : "No flagship";
                }
                
                // Normal case for other series
                const flagshipToShow = specialFlagshipActive[d.series] && d.specialFlagship ? d.specialFlagship : d.regularFlagship;
                return flagshipToShow ? `Flagship: ${flagshipToShow.model}` : "No flagship";
            })
            .style("font-size", "10px")
            .attr("alignment-baseline", "middle")
            .attr("fill", d => activeGenerations[d.series] ? "#aaa" : "#666") // Dim text when inactive
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
                                        Cores: ${gpu.cudaCores.toLocaleString()}<br>
                                        ${toggleMode ? `Normalized: ${gpu.normalizedCores.toFixed(1)}%` : ''}
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

    }, [toggleMode, gpuData, specialFlagshipActive, useLogScale, activeGenerations]); // Include activeGenerations in dependencies

    // New useEffect hook for VRAM chart
    useEffect(() => {
        if (!vramSvgRef.current) return; // Skip if ref isn't available
        
        const svg = d3.select(vramSvgRef.current);
        svg.selectAll("*").remove(); // Clear previous renders

        // --- Chart Dimensions and Margins ---
        const margin = { top: 60, right: 250, bottom: 50, left: 90 };
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

        // Filter GPUs based on selected classes
        const filteredData = gpuData.filter(d => {
            const tier = getTierFromModel(d.model);
            // Include if this class is selected or if we're showing all generations
            return tier && (selectedClasses[tier] || showAllGenerations);
        });

        // Determine if we have data to display
        const hasData = filteredData.length > 0;

        // --- Scales ---
        // X scale for years - use all years if no data is available
        const years = hasData 
            ? Array.from(new Set(filteredData.map(d => d.releaseYear))).sort()
            : Array.from(new Set(gpuData.map(d => d.releaseYear))).sort();
        const xScale = d3.scalePoint()
            .domain(years)
            .range([0, width])
            .padding(0.5);

        // Y scale for VRAM
        // Use a default max value if no data is available
        const maxVram = hasData ? d3.max(filteredData, d => d.vram) : d3.max(gpuData, d => d.vram);
        // Round up to nice value for y-axis
        const yMaxVram = Math.ceil(maxVram / 5) * 5 || 25; // Default to 25 GB if no data
        
        const yScale = d3.scaleLinear()
            .domain([0, yMaxVram])
            .range([height, 0]);
        
        const generations = Array.from(new Set(gpuData.map(d => d.series)));
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(generations);
        
        // Initialize active generations for VRAM chart if empty (all visible by default)
        if (Object.keys(vramActiveGenerations).length === 0) {
            const generationsObj = {};
            generations.forEach(gen => {
                generationsObj[gen] = true; // All visible by default
            });
            setVramActiveGenerations(generationsObj);
        }

        // --- Axes ---
        // X-Axis (Years)
        const xAxis = d3.axisBottom(xScale)
            .tickFormat(d => d); // Display the year as is

        chartGroup.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis)
            .selectAll("text")
            .style("text-anchor", "middle")
            .attr("dy", "1em");
            
        // Add X axis label
        chartGroup.append("text")
            .attr("class", "x-axis-label")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + 40)
            .attr("fill", "#ddd")
            .style("font-size", "12px")
            .text("Release Year");

        // Y-Axis (VRAM)
        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => `${d} GB`);

        chartGroup.append("g")
            .attr("class", "y-axis")
            .call(yAxis);
            
        // Add Y axis label
        chartGroup.append("text")
            .attr("class", "y-axis-label")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("y", -55)
            .attr("x", -height / 2)
            .attr("fill", "#ddd")
            .style("font-size", "12px")
            .text("VRAM (GB)");

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
        
        // Display "No data" message if no data is available but keep the chart structure
        if (!hasData) {
            // Add a message in the chart area
            chartGroup.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .attr("fill", "#ddd")
                .style("font-size", "14px")
                .text("No data to display. Please select at least one GPU class.");
        }
        
        if (hasData) {
            // Only draw data points and lines when we have data
            
            // Group data by GPU class
            const groupedByClass = {};
            columnOrder.forEach(gpuClass => {
                if (selectedClasses[gpuClass] || showAllGenerations) {
                    const gpusInClass = filteredData.filter(d => getTierFromModel(d.model) === gpuClass);
                    
                    if (gpusInClass.length > 0) {
                        groupedByClass[gpuClass] = gpusInClass
                            .sort((a, b) => a.releaseYear - b.releaseYear);
                    }
                }
            });

            // Draw lines for each GPU class
            Object.entries(groupedByClass).forEach(([gpuClass, gpusInClass]) => {
                // Line generator
                const line = d3.line()
                    .defined(d => d.vram != null) // Ensure point has VRAM data
                    .x(d => xScale(d.releaseYear))
                    .y(d => yScale(d.vram));
                    
                // Draw line
                chartGroup.append('path')
                    .datum(gpusInClass)
                    .attr('class', 'series-line')
                    .attr('fill', 'none')
                    .attr('stroke', '#888') // Gray line for all classes
                    .attr('stroke-width', 1.5)
                    .attr('stroke-dasharray', '3,3') // Dashed lines
                    .attr('d', line);
                    
                // Draw points
                chartGroup.selectAll(`.vram-dot-${gpuClass.replace(/\s+/g, '-')}`) // Sanitize class name
                    .data(gpusInClass)
                    .enter().append('circle')
                    .attr('class', `vram-dot vram-dot-${gpuClass.replace(/\s+/g, '-')}`)
                    .attr('cx', d => xScale(d.releaseYear))
                    .attr('cy', d => yScale(d.vram))
                    .attr('r', 4) 
                    .attr('fill', d => colorScale(d.series))
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 0.5)
                    .append('title') // Tooltip
                    .text(d => `${d.model} (${d.series}) - ${d.releaseYear}\nVRAM: ${d.vram} GB`);
            });

            // Group data by series for generation lines
            const seriesData = {};
            generations.forEach(series => {
                const gpusInSeries = filteredData.filter(d => d.series === series);
                if (gpusInSeries.length > 0) {
                    seriesData[series] = gpusInSeries;
                }
            });

            // Draw lines connecting GPUs of the same series/generation
            Object.entries(seriesData).forEach(([series, gpusInSeries]) => {
                // Skip this generation if it's set to inactive
                if (vramActiveGenerations[series] === false) return;
                
                // Sort by class tier for proper line connection
                gpusInSeries.sort((a, b) => {
                    const tierA = getTierFromModel(a.model);
                    const tierB = getTierFromModel(b.model);
                    if (!tierA || !tierB) return 0;
                    
                    const indexA = columnOrder.indexOf(tierA);
                    const indexB = columnOrder.indexOf(tierB);
                    return indexA - indexB;
                });
                
                // Line generator
                const line = d3.line()
                    .defined(d => d.vram != null) // Ensure point has VRAM data
                    .x(d => xScale(d.releaseYear))
                    .y(d => yScale(d.vram));
                    
                // Draw line
                chartGroup.append('path')
                    .datum(gpusInSeries)
                    .attr('class', 'generation-line')
                    .attr('fill', 'none')
                    .attr('stroke', colorScale(series))
                    .attr('stroke-width', 2.5)
                    .attr('d', line);
            });
        } // Close the hasData block
        
        // Add legend for VRAM chart with checkboxes - always show this regardless of data
        const vramLegend = chartGroup.append("g")
            .attr("class", "vram-legend")
            .attr("transform", `translate(${width + 20}, 0)`); // Position legend to the right
            
        // Add "GPU Classes" title to legend - centered
        vramLegend.append("text")
            .attr("x", 90) // Centered position
            .attr("y", -20)
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", "#ddd")
            .attr("text-anchor", "middle") // Center the text
            .text("GPU Classes");

        // Create legend items with checkboxes for each GPU class
        const legendItems = vramLegend.selectAll(".legend-item")
            .data(columnOrder)
            .enter().append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 25})`);
            
        // Checkbox/color rectangle for each GPU class with toggle functionality
        legendItems.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("stroke", "#ddd")
            .attr("fill", d => selectedClasses[d] ? "#646cff" : "#555") // Use grey for inactive
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("cursor", "pointer")
            .attr("opacity", d => selectedClasses[d] ? 1 : 0.5) // Dim inactive classes
            .attr("class", "class-checkbox")
            .on("click", function(event, d) {
                // Toggle the checkbox state
                setSelectedClasses(prev => ({
                    ...prev,
                    [d]: !prev[d]
                }));
                
                // If we're showing all generations, switch to selective mode
                if (showAllGenerations) {
                    setShowAllGenerations(false);
                }
            });
            
        // Label for each GPU class with toggle functionality
        legendItems.append("text")
            .attr("x", 25)
            .attr("y", 12)
            .attr("fill", d => selectedClasses[d] ? "#ddd" : "#777") // Dim text when inactive
            .style("font-size", "12px")
            .text(d => `xx${d}`)
            .attr("cursor", "pointer")
            .attr("alignment-baseline", "middle")
            .on("click", function(event, d) {
                // Toggle this class's visibility (same as rect click)
                setSelectedClasses(prev => ({
                    ...prev,
                    [d]: !prev[d]
                }));
                
                // If we're showing all generations, switch to selective mode
                if (showAllGenerations) {
                    setShowAllGenerations(false);
                }
            });
        
        // Add "Show All" checkbox at the bottom
        const showAllGroup = vramLegend.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${columnOrder.length * 25 + 10})`);
            
        showAllGroup.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("stroke", "#ddd")
            .attr("fill", showAllGenerations ? "#646cff" : "transparent")
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("cursor", "pointer")
            .on("click", function() {
                setShowAllGenerations(prev => !prev);
            });
            
        showAllGroup.append("text")
            .attr("x", 25)
            .attr("y", 12)
            .attr("fill", "#ddd")
            .style("font-size", "12px")
            .text("Show All Classes")
            .attr("alignment-baseline", "middle");
        
        // Add subtitle explaining line colors
        vramLegend.append("text")
            .attr("x", 0)
            .attr("y", columnOrder.length * 25 + 45)
            .attr("fill", "#aaa")
            .style("font-size", "11px")
            .text("* Lines connect same generation");
            
        vramLegend.append("text")
            .attr("x", 0)
            .attr("y", columnOrder.length * 25 + 65)
            .attr("fill", "#aaa")
            .style("font-size", "11px")
            .text("* Colors represent GPU series");
        
    }, [gpuData, selectedClasses, showAllGenerations, vramActiveGenerations]); // Dependencies for VRAM chart

    return (
        <div className="App">
            <h1 style={{ textAlign: 'center', margin: '20px 0' }}>Nvidia's Core-ner Cutting</h1>
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
            {/* CUDA cores chart */}
            <svg ref={svgRef} style={{ display: 'block', margin: '20px auto' }}></svg>
            <p style={{ fontSize: '0.9em', color: '#aaa', maxWidth: '800px', margin: '15px auto 0', fontStyle: 'italic', textAlign: 'center' }}>
                * I typically define special flagships as those that launch 1-2 years after the original flagship. 780 Ti is an exception where it launched only 6 months after the 780. But hey, you have the power to decide which to use.
            </p>
            
            {/* VRAM chart section */}
            <div className="vram-chart-section" style={{ marginTop: '80px', paddingTop: '20px', borderTop: '1px solid #444' }}>
                <h2 style={{ textAlign: 'center', margin: '20px 0' }}>VRAM Evolution Over Time</h2>
                <p style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 20px', color: '#ddd' }}>
                    This chart shows how video memory capacity has evolved over time across different GPU classes. Use the checkboxes in the legend to select which GPU classes to display.
                </p>
                
                {/* VRAM chart */}
                <svg ref={vramSvgRef} style={{ display: 'block', margin: '20px auto' }}></svg>
                
                <p style={{ fontSize: '0.9em', color: '#aaa', maxWidth: '800px', margin: '15px auto 0', fontStyle: 'italic', textAlign: 'center' }}>
                    * Colored lines represent GPUs from the same series, while the dashed gray lines connect the same GPU class across generations.
                </p>
            </div>
        </div>
    );
}

export default App;
