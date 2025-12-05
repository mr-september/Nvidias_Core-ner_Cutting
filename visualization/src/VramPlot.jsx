// VramPlot.jsx
import React, { useEffect } from 'react';
import * as d3 from 'd3';
// App.css is imported in App.jsx
// gpuData, consoleData, columnOrder, getTierFromModel are passed as props
// vramSvgRef is passed as a prop
// state variables related to VRAM chart are passed as props

function VramPlot({
    vramSvgRef,
    gpuData,
    consoleData,
    columnOrder,
    getTierFromModel,
    selectedClasses,
    setSelectedClasses,
    showAllClasses,
    setShowAllClasses,
    showConsoleData,
    setShowConsoleData,
    visibleConsolePlatforms,
    setVisibleConsolePlatforms,
    memoryAllocationPercentage,
    setMemoryAllocationPercentage
}) {

    useEffect(() => {
         // Ensure data and ref are available
        if (!gpuData || !consoleData || !columnOrder || !getTierFromModel || !vramSvgRef.current) {
             console.warn("VramPlot: Missing required props or ref.");
             return;
        }

        // Create or select the VRAM tooltip container in the DOM
        if (!d3.select('body').select('.vram-tooltip-container').size()) {
            d3.select('body')
                .append('div')
                .attr('class', 'vram-tooltip-container')
                .style('position', 'absolute')
                .style('visibility', 'hidden')
                .style('background-color', 'rgba(30, 30, 30, 0.9)')
                .style('color', '#fff')
                .style('border-radius', '8px')
                .style('padding', '10px')
                .style('pointer-events', 'none')
                .style('box-shadow', '0 2px 10px rgba(0, 0, 0, 0.3)')
                .style('z-index', '10')
                .style('max-width', '200px')
                .style('font-size', '12px');
        }

        // Create or select the separate tooltip for console data
        if (!d3.select('body').select('.console-tooltip-container').size()) {
            d3.select('body')
                .append('div')
                .attr('class', 'console-tooltip-container')
                .style('position', 'absolute')
                .style('visibility', 'hidden')
                .style('background-color', 'rgba(30, 30, 30, 0.9)')
                .style('color', '#fff')
                .style('border-radius', '8px')
                .style('padding', '10px')
                .style('pointer-events', 'none')
                .style('box-shadow', '0 2px 10px rgba(0, 0, 0, 0.3)')
                .style('z-index', '10')
                .style('max-width', '220px')
                .style('font-size', '12px');
        }

        const svg = d3.select(vramSvgRef.current);
        svg.selectAll("*").remove(); // Clear previous renders

        // --- Chart Dimensions and Margins ---
        const margin = { top: 60, right: 350, bottom: 50, left: 90 }; // Increased right margin from 250 to 350
        const width = 1000 - margin.left - margin.right; // Increased total width from 900 to 1000
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
            // Include if this class is selected or if we're showing all generations (classes)
            return tier && (selectedClasses[tier] || showAllClasses);
        });

        // Determine if we have GPU data points to display
        const hasData = filteredData.length > 0;

        // Filter console data starting from Xbox 360/PlayStation 3 generation
        const filteredConsoleData = consoleData.filter(d =>
            d.launchYear >= 2005 // Xbox 360 was released in 2005
            && visibleConsolePlatforms[d.platform] // Filter by visible platforms state
        );

        // Get all years from both GPU and console data for proper scaling
        const gpuYears = hasData
            ? Array.from(new Set(filteredData.map(d => d.releaseYear))).sort((a, b) => a - b)
            : Array.from(new Set(gpuData.map(d => d.releaseYear))).sort((a, b) => a - b);

        const consoleYears = filteredConsoleData.map(d => d.launchYear);
        const allYears = [...new Set([...gpuYears, ...consoleYears])].sort((a, b) => a - b);

        // Use a wider domain for xScale if no years exist, to prevent errors
         const xScaleDomain = allYears.length > 0 ? allYears : [2000, 2025]; // Default range if no data

        // X scale for years - use all years from both datasets
        const xScale = d3.scalePoint()
            .domain(xScaleDomain)
            .range([0, width])
            .padding(0.5);

        // Process memory values for consoles
        filteredConsoleData.forEach(d => {
            // Check if memory is a fraction (like "256/1024") or a whole number (like "8")
            if (d.memory && typeof d.memory === 'string' && d.memory.includes("/")) {
                const [numerator, denominator] = d.memory.split("/").map(Number);
                // Convert to GB for the y-axis positioning
                d.memoryGB = numerator / denominator;
                // Store the original value as MB for display
                d.memoryDisplay = `${numerator} MB`;
            } else if (d.memory != null) {
                 // Already in GB or can be converted to number
                 d.memoryGB = Number(d.memory);
                 d.memoryDisplay = `${d.memory} GB`;
            } else {
                 d.memoryGB = 0; // Default if memory is null/undefined
                 d.memoryDisplay = "N/A";
            }
        });


        // Y scale for VRAM
        // Use a default max value if no data is available
        const maxGpuVram = hasData ? d3.max(filteredData, d => d.vram) : 0; // Use 0 if no filtered GPU data
        const maxConsoleMemory = d3.max(filteredConsoleData, d => d.memoryGB) || 0; // Use 0 if no console data
        const maxVram = Math.max(maxGpuVram, maxConsoleMemory);

        // Round up to nice value for y-axis
        const yMaxVram = Math.ceil(maxVram / 5) * 5 || 25; // Default to 25 GB if no data

        const yScale = d3.scaleLinear()
            .domain([0, yMaxVram])
            .range([height, 0]);


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

        // Display "No data" message if no GPU data is available but keep the chart structure
        if (!hasData && filteredConsoleData.length === 0) { // Show message only if neither has data
            chartGroup.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .attr("fill", "#ddd")
                .style("font-size", "14px")
                .text("No data to display based on current filters.");
        }

        // --- Console Data Visualization ---
        // Draw console backgrounds first so they appear underneath the GPU data points
        if (showConsoleData && filteredConsoleData.length > 0) {
            // Define base colors for platforms with additional variant for same-year launches
            const platformColors = {
                "PlayStation": {
                    base: "rgba(0, 112, 209, 0.15)",  // PlayStation blue
                    variant: "rgba(0, 180, 209, 0.15)" // Cyan variant
                },
                "Xbox": {
                    base: "rgba(16, 124, 16, 0.15)",  // Xbox green
                    variant: "rgba(16, 190, 120, 0.15)" // Cyan-green variant
                }
            };

            // Create a layer for console rectangles that will be underneath the GPU data points
            const consoleLayer = chartGroup.append("g").attr("class", "console-layer");

            // Process consoles to identify same-year launches and sort by year
            const consolesByYear = {};
             filteredConsoleData.forEach(console => {
                 if (!consolesByYear[console.launchYear]) {
                     consolesByYear[console.launchYear] = [];
                 }
                 consolesByYear[console.launchYear].push(console);
             });

             // Sort console data within each year by platform or name for consistent stacking if needed
             Object.values(consolesByYear).forEach(consoles => {
                 consoles.sort((a, b) => a.platform.localeCompare(b.platform)); // Sort by platform name
             });


            const allConsoleYears = Object.keys(consolesByYear).map(Number).sort((a, b) => a - b);

            // Add vertical grid lines at each console generation transition year (Only if consoles are shown)
            allConsoleYears.forEach(year => {
                const x = xScale(year);
                if (x !== undefined) {
                    // Find the console with the highest *scaled* memory in this year based on current percentage
                     const scaledMemoryValues = consolesByYear[year]
                         .map(c => {
                            // Only scale unified memory
                            const isDedicatedVRAM = (
                                c.name.includes('PS1') ||
                                c.name.includes('PS2') ||
                                c.name.includes('PS3')
                            );
                             return isDedicatedVRAM ? c.memoryGB : c.memoryGB * (memoryAllocationPercentage / 100);
                         });
                     const highestScaledMemory = Math.max(...scaledMemoryValues);
                     const y1 = yScale(highestScaledMemory); // Starting y position at the console's scaled memory level

                    // Draw a vertical grid line from the console's scaled memory level up to the top of the chart
                    consoleLayer.append("line")
                        .attr("x1", x)
                        .attr("y1", 0)  // Start from the top of the chart (y=0)
                        .attr("x2", x)
                        .attr("y2", y1)  // End at the console's memory level
                        .attr("stroke", "#e0e0e0")  // Same color as horizontal grid lines
                        .attr("stroke-opacity", 0.5)
                        .attr("stroke-width", 0.5)
                        .attr("class", "console-year-gridline");
                }
            });


            allConsoleYears.forEach(year => {
                // Get all consoles launched this year
                const consolesThisYear = consolesByYear[year];
                // Process each console in this year
                consolesThisYear.forEach((console, consoleIndex) => {
                    // For x-coordinate, use the console's launch year
                    const x = xScale(console.launchYear);
                    if (x === undefined) return; // Skip if year is not in the scale

                    // Calculate the console's actual y position based on memoryGB
                     const actualY = yScale(console.memoryGB);

                    // --- Unified memory scaling logic ---
                    // Only scale for consoles with unified memory (not PS1, PS2, PS3)
                    const isDedicatedVRAM = (
                        console.name.includes('PS1') ||
                        console.name.includes('PS2') ||
                        console.name.includes('PS3')
                    );
                    let scaledY = actualY; // Default to actual Y
                    if (!isDedicatedVRAM) {
                         // Calculate the distance from the x-axis (yScale(0)) to the console's actual memory position
                         const distanceToAxis = yScale(0) - actualY;
                         // Scale this distance by the memoryAllocationPercentage
                         const scaledDistance = distanceToAxis * (memoryAllocationPercentage / 100);
                         // The new y position is the x-axis position minus the scaled distance
                         scaledY = yScale(0) - scaledDistance;
                    }

                    // Calculate the right edge (either to the next year with consoles or the chart end)
                    // Find the next year that has consoles after this one
                    const currentYearIndex = allConsoleYears.indexOf(year);
                    const nextConsoleYear = allConsoleYears[currentYearIndex + 1];

                    // If there's a next year with consoles, use that as the boundary
                    let rightEdge = width;
                    if (nextConsoleYear) {
                        const nextX = xScale(nextConsoleYear);
                        if (nextX !== undefined) {
                            rightEdge = nextX;
                        }
                    }

                    const rectWidth = Math.max(rightEdge - x, 0); // Ensure width is not negative

                    // Determine if this is a variant (same-year launch)
                    const useVariant = consolesThisYear.length > 1 && consoleIndex > 0;
                    const fillColor = useVariant ?
                        platformColors[console.platform]?.variant :
                        platformColors[console.platform]?.base;

                    // Calculate label position - if same year launches, stagger them vertically
                    const labelOffsetY = useVariant ? (15 + (consoleIndex * 12)) : 15;

                    // Store console data on the year for lookup on hover (ensure array exists)
                    if (!consolesByYear[year].tooltipData) {
                         consolesByYear[year].tooltipData = [];
                    }
                    // Prevent duplicates if effect runs multiple times before cleanup
                    if (!consolesByYear[year].tooltipData.find(c => c.name === console.name)) {
                         consolesByYear[year].tooltipData.push(console);
                    }


                    if (x !== undefined && rectWidth > 0 && fillColor) { // Ensure fill color exists
                        // Draw the rectangle
                        consoleLayer.append("rect")
                            .attr("x", x)
                            .attr("y", 0)
                            .attr("width", rectWidth)
                            .attr("height", scaledY) // Use scaledY for height
                            .attr("fill", fillColor)
                            .attr("stroke", "none")
                            .attr("class", "console-rect")
                            .attr("data-year", year)
                            .on("mouseover", function(event) {
                                // Show and position tooltip
                                d3.select('.console-tooltip-container')
                                    .style('visibility', 'visible')
                                    .style('left', `${event.pageX + 15}px`)
                                    .style('top', `${event.pageY - 10}px`);

                                // Get all consoles for this year for the tooltip
                                const yearConsoles = consolesByYear[year];
                                let tooltipContent = '';

                                // Add info for each console in this year
                                if (yearConsoles && yearConsoles.tooltipData) {
                                    // Sort consoles for consistent tooltip order
                                    yearConsoles.tooltipData.sort((a, b) => a.platform.localeCompare(b.platform) || a.name.localeCompare(b.name));

                                    yearConsoles.tooltipData.forEach((consoleData, idx) => {
                                        const nodeInfo = consoleData.nodeNM ? `${consoleData.nodeNM}nm` : "N/A";
                                        tooltipContent += `
                                            ${idx > 0 ? '<hr style="border-top: 1px solid rgba(255,255,255,0.2); margin: 8px 0;">' : ''}
                                            <div class="tooltip-title">${consoleData.name}</div>
                                            <div class="tooltip-info">
                                                <strong>Year:</strong> ${consoleData.launchYear}<br>
                                                <strong>Launch Price:</strong> $${consoleData.launchPriceUSD}<br>
                                                <strong>Memory:</strong> ${consoleData.memoryDisplay}<br>
                                                <strong>Manufacturing Node:</strong> ${nodeInfo}
                                            </div>
                                        `;
                                    });
                                }

                                d3.select('.console-tooltip-container').html(tooltipContent);

                                // Highlight the rectangle
                                d3.select(this)
                                    .attr("fill", useVariant ?
                                        (console.platform === "PlayStation" ? "rgba(0, 180, 209, 0.3)" : "rgba(16, 190, 120, 0.3)") :
                                        (console.platform === "PlayStation" ? "rgba(0, 112, 209, 0.3)" : "rgba(16, 124, 16, 0.3)"));
                            })
                            .on('mouseout', function() {
                                // Hide tooltip
                                d3.select('.console-tooltip-container')
                                    .style('visibility', 'hidden');

                                // Return rectangle to normal opacity
                                d3.select(this)
                                    .attr("fill", fillColor);
                            });

                        // Add console name label at the top with vertical staggering for same-year launches
                        // Always show a label for key consoles, regardless of width
                        const isKeyConsole = console.name.includes("360") ||
                                           console.name.includes("4 Pro") ||
                                           console.name.includes("One X") ||
                                           console.name.includes("PS5") || // Add PS5/Series X as key consoles
                                           console.name.includes("Series X") ||
                                            console.name.includes("Series S");


                        if (rectWidth > 40 || isKeyConsole) {
                            // Standardize PlayStation labels to "PSx" format and keep Xbox labels as is
                            let labelText;

                            if (console.platform === "PlayStation") {
                                // Extract the number from PlayStation name (1, 2, 3, 4, 5, etc.)
                                const match = console.name.match(/(\d+)/);
                                if (match) {
                                    const number = match[1];
                                    labelText = "PS" + number; // Use PSx format

                                    // Add "Pro" suffix if it's a Pro model
                                    if (console.name.includes("Pro")) {
                                        labelText += " Pro";
                                    } else if (console.name.includes("Slim")) { // Add Slim if needed
                                         labelText += " Slim";
                                    }
                                } else {
                                    labelText = "PS"; // Fallback
                                }
                            } else {
                                // For Xbox, keep original shortened format
                                labelText = console.name.replace(console.platform + " ", ""); // e.g., "Series X" instead of "Xbox Series X"

                                // Special case for Xbox 360 in narrow spaces
                                if (isKeyConsole && rectWidth <= 40 && console.name.includes("360")) {
                                    labelText = "360";
                                } else if (isKeyConsole && rectWidth <= 40 && console.name.includes("One X")) {
                                    labelText = "One X";
                                } else if (isKeyConsole && rectWidth <= 40 && console.name.includes("Series S")) {
                                    labelText = "Series S";
                                }
                            }

                            // Position the label to ensure visibility
                            const xPos = Math.min(x + 5, x + rectWidth - 25); // Keep inside rectangle

                            // Special handling for PS4 Pro to avoid overlap with Xbox One X
                            // Check if we need to break the label into two lines
                            if (console.name.includes("4 Pro")) {
                                // Check if Xbox One X exists in the same year range AND Xbox platform is visible
                                const hasXboxOneX = filteredConsoleData.some(c => 
                                    c && c.name && 
                                    c.name.includes("One X") &&
                                    visibleConsolePlatforms["Xbox"] // Make sure Xbox is actually visible
                                );

                                // If Xbox One X exists and is being shown, break the label into two lines
                                if (hasXboxOneX) {
                                    // First create the "PS4" part of the label
                                    consoleLayer.append("text")
                                        .attr("x", xPos)
                                        .attr("y", labelOffsetY)
                                        .attr("fill", "#4a90e2") // PlayStation blue
                                        .style("font-size", "10px")
                                        .style("font-weight", "bold")
                                        .text("PS4");

                                    // Then add the "Pro" part on the next line
                                    consoleLayer.append("text")
                                        .attr("x", xPos)
                                        .attr("y", labelOffsetY + 12) // Move down by 12px
                                        .attr("fill", "#4a90e2") // PlayStation blue
                                        .style("font-size", "10px")
                                        .style("font-weight", "bold")
                                        .text("Pro");

                                    // Skip the normal label since we've already created a custom split one
                                    return;
                                }
                            }

                            // Normal label rendering (for consoles that don't need special handling)
                            consoleLayer.append("text")
                                .attr("x", xPos)
                                .attr("y", labelOffsetY) // Position above the chart area, staggered if needed
                                .attr("fill", console.platform === "PlayStation" ? "#4a90e2" : "#4caf50") // Use platform-specific colors
                                .style("font-size", "10px")
                                .style("font-weight", "bold")
                                .text(labelText);
                        }
                    }
                });
            });
        } // Close the showConsoleData block

        if (hasData) {
            // Only draw GPU data points and lines when we have GPU data

            // Create a color scale for GPU classes instead of generations
            const classColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(columnOrder);

            // Group data by GPU class
            const groupedByClass = {};
            columnOrder.forEach(gpuClass => {
                 // Ensure the class is selected or showAll is true AND there are GPUs in this class in the filteredData
                 const gpusInClass = filteredData.filter(d => getTierFromModel(d.model) === gpuClass);

                 if ((selectedClasses[gpuClass] || showAllClasses) && gpusInClass.length > 0) {
                     groupedByClass[gpuClass] = gpusInClass
                         .sort((a, b) => a.releaseYear - b.releaseYear);
                 }
            });


            // Draw lines for each GPU class
            Object.entries(groupedByClass).forEach(([gpuClass, gpusInClass]) => {
                // Line generator
                const line = d3.line()
                    .defined(d => d.vram != null && d.vram > 0 && xScale(d.releaseYear) !== undefined && yScale(d.vram) !== undefined) // Ensure valid data and scale mapping
                    .x(d => xScale(d.releaseYear))
                    .y(d => yScale(d.vram));

                // Draw line with class color instead of gray
                chartGroup.append('path')
                    .datum(gpusInClass)
                    .attr('class', 'series-line')
                    .attr('fill', 'none')
                    .attr('stroke', classColorScale(gpuClass)) // Use class color for dashed lines
                    .attr('stroke-width', 1.5)
                    .attr('stroke-dasharray', '3,3') // Dashed lines
                    .attr('d', line);

                // Draw points with enhanced hover functionality
                chartGroup.selectAll(`.vram-dot-${gpuClass.replace(/\s+/g, '-')}`) // Sanitize class name
                    .data(gpusInClass.filter(d => d.vram != null && d.vram > 0)) // Filter again for points
                    .enter().append('circle')
                    .attr('class', `vram-dot vram-dot-${gpuClass.replace(/\s+/g, '-')}`)
                    .attr('cx', d => xScale(d.releaseYear))
                    .attr('cy', d => yScale(d.vram))
                    .attr('r', 4)
                    .attr('fill', classColorScale(gpuClass)) // Use class color for dots
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 0.5)
                    .on('mouseover', function(event, d) {
                        // Show and position tooltip
                        d3.select('.vram-tooltip-container')
                            .style('visibility', 'visible')
                            .style('left', `${event.pageX + 15}px`)
                            .style('top', `${event.pageY - 10}px`);

                        // Create tooltip content
                        const tooltipContent = `
                            <div class="tooltip-title" style="color: ${classColorScale(getTierFromModel(d.model))};">${d.model}</div>
                            <div class="tooltip-info">
                                <strong>Series:</strong> ${d.series} series<br>
                                <strong>VRAM:</strong> ${d.vram} GB<br>
                                <strong>Year:</strong> ${d.releaseYear}<br>
                                <strong>CUDA Cores:</strong> ${d.cudaCores ? d.cudaCores.toLocaleString() : 'N/A'}
                            </div>
                        `;

                        d3.select('.vram-tooltip-container').html(tooltipContent);

                        // Highlight the point
                        d3.select(this)
                            .attr('r', 6)
                            .attr('stroke-width', 2);
                    })
                    .on('mouseout', function() {
                        // Hide tooltip
                        d3.select('.vram-tooltip-container')
                            .style('visibility', 'hidden');

                        // Return point to normal size
                        d3.select(this)
                            .attr('r', 4)
                            .attr('stroke-width', 0.5);
                    });
            });
        } // Close the hasData block

        // --- Legend and Controls ---
        // Add legend for VRAM chart with checkboxes - always show this regardless of data
        const vramLegend = chartGroup.append("g")
            .attr("class", "vram-legend")
            .attr("transform", `translate(${width + 20}, 0)`); // Position legend to the right

        // Add "GPU Classes" title to legend - centered
        vramLegend.append("text")
            .attr("x", 40) // Centered position (relative to legend group)
            .attr("y", -20)
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", "#ddd")
            .attr("text-anchor", "middle") // Center the text
            .text("GPU Classes");

        // Create a color scale for GPU classes (defined inside effect as it's used here)
        const classColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(columnOrder);

        // Create legend items with checkboxes for each GPU class (Calls setSelectedClasses)
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
            .attr("fill", d => selectedClasses[d] ? classColorScale(d) : "#555") // Use class-specific color when active
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("cursor", "pointer")
            .attr("opacity", d => selectedClasses[d] ? 1 : 0.5)
            .attr("class", "class-checkbox")
            .on("click", function(event, d) {
                 if (setSelectedClasses && setshowAllClasses) {
                    setSelectedClasses(prev => {
                        const newState = {
                            ...prev,
                            [d]: !prev[d]
                        };

                        // If we're deselecting a class and "Show All" is active, uncheck "Show All"
                        if (prev[d] && showAllClasses) {
                            setshowAllClasses(false);
                        }

                        // If all classes become selected, check "Show All"
                        const allSelected = columnOrder.every(cls => newState[cls] === true);
                        if (allSelected) {
                            setshowAllClasses(true);
                        }

                        return newState;
                    });
                 }
            });

        // Label for each GPU class with toggle functionality
        legendItems.append("text")
            .attr("x", 25)
            .attr("y", 12)
            .attr("fill", d => selectedClasses[d] ? "#ddd" : "#777")
            .style("font-size", "12px")
            .text(d => `xx${d}`)
            .attr("cursor", "pointer")
            .attr("alignment-baseline", "middle")
            .on("click", function(event, d) {
                 if (setSelectedClasses && setshowAllClasses) {
                    // Toggle this class's visibility (same as rect click)
                    setSelectedClasses(prev => {
                         const newState = {
                            ...prev,
                            [d]: !prev[d]
                        };
                         // If we're deselecting a class and "Show All" is active, uncheck "Show All"
                        if (prev[d] && showAllClasses) {
                            setshowAllClasses(false);
                        }

                        // If all classes become selected, check "Show All"
                        const allSelected = columnOrder.every(cls => newState[cls] === true);
                        if (allSelected) {
                            setshowAllClasses(true);
                        }
                         return newState;
                    });
                 }
            });

        // Add "Show All" checkbox at the bottom (Calls setSelectedClasses, setshowAllClasses)
        const showAllGroup = vramLegend.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${columnOrder.length * 25 + 10})`);

        showAllGroup.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("stroke", "#ddd")
            .attr("fill", showAllClasses ? "#646cff" : "transparent")
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("cursor", "pointer")
            .on("click", function() {
                 if (setSelectedClasses && setshowAllClasses) {
                    // Check if we're currently showing all
                    if (showAllClasses) {
                        // If already showing all, switch to hiding all
                        const allFalse = {};
                        columnOrder.forEach(cls => {
                            allFalse[cls] = false;
                        });
                        setSelectedClasses(allFalse);
                        setshowAllClasses(false); // Uncheck "Show All"
                    } else {
                        // If not showing all, set all to true
                         const allTrue = {};
                         columnOrder.forEach(cls => {
                            allTrue[cls] = true;
                         });
                         setSelectedClasses(allTrue);
                         setshowAllClasses(true); // Check "Show All"
                    }
                 }
            });

        showAllGroup.append("text")
            .attr("x", 25)
            .attr("y", 12)
            .attr("fill", "#ddd")
            .style("font-size", "12px")
            .text("Show All Classes")
            .attr("alignment-baseline", "middle");

        // Add console data toggle checkbox (Calls setShowConsoleData)
        const consoleToggleGroup = vramLegend.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${columnOrder.length * 25 + 40})`);

        consoleToggleGroup.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("stroke", "#ddd")
            .attr("fill", showConsoleData ? "#646cff" : "transparent")
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("cursor", "pointer")
            .on("click", function() {
                 if (setShowConsoleData) {
                    setShowConsoleData(showConsoleData => !showConsoleData);
                 }
            });

        consoleToggleGroup.append("text")
            .attr("x", 25)
            .attr("y", 12)
            .attr("fill", "#ddd")
            .style("font-size", "12px")
            .text("Show Console Data")
            .attr("alignment-baseline", "middle");

        // Add console platform legend (Only if console data is shown) (Calls setVisibleConsolePlatforms)
        if (showConsoleData) {
            const platformLegendGroup = vramLegend.append("g")
                .attr("class", "platform-legend")
                .attr("transform", `translate(25, ${columnOrder.length * 25 + 70})`);

            // PlayStation indicator with toggle functionality
            const psRect = platformLegendGroup.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 15)
                .attr("height", 15)
                .attr("fill", visibleConsolePlatforms["PlayStation"] ? "rgba(0, 112, 209, 0.5)" : "#555")
                .attr("stroke", "#ddd")
                .attr("stroke-width", 0.5)
                .attr("rx", 3)
                .attr("ry", 3)
                .attr("cursor", "pointer")
                .attr("opacity", visibleConsolePlatforms["PlayStation"] ? 1 : 0.5);

            // PlayStation text
            const psText = platformLegendGroup.append("text")
                .attr("x", 25)
                .attr("y", 12)
                .attr("fill", visibleConsolePlatforms["PlayStation"] ? "#ddd" : "#777")
                .style("font-size", "12px")
                .style("cursor", "pointer")
                .text("PlayStation");

            // Create a clickable group for PlayStation
            const psGroup = platformLegendGroup.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 100)
                .attr("height", 15)
                .attr("fill", "transparent")
                .attr("cursor", "pointer")
                .on("click", function() {
                    if (setVisibleConsolePlatforms) {
                         const newValue = !visibleConsolePlatforms["PlayStation"];
                         setVisibleConsolePlatforms(prev => ({
                             ...prev,
                             "PlayStation": newValue
                         }));
                    }
                });

            // Xbox indicator with toggle functionality
            const xboxRect = platformLegendGroup.append("rect")
                .attr("x", 0)
                .attr("y", 25)
                .attr("width", 15)
                .attr("height", 15)
                .attr("fill", visibleConsolePlatforms["Xbox"] ? "rgba(16, 124, 16, 0.5)" : "#555")
                .attr("stroke", "#ddd")
                .attr("stroke-width", 0.5)
                .attr("rx", 3)
                .attr("ry", 3)
                .attr("cursor", "pointer")
                .attr("opacity", visibleConsolePlatforms["Xbox"] ? 1 : 0.5);

            // Xbox text
            const xboxText = platformLegendGroup.append("text")
                .attr("x", 25)
                .attr("y", 37)
                .attr("fill", visibleConsolePlatforms["Xbox"] ? "#ddd" : "#777")
                .style("font-size", "12px")
                .style("cursor", "pointer")
                .text("Xbox");

            // Create a clickable group for Xbox
            const xboxGroup = platformLegendGroup.append("rect")
                .attr("x", 0)
                .attr("y", 25)
                .attr("width", 100)
                .attr("height", 15)
                .attr("fill", "transparent")
                .attr("cursor", "pointer")
                .on("click", function() {
                     if (setVisibleConsolePlatforms) {
                        const newValue = !visibleConsolePlatforms["Xbox"];
                        setVisibleConsolePlatforms(prev => ({
                            ...prev,
                            "Xbox": newValue
                        }));
                     }
                });
        }

        // Position the unified memory slider under the legend, properly aligned and matching style
        // Create a header with the same style as the GPU Classes header
        const memoryControlHeaderY = -20;
         vramLegend.append("text")
            .attr("x", 80) // Position relative to the legend group
            .attr("y", memoryControlHeaderY)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", "#ddd")
            .attr("transform", `translate(75, 0)`) // Offset to the right of the first header
            .text("Unified Memory");


        // Create a new group for the memory controls, positioned next to the GPU Classes legend
        const memoryControlGroup = vramLegend.append("g")
            .attr("class", "memory-control-group")
            .attr("transform", `translate(120, 0)`); // Position it better aligned with the header

        const sliderGroup = memoryControlGroup.append("g")
            .attr("class", "memory-slider-group");

        const trackY = 50; // Define vertical starting point for the track
        const sliderHeight = 215;
        const sliderWidth = 14;
        const sliderX = 35 - (sliderWidth / 2); // Center the slider track horizontally (x=28)

        // Add subtitle for the slider - Adjusted Position
        sliderGroup.append("text")
            .attr("x", 35) // Center horizontally above the track
            .attr("y", 15) // Positioned near the top
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("fill", "#aaa")
            .text("% dedicated to VRAM");

        // Add current value display - Adjusted Position
        const valueText = sliderGroup.append("text")
            .attr("x", 35) // Center horizontally above the track
            .attr("y", 35) // Positioned below the title, above the track
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", "#646cff")
            .text(`${memoryAllocationPercentage}%`);

        // Create a scale for the slider - Maps percentage (domain) to pixel position (range)
        const sliderScale = d3.scaleLinear()
            .domain([0, 100]) // Input: Percentage
            .range([sliderHeight, 0]) // Output: Pixel offset from top of track (0% is at bottom, 100% is at top)
            .clamp(true);

        // Draw the slider track - Adjusted Y
        sliderGroup.append("rect")
            .attr("x", sliderX)
            .attr("y", trackY) // Use trackY
            .attr("width", sliderWidth)
            .attr("height", sliderHeight)
            .attr("rx", 4)
            .attr("fill", "rgba(60, 60, 60, 0.3)")
            .attr("stroke", "#666")
            .attr("stroke-width", 1);

        // Add marks to the slider - Adjusted Y calculation and Label X position
        [0, 25, 50, 75, 100].forEach(value => {
            const y = sliderScale(value) + trackY; // Calculate position relative to trackY

            // Draw tick mark
            sliderGroup.append("line")
                .attr("x1", sliderX - 3)
                .attr("y1", y)
                .attr("x2", sliderX + sliderWidth + 3)
                .attr("y2", y)
                .attr("stroke", value === 50 ? "#aaa" : "#777")
                .attr("stroke-width", value === 50 ? 1.5 : 1);

            // Add label - MOVED FURTHER RIGHT
            sliderGroup.append("text")
                .attr("class", "tick-label-text") // Add class for selection
                .attr("x", sliderX + sliderWidth + 15) // Increased offset to prevent overlap
                .attr("y", y + 4) // Vertically align with tick
                .attr("text-anchor", "start")
                .style("font-size", "10px")
                .attr("fill", value === memoryAllocationPercentage ? "#646cff" : "#aaa")
                .attr("font-weight", value === memoryAllocationPercentage ? "bold" : "normal")
                .text(`${value}%`);
        });

        // Calculate handle's Y position based on current percentage and trackY
        const handleY = sliderScale(memoryAllocationPercentage) + trackY;

        // Draw the slider handle glow effect - Adjusted Y
        const handleGlow = sliderGroup.append("rect")
            .attr("x", sliderX - 4)
            .attr("y", handleY - 7) // Centered vertically on handleY
            .attr("width", sliderWidth + 8)
            .attr("height", 14)
            .attr("rx", 7)
            .attr("fill", "rgba(100, 108, 255, 0.2)")
            .attr("filter", "blur(2px)");

        // Draw the actual handle - Adjusted Y
        const handle = sliderGroup.append("rect")
            .attr("x", sliderX - 3)
            .attr("y", handleY - 6) // Centered vertically on handleY
            .attr("width", sliderWidth + 6)
            .attr("height", 12)
            .attr("rx", 6)
            .attr("fill", "#646cff")
            .attr("stroke", "#ddd")
            .attr("stroke-width", 0.5)
            .attr("cursor", "pointer")
            .attr("class", "slider-handle");

        // Add small indicator arrows - Adjusted Y
        const arrowSize = 4;
        const createArrowPath = (yPos, direction) => {
            const arrowY = yPos + (direction === 'up' ? -3.5 : 3.5); // Center the arrow base
            const tipY = yPos + (direction === 'up' ? -arrowSize - 1.5 : arrowSize + 1.5);
             // Ensure path coordinates are valid numbers
             if (isNaN(arrowY) || isNaN(tipY)) return "";
            return `M ${sliderX + sliderWidth/2 - arrowSize/2} ${arrowY}
                    L ${sliderX + sliderWidth/2 + arrowSize/2} ${arrowY}
                    L ${sliderX + sliderWidth/2} ${tipY}Z`;
        };

        const topArrow = sliderGroup.append("path")
            .attr("class", "slider-arrow top-arrow")
            .attr("d", createArrowPath(handleY, 'up'))
            .attr("fill", "#fff");

        const bottomArrow = sliderGroup.append("path")
            .attr("class", "slider-arrow bottom-arrow")
            .attr("d", createArrowPath(handleY, 'down'))
            .attr("fill", "#fff");


        // Add drag behavior to the handle (Calls setMemoryAllocationPercentage)
        const drag = d3.drag()
            .on("start", function() {
                d3.select(this).attr("fill", "#535bf2"); // Darken on drag start
            })
            .on("start drag", function(event) {
                // Create a property to store initial values if this is the drag start
                if (!this.initialDragData) {
                    const handlePosition = parseFloat(d3.select(this).attr("y")) + 6; // Get current handle center position (+6 because handle is centered)
                    this.initialDragData = {
                        handlePosition: handlePosition,
                        eventY: event.sourceEvent.clientY
                    };
                }
                
                // Calculate the displacement from the initial position
                const displacement = event.sourceEvent.clientY - this.initialDragData.eventY;
                
                // Apply the displacement to the original handle position
                const dragY = this.initialDragData.handlePosition + displacement;
                
                // Calculate the constrained position within track boundaries
                const newY = Math.max(trackY, Math.min(trackY + sliderHeight, dragY)); // Constrain Y relative to sliderGroup and trackY

                // Update handle position (y is relative to parent group)
                handle.attr("y", newY - 6); // Center handle vertically around newY

                // Update the glow effect position
                handleGlow.attr("y", newY - 7); // Center glow vertically around newY

                // Update arrows position
                 topArrow.attr("d", createArrowPath(newY, 'up'));
                 bottomArrow.attr("d", createArrowPath(newY, 'down'));

                // Calculate the percentage directly from position within the track
                // newY is relative to sliderGroup, trackY is the top of the track relative to sliderGroup
                const positionInTrack = newY - trackY; // Distance from top of track
                const percentageFromTop = positionInTrack / sliderHeight; // 0 at top, 1 at bottom
                const percentageFromBottom = 1 - percentageFromTop; // 0 at bottom, 1 at top (0% at bottom, 100% at top)
                const newValue = Math.round(percentageFromBottom * 100);

                // Ensure value is within bounds (0-100)
                const boundedValue = Math.max(0, Math.min(100, newValue));

                // Update the display text
                valueText.text(`${boundedValue}%`);

                // Highlight the correct tick label
                 sliderGroup.selectAll(".tick-label-text")
                    .attr("fill", d => d === boundedValue ? "#646cff" : "#aaa")
                    .attr("font-weight", d => d === boundedValue ? "bold" : "normal");

                // Update the React state (this triggers the chart re-render eventually)
                 // Only update state if the value has changed to prevent unnecessary re-renders
                 if (boundedValue !== memoryAllocationPercentage && setMemoryAllocationPercentage) {
                    setMemoryAllocationPercentage(boundedValue);
                 }
            })
            .on("end", function() {
                d3.select(this).attr("fill", "#646cff"); // Restore color on drag end
            });

        // Apply drag behavior to handle
        handle.call(drag);


        // Add description text below slider - Adjusted Position and Spacing
        const descriptionYStart = trackY + sliderHeight + 25; // Start further below track

        // Add subtitle explaining line colors
        vramLegend.append("text")
            .attr("x", 0) // Position relative to vramLegend group
            .attr("y", columnOrder.length * 25 + (showConsoleData ? 290 : 240)) // Position depends on console legend
            .attr("fill", "#aaa")
            .style("font-size", "11px")
            .text("* Colors represent GPU classes");


            // Cleanup function to remove tooltips created by D3
             return () => {
                 d3.select('.vram-tooltip-container').remove();
                 d3.select('.console-tooltip-container').remove();
             };


    }, [
        vramSvgRef,
        gpuData,
        consoleData,
        columnOrder,
        getTierFromModel,
        selectedClasses, // Dependency for filtering and legend opacity/color
        setSelectedClasses, // Dependency for legend click handlers
        showAllClasses, // Dependency for filtering and legend checkbox state
        setshowAllClasses, // Dependency for legend checkbox clicks
        showConsoleData, // Dependency for drawing console data and positioning elements
        setShowConsoleData, // Dependency for console data toggle button
        visibleConsolePlatforms, // Dependency for filtering console data and platform legend opacity/color
        setVisibleConsolePlatforms, // Dependency for platform legend clicks
        memoryAllocationPercentage, // Dependency for console bar height and slider position/text
        setMemoryAllocationPercentage // Dependency for slider drag handler
    ]); // Re-run effect when these props change

    return (
        // The SVG element where D3 will draw the chart
         <svg ref={vramSvgRef} style={{ display: 'block', margin: '20px auto' }}></svg>
    );
}

export default VramPlot;
