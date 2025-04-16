import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import './App.css'; // Make sure you have this file or remove the import
import gpuData from './assets/gpu_data.json'; // Ensure this path is correct

// Define the order of GPU tiers for the X-axis
// This defines the columns from left to right
const columnOrder = ["90 Ti", "90", "80 Ti", "80", "70 Ti", "70", "60 Ti", "60", "50 Ti", "50"];

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
    const svgRef = useRef(); // Use ref to target the SVG element

    useEffect(() => {
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove(); // Clear previous renders

        // --- Chart Dimensions and Margins ---
        const margin = { top: 60, right: 150, bottom: 50, left: 60 }; // Increased right margin for legend
        const width = 900 - margin.left - margin.right; // Adjusted width
        const height = 450 - margin.top - margin.bottom;

        svg.attr('width', width + margin.left + margin.right)
           .attr('height', height + margin.top + margin.bottom);

        const chartGroup = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // --- Scales ---
        const xScale = d3.scalePoint()
            .domain(columnOrder) // Use the defined tiers as the domain
            .range([0, width])
            .padding(0.5); // Adds spacing between points

        const yScale = d3.scaleLinear()
            .domain([0, 110]) // Y-axis from 0% to 110% (to give space above 100%)
            .range([height, 0]); // Inverted range for SVG coordinates (0 is top)

        const generations = Array.from(new Set(gpuData.map(d => d.series)));
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(generations);

        // --- Axes ---
        // X-Axis
        const xAxis = d3.axisBottom(xScale)
            .tickFormat(d => `xx${d}`); // Add "xx" prefix

        chartGroup.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis)
            .selectAll("text")
              .style("text-anchor", "center") // Ensure labels are centered
              .attr("dy", "1em"); // Adjust vertical position if needed


        // Y-Axis
        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => `${d}%`); // Add "%" suffix

        chartGroup.append("g")
            .attr("class", "y-axis")
            .call(yAxis);

        // Y-Axis Gridlines
        const yGridlines = d3.axisLeft(yScale)
            .tickSize(-width) // Extend ticks across the chart width
            .tickFormat(""); // No labels on gridlines

        chartGroup.append("g")
            .attr("class", "grid")
            .call(yGridlines)
            .selectAll("line")
                .attr("stroke", "#e0e0e0") // Light grey color for gridlines
                .attr("stroke-opacity", 0.7);
        chartGroup.select(".grid .domain").remove(); // Remove the gridline axis line

        // --- Process Data and Draw Lines/Points ---
        generations.forEach(series => {
            const seriesData = gpuData.filter(d => d.series === series);

            // Find flagship (assuming 'flagship' boolean exists and is reliable)
            let flagship = seriesData.find(d => d.flagship);
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
                .filter(d => d.normalizedCores !== null && d.columnIndex !== -1) // Filter out points with no data or unknown tier
                .sort((a, b) => a.columnIndex - b.columnIndex); // Sort by column index for line drawing


            // --- Define Line Generator ---
            const line = d3.line()
                .defined(d => d.normalizedCores !== null) // Ensure point has data
                .x(d => {
                    let targetIndex = d.columnIndex; // Start with the original column index
                    if (toggleMode) {
                        // Shift based on flagship's position
                        targetIndex = d.columnIndex - flagshipColumnIndex;
                    }
                     // Ensure the target index is within the bounds of our defined columns
                    if (targetIndex >= 0 && targetIndex < columnOrder.length) {
                         return xScale(columnOrder[targetIndex]); // Get X position from scale using the target column name
                    }
                    return undefined; // Point is shifted off the chart, `defined` will handle this below
                })
                .y(d => yScale(d.normalizedCores)) // Use yScale for Y position
                .defined(d => { // Add check here to prevent drawing points shifted off-chart
                     if (d.normalizedCores === null) return false;
                     if (toggleMode) {
                         const targetIndex = d.columnIndex - flagshipColumnIndex;
                         return targetIndex >= 0 && targetIndex < columnOrder.length; // Only define if within bounds
                     }
                     return true; // Always defined in normal mode (if cores exist)
                });


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
                    // Recalculate X position exactly as in the line generator
                    let targetIndex = d.columnIndex;
                    if (toggleMode) {
                        targetIndex = d.columnIndex - flagshipColumnIndex;
                    }
                    // Only return a coordinate if it's valid
                    if (targetIndex >= 0 && targetIndex < columnOrder.length) {
                       return xScale(columnOrder[targetIndex]);
                    }
                    return -9999; // Position off-screen if invalid (or could filter data)
                })
                .attr('cy', d => yScale(d.normalizedCores))
                .attr('r', d => { // Hide points shifted off-chart
                    let targetIndex = d.columnIndex;
                    if (toggleMode) {
                        targetIndex = d.columnIndex - flagshipColumnIndex;
                    }
                    return (targetIndex >= 0 && targetIndex < columnOrder.length) ? 4 : 0;
                })
                .attr('fill', colorScale(series))
                .append('title') // Tooltip
                    .text(d => `${d.model} (${d.series})\nCores: ${d.cudaCores}\nNormalized: ${d.normalizedCores.toFixed(1)}%`);
        });

        // --- Legend ---
        const legend = chartGroup.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width + 20}, 0)`); // Position legend to the right

        const legendItems = legend.selectAll(".legend-item")
            .data(generations)
            .enter().append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 20})`); // Space out legend items vertically

        legendItems.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", colorScale);

        legendItems.append("text")
            .attr("x", 20)
            .attr("y", 12) // Vertically align text with rect
            .text(d => d) // Display generation name
            .style("font-size", "12px")
            .attr("alignment-baseline", "middle");


    }, [toggleMode, gpuData]); // Re-run effect when toggleMode changes or data changes

    return (
        <div className="App">
            <h1 style={{ textAlign: 'center', margin: '20px 0' }}>Nvidia's Core-ner Cutting</h1>
            <button
                onClick={() => setToggleMode(!toggleMode)}
                style={{ display: 'block', margin: '10px auto', padding: '10px 20px', cursor: 'pointer' }}
            >
                {toggleMode ? "Show Absolute Tiers" : "Align Flagships (Normalize Start)"}
            </button>
            {/* Use the ref here */}
            <svg ref={svgRef} style={{ display: 'block', margin: '20px auto', background: '#f9f9f9' }}></svg>
        </div>
    );
}

export default App;
