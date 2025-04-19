import React, { useEffect } from 'react';
import * as d3 from 'd3';
// App.css is imported in App.jsx and applies globally
// gpuData, consoleData, columnOrder, getTierFromModel are passed as props
// svgRef is passed as a prop
// state variables related to CUDA chart are passed as props

function CudaPlot({
    svgRef,
    gpuData,
    columnOrder,
    getTierFromModel,
    toggleMode,
    useLogScale,
    specialFlagshipActive,
    setSpecialFlagshipActive, // Need to pass setter down for legend clicks
    activeGenerations,
    setActiveGenerations, // Need to pass setter down for legend clicks
    showAllCudaGenerations, // Need to pass value down for legend checkbox logic
    setShowAllCudaGenerations, // Need to pass setter down for legend checkbox clicks
    // Tooltip props are passed but tooltip rendering is handled by D3 here
    tooltipData,
    tooltipPosition,
    setTooltipData, // Passed down for column hover handler (though D3 does the work)
    setTooltipPosition, // Passed down for column hover handler (though D3 does the work)
    handleColumnHover, // Passed down as D3 event handler (D3 logic duplicates this)
    handleColumnLeave // Passed down as D3 event handler (D3 logic duplicates this)
}) {

    useEffect(() => {
        // Ensure data and ref are available before attempting to draw
        if (!gpuData || !columnOrder || !getTierFromModel || !svgRef.current) {
             console.warn("CudaPlot: Missing required props or ref.");
             return;
        }

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove(); // Clear previous renders

        // --- Chart Dimensions and Margins ---
        const margin = { top: 60, right: 250, bottom: 50, left: 90 }; // Increased left margin
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

        // Add tooltip container to the DOM if it doesn't exist
        // Keeping D3 managing this element as per original code structure
        if (!d3.select('body').select('.tooltip-container').size()) {
             d3.select('body')
                .append('div')
                .attr('class', 'tooltip-container')
                .style('position', 'absolute')
                .style('visibility', 'hidden');
        } else {
            // Ensure it's hidden on redraw
            d3.select('.tooltip-container').style('visibility', 'hidden');
        }


        // --- Scales ---
        const xScale = d3.scalePoint()
            .domain(columnOrder)
            .range([0, width])
            .padding(0.5);

        // Find maximum CUDA cores for absolute mode
        const maxCudaCores = d3.max(gpuData, d => d.cudaCores || 0); // Use 0 if null/undefined
        // Round up to nice value for y-axis (used for linear scale)
        const yMaxAbsolute = Math.ceil(maxCudaCores / 1000) * 1000;

        // Calculate a nicer rounded maximum for log scale (round to first significant digit)
        const calculateLogMax = (value) => {
            if (!value || value <= 0) return 1000; // Handle edge cases, ensure > 0
            const numDigits = Math.floor(Math.log10(value)) + 1;
            const scale = Math.pow(10, numDigits - 1);
            return Math.ceil(value / scale) * scale;
        };
        const yMaxLog = calculateLogMax(maxCudaCores);

        // Create appropriate scale based on toggle mode and log scale setting
        let yScale;
        if (toggleMode) {
            // Always use linear scale for normalized mode (percentage)
            yScale = d3.scaleLinear()
                .domain([0, 110])
                .range([height, 0]);
        } else if (useLogScale) {
            // Use log scale for absolute mode when toggled on
            // *** FIX: Revert lower domain bound to 100 as in original code ***
             yScale = d3.scaleLog()
                .domain([100, yMaxLog]) // Use fixed 100 for lower bound + calculated max
                .range([height, 0]);
        } else {
            // Default linear scale for absolute mode
            yScale = d3.scaleLinear()
                .domain([0, yMaxAbsolute])
                .range([height, 0]);
        }

        // Sort generations by year first, then by series number (ascending for same year)
        const generationsWithInfo = Array.from(new Set(gpuData.map(d => d.series)))
            .map(series => {
                // Find the earliest card of this series to get its first release year
                const seriesCards = gpuData.filter(d => d.series === series);
                const earliestYear = seriesCards.length > 0 ? 
                    Math.min(...seriesCards.map(card => card.releaseYear)) : 0;
                return {
                    series,
                    releaseYear: earliestYear, // Use earliest release year in the series
                    seriesNum: parseInt(series, 10) || 0
                };
            })
            .sort((a, b) => {
                // Sort by release year (ascending - earliest first)
                if (a.releaseYear !== b.releaseYear) {
                    return a.releaseYear - b.releaseYear;
                }
                // For same release year, sort by series number (ascending - lower number first)
                return a.seriesNum - b.seriesNum;
            });
        
        // Extract just the series names in the correct order
        const generations = generationsWithInfo.map(g => g.series);
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(generations);


        // --- Axes ---
        // X-Axis
        const xAxis = d3.axisBottom(xScale)
            .tickFormat(d => {
                if (d === "90 Ti" && toggleMode) return "Flagship";
                return `xx${d}`;
            });

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

        // Create an object to organize data by column for hover overlay
        const processedDataByColumn = {};
        columnOrder.forEach(column => {
            processedDataByColumn[column] = [];
        });

        // --- Process Data and Draw Lines/Points ---            // Find the 2000 series flagship for normalizing the 1600 series
        const series2000Data = gpuData.filter(d => d.series === "2000");
        const regularFlagship2000 = series2000Data.find(d => d.flagship);
        const specialFlagship2000 = series2000Data.find(d => d.specialFlagship);
        // Use special 2080 Ti if special flagship for 2000 series is active, otherwise use regular 2080
        const useSpecial2000 = specialFlagshipActive["2000"] && specialFlagship2000;
        const flagship2000 = useSpecial2000 ? specialFlagship2000 : regularFlagship2000;
        
        // Always use the same flagship for 1600 series as is used for 2000 series
        // This ensures proper connection between the two series
        if (specialFlagshipActive["2000"] !== specialFlagshipActive["1600"]) {
            setSpecialFlagshipActive(prev => ({
                ...prev,
                "1600": specialFlagshipActive["2000"]
            }));
        }


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
            // For 1600 series, use the 2000 series flagship (RTX 2080 Ti or 2080 based on toggle)
            let flagship;
            if (series === "1600" && flagship2000) {
                 // Ensure flagship2000 has CUDA cores before using it as reference
                 if (flagship2000.cudaCores == null || flagship2000.cudaCores <= 0) {
                      console.warn(`2000 series flagship (${flagship2000.model}) has invalid CUDA cores. Cannot normalize 1600 series.`);
                       // Fallback for 1600 series if 2000 series flagship is bad
                       flagship = seriesData.find(d => d.flagship); // Use 1600's own flagship (if exists) as a last resort
                 } else {
                    flagship = flagship2000; // Use 2000 series flagship for 1600 series normalization
                 }
            } else {
                flagship = useSpecial ? specialFlagship : regularFlagship;
            }

            if (!flagship || flagship.cudaCores == null || flagship.cudaCores <= 0) {
                 // Fallback: find highest CUDA card if no explicit flagship or flagship has invalid cores
                 const fallbackFlagship = [...seriesData].sort((a, b) => (b.cudaCores || 0) - (a.cudaCores || 0))[0];
                 if (!fallbackFlagship || fallbackFlagship.cudaCores == null || fallbackFlagship.cudaCores <= 0) {
                    console.warn(`No valid flagship (or fallback) found for series ${series}. Skipping.`);
                    return; // Skip this series if no flagship can be determined
                 }
                 flagship = fallbackFlagship;
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
                    // Calculate normalized cores only if data is valid
                    const normalizedCores = d.cudaCores != null && flagshipCores > 0 ? (d.cudaCores / flagshipCores) * 100 : null;
                    return {
                        ...d,
                        normalizedCores: normalizedCores,
                        tier: tier,
                        columnIndex: columnIndex, // Store the original column index
                    };
                })
                .filter(d => {
                    // Determine if this card is the currently selected flagship for this series
                    const isCurrentSeriesFlagship = (useSpecial && d.specialFlagship) || (!useSpecial && d.flagship);

                    // Special case: 2000 series flagship used as reference for 1600 series
                    const is2000FlagshipForReference = toggleMode && 
                        series === "1600" && 
                        d.series === "2000" && 
                        (d.flagship || d.specialFlagship) && 
                        activeGenerations["1600"] !== false && 
                        activeGenerations["2000"] !== false;
                    
                    // 1. Keep regular non-flagship cards
                    const isRegularCard = !d.flagship && !d.specialFlagship;
                    
                    // 2. Keep the appropriate flagship for this series (except for 1600 which uses 2000's flagship)
                    const isSelectedFlagship = series !== "1600" && isCurrentSeriesFlagship;
                    
                    // 3. Basic data validity checks
                    const hasValidCoreData = d.cudaCores != null && d.cudaCores > 0;
                    const hasValidPosition = d.columnIndex !== -1;
                    const hasValidNormalizedData = !toggleMode || d.normalizedCores !== null;

                    return (isRegularCard || isSelectedFlagship || is2000FlagshipForReference) &&
                           hasValidCoreData &&
                           hasValidNormalizedData &&
                           hasValidPosition;
                })
                .sort((a, b) => a.columnIndex - b.columnIndex);

            // Use processed data directly for drawing lines
            const dataForLine = processedData;
            
            // Filter data for drawing points (requires valid core data)
            const dataForPoints = processedData.filter(d =>
                d.cudaCores != null && (toggleMode ? d.normalizedCores !== null : d.cudaCores > 0)
            );


            // --- Define Line Generator ---
            const line = d3.line()
                 // *** FIX: Revert defined logic to original ***
                .defined(d => d.normalizedCores !== null) // Original logic
                .x(d => {
                    // Determine if this GPU should be moved to the flagship column in toggle mode
                    // Only move special flagships when toggled on, or regular flagship when no special is active
                    const isCurrentSeriesFlagship = (useSpecial && d.specialFlagship) || (!useSpecial && d.flagship);
                    const is2000FlagshipUsedFor1600 = toggleMode && series === "1600" && d.series === "2000" && (d.flagship || d.specialFlagship);
                    // 1600 series points should stay in their original columns
                    const is1600Series = series === "1600" && d.series === "1600";
                    
                    if (!toggleMode || (!isCurrentSeriesFlagship && !is2000FlagshipUsedFor1600) || is1600Series) {
                        // Use original position if:
                        // 1. Not in toggle mode, OR
                        // 2. Not the current series' selected flagship and not the 2000 series reference point, OR
                        // 3. It's a 1600 series card (keep in original column)
                         const xPos = xScale(columnOrder[d.columnIndex]);
                         return xPos !== undefined ? xPos : null; // Return null if column not found
                    } else {
                        // Only move actual flagships to the "90 Ti" column in toggle mode
                        const targetIndex = columnOrder.indexOf("90 Ti");
                        if (targetIndex !== -1) {
                             // Only position the actual flagships at the 90 Ti column,
                             // NOT the 1600 series cards
                            if (series !== "1600" && isCurrentSeriesFlagship) {
                                return xScale(columnOrder[targetIndex]);
                             }
                             // If it's the 2000 flagship point included for the 1600 line, position it at the 90 Ti column.
                            if (is2000FlagshipUsedFor1600) {
                                return xScale(columnOrder[targetIndex]);
                            }
                        }
                         const xPos = xScale(columnOrder[d.columnIndex]); // Fallback
                         return xPos !== undefined ? xPos : null; // Return null if column not found
                    }
                })
                .y(d => {
                    const yVal = toggleMode ? d.normalizedCores : d.cudaCores;
                     // Ensure value is > 0 for log scale and not null/undefined
                    if (!toggleMode && useLogScale && (yVal == null || yVal <= 0)) return null;
                    if (toggleMode && yVal == null) return null; // Ensure normalized is not null

                   const yPos = yScale(yVal);
                   return yPos !== undefined ? yPos : null; // Return null if y value maps outside domain/range
                })


             // --- Draw Line ---
             chartGroup.append('path')
                 // *** FIX: Use dataForLine which may include the 2000 reference point for 1600 line ***
                .datum(dataForLine)
                .attr('class', 'series-line')
                .attr('fill', 'none')
                .attr('stroke', colorScale(series))
                .attr('stroke-width', 2)
                .attr('d', line);

             // --- Draw Points ---
             chartGroup.selectAll(`.dot-${series.replace(/\s+/g, '-')}`) // Sanitize class name
                 // *** FIX: Use dataForPoints which is filtered for drawing specific points ***
                .data(dataForPoints) // Use filtered data for points
                .enter().append('circle')
                .attr('class', `series-dot dot-${series.replace(/\s+/g, '-')}`)
                .attr('cx', d => {
                    // Determine if this GPU should be moved to the flagship column in toggle mode
                    // Only move special flagships when toggled on, or regular flagship when no special is active
                    const isCurrentSeriesFlagship = (useSpecial && d.specialFlagship) || (!useSpecial && d.flagship);
                    
                    // 1600 series points should NOT be moved to the flagship column
                    const is1600Series = series === "1600" && d.series === "1600";

                    if (!toggleMode || !isCurrentSeriesFlagship || is1600Series) {
                        // Use original position if:
                        // 1. Not in toggle mode, OR
                        // 2. Not the current series' selected flagship, OR
                        // 3. It's a 1600 series card (keep in original column)
                        return xScale(columnOrder[d.columnIndex]);
                    } else {
                        const targetIndex = columnOrder.indexOf("90 Ti");
                        if (targetIndex !== -1) {
                            return xScale(columnOrder[targetIndex]);
                        }
                        return xScale(columnOrder[d.columnIndex]); // Fallback
                    }
                })
                .attr('cy', d => toggleMode ?
                   yScale(d.normalizedCores) :
                   yScale(d.cudaCores)) // Use different y value based on mode
                .attr('r', 4)
                .attr('fill', colorScale(series))
                .append('title') // Basic tooltip for individual points
                    .text(d => {
                        if (!toggleMode) {
                            return `${d.model} (${d.series})\nCores: ${d.cudaCores.toLocaleString()}`;
                        } else {
                            // For normalized mode, get the flagship model name to show which card it's compared to
                            const seriesData = gpuData.filter(gpu => gpu.series === d.series);
                            let flagshipModel = "";

                            // Special case for 1600 series which uses 2000 series as reference
                            if (d.series === "1600" && flagship2000) { // Use the found 2000 flagship
                                flagshipModel = flagship2000.model;
                            } else {
                                // Normal case - get the appropriate flagship based on toggle state
                                const regularFlagship = seriesData.find(gpu => gpu.flagship);
                                const specialFlagshipThisSeries = seriesData.find(gpu => gpu.specialFlagship);
                                const useSpecialThisSeries = specialFlagshipActive[d.series] && specialFlagshipThisSeries;
                                flagshipModel = useSpecialThisSeries ? specialFlagshipThisSeries.model : (regularFlagship ? regularFlagship.model : "Unknown flagship");
                            }
                             // Ensure normalizedCores is not null before formatting
                             const normalizedText = d.normalizedCores != null ? `${d.normalizedCores.toFixed(1)}%` : 'N/A';

                            return `${d.model} (${d.series})\nCores: ${d.cudaCores.toLocaleString()}\nVs ${flagshipModel}: ${normalizedText}`;
                        }
                    });

            // Also add this data to our column-organized collection for the hover overlay
             // Use the full processedData before point filtering for column hover
            processedData.forEach(d => {
                if (d.tier && processedDataByColumn[d.tier]) {
                     // Add to processedDataByColumn only if it's included by the main series filter
                     // and has valid core data for positioning/tooltip.
                    if (d.cudaCores != null && (toggleMode ? d.normalizedCores !== null : d.cudaCores > 0)) {
                        processedDataByColumn[d.tier].push(d);
                    }
                }
            });
        });

        // --- Add special connection between 1600 series and 2000 series ---
        // This section draws the *dashed line* and label, distinct from the main series line.
        // Find the GTX 1660 Ti from the 1600 series (or a similar key point)
        const gtx1660Ti = gpuData.find(d => d.model === "GTX 1660 Ti" && d.series === "1600");
        
        // Get the flagship from 2000 series that's currently active (Ti or non-Ti)
        const reference2000Model = useSpecial2000 ? specialFlagship2000 : regularFlagship2000;

        // Draw connection line only if:
        // 1. We are in toggle mode (normalized)
        // 2. 1600 series data is available (at least 1660 Ti)
        // 3. 2000 series flagship is available
        // 4. Both 1600 and 2000 generations are currently active in the legend filter
        if (toggleMode && gtx1660Ti && reference2000Model &&
            activeGenerations["1600"] !== false &&
            activeGenerations["2000"] !== false) {

            // Always use the currently selected 2000 series flagship for calculations
            const referenceForCalculation = reference2000Model;

            if (referenceForCalculation && referenceForCalculation.cudaCores > 0 && gtx1660Ti.cudaCores != null && gtx1660Ti.cudaCores > 0) {
                const gtx1660TiNormalizedCores = (gtx1660Ti.cudaCores / referenceForCalculation.cudaCores) * 100;
                const tier1660Ti = getTierFromModel(gtx1660Ti.model);
                const tierReference = getTierFromModel(referenceForCalculation.model);

                if (tier1660Ti && tierReference) {
                    // Position the 1660 Ti at its correct column (60 Ti)
                    const x1660Ti = xScale(tier1660Ti);
                    const y1660Ti = yScale(gtx1660TiNormalizedCores);

                    // Position the reference 2000 series flagship in the flagship column (90 Ti)
                    const xReference = xScale("90 Ti");
                    const yReference = yScale(100);

                    if (x1660Ti !== undefined && y1660Ti !== undefined && xReference !== undefined && yReference !== undefined) {
                        // Draw a dashed connection line between the two points
                        chartGroup.append('path')
                            .attr('stroke', colorScale("1600"))  // Using the 1600 series color
                            .attr('stroke-width', 1.5)
                            .attr('stroke-dasharray', '5,5')  // Dashed line
                            .attr('fill', 'none')
                            .attr('d', d3.line()([
                                [x1660Ti, y1660Ti],
                                [xReference, yReference] // Connect to the reference point's normalized position (100%)
                            ]));

                        // Add a small label to explain the connection
                        const midX = (x1660Ti + xReference) / 2;
                        const midY = (y1660Ti + yReference) / 2;

                        chartGroup.append('text')
                            .attr('x', midX)
                            .attr('y', midY - 10)
                            .attr('text-anchor', 'middle')
                            .attr('font-size', '10px')
                            .attr('fill', 'rgba(200, 200, 200, 0.9)');  // Brighter text for better visibility
                    }
                }
            }
        }


        // --- Enhanced Legend with Flagship Info and Special Flagship Toggle ---
        const legend = chartGroup.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width + 20}, 0)`); // Position legend to the right

        // Add "GPU Generation" title to legend - centered
        legend.append("text")
            .attr("x", 60) // Centered position (relative to legend group)
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
            .attr("transform", (d, i) => `translate(0, ${i * 35})`); // Increased spacing

        // Color rectangle with toggle functionality (Calls setActiveGenerations)
        legendItems.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", d => activeGenerations[d.series] ? colorScale(d.series) : "#555") // Dim when inactive
            .attr("stroke", "#ddd") // Add white border
            .attr("stroke-width", 1)
            .attr("rx", 3) // Rounded corners
            .attr("ry", 3) // Rounded corners
            .attr("cursor", "pointer")
            .attr("opacity", d => activeGenerations[d.series] ? 1 : 0.5) // Dim inactive generations
            .on("click", function(event, d) {
                // Toggle this generation's visibility
                 if (setActiveGenerations && setShowAllCudaGenerations) {
                     setActiveGenerations(prev => {
                         const newState = {
                             ...prev,
                             [d.series]: !prev[d.series]
                         };

                         // Logic to update showAllCudaGenerations based on newState
                         const allAreSelected = generations.every(gen => newState[gen] === true);
                         setShowAllCudaGenerations(allAreSelected);

                         return newState;
                     });
                 }
            });

        // Series name with toggle functionality (Calls setActiveGenerations)
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
                 if (setActiveGenerations && setShowAllCudaGenerations) {
                     setActiveGenerations(prev => {
                         const newState = {
                             ...prev,
                             [d.series]: !prev[d.series]
                         };
                          // Logic to update showAllCudaGenerations based on newState
                         const allAreSelected = generations.every(gen => newState[gen] === true);
                         setShowAllCudaGenerations(allAreSelected);
                         return newState;
                     });
                 }
            });

        // Flagship model name text
        legendItems.append("text")
            .attr("x", 20)
            .attr("y", 27) // Position below the series name
            .text(d => {
                 // Special case for 1600 series - text refers to the 2000 series reference in toggle mode
                 if (toggleMode && d.series === "1600") {
                     const series2000Data = gpuData.filter(gpu => gpu.series === "2000");
                     const flagship2000Used = specialFlagshipActive["2000"] && series2000Data.find(gpu => gpu.specialFlagship)
                         ? series2000Data.find(gpu => gpu.specialFlagship)
                         : series2000Data.find(gpu => gpu.flagship);

                     return flagship2000Used ? `Reference: ${flagship2000Used.model}` : "No reference";
                 }

                // Normal case for other series
                const flagshipToShow = specialFlagshipActive[d.series] && d.specialFlagship ? d.specialFlagship : d.regularFlagship;
                return flagshipToShow ? `Flagship: ${flagshipToShow.model}` : "No flagship";
            })
            .style("font-size", "10px")
            .attr("alignment-baseline", "middle")
            .attr("fill", d => activeGenerations[d.series] ? "#aaa" : "#666") // Dim text when inactive
            .attr("class", "flagship-text");

        // Add toggle buttons for series with special flagships (Calls setSpecialFlagshipActive)
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
                 if (setSpecialFlagshipActive) {
                    // Toggle the special flagship state for this series
                    setSpecialFlagshipActive(prev => ({
                        ...prev,
                        [d.series]: !prev[d.series]
                    }));
                 }
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
            .attr("pointer-events", "none")
            .attr("class", "toggle-text");

        // Add "Show All Generations" checkbox at the bottom (Calls setActiveGenerations, setShowAllCudaGenerations)
        const showAllCudaGroup = legend.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${generationInfo.length * 35 + 10})`);

        showAllCudaGroup.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("stroke", "#ddd")
            .attr("fill", showAllCudaGenerations ? "#646cff" : "transparent")
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("cursor", "pointer")
            .on("click", function() {
                 if (setActiveGenerations && setShowAllCudaGenerations) {
                    // Determine target state: if currently showing all, next state is all false. Otherwise, all true.
                    const targetState = !showAllCudaGenerations; // Toggle the "Show All" state itself

                    const newState = {};
                    generations.forEach(gen => {
                        newState[gen] = targetState;
                    });
                    setActiveGenerations(newState);
                    setShowAllCudaGenerations(targetState); // Update the "Show All" checkbox state
                 }
            });

        showAllCudaGroup.append("text")
            .attr("x", 25)
            .attr("y", 12)
            .attr("fill", "#ddd")
            .style("font-size", "12px")
            .text("Show All Generations")
            .attr("alignment-baseline", "middle");

        // Create column overlays for hover effect (D3 handles display/hide/content)
        columnOrder.forEach(column => {
            const columnX = xScale(column);
             if (columnX === undefined) return; // Skip if column not found in scale

            const columnWidth = width / (columnOrder.length); // Approximate width for each column (Adjusted calculation slightly)

            // Add transparent overlay rectangle for each column
            chartGroup.append('rect')
                .attr('class', 'column-overlay')
                // *** FIX: Adjust x position slightly to center over the point/column area ***
                .attr('x', xScale(column) - (xScale.step() / 2) + xScale.padding() * xScale.step() / 2) // Center between tick marks
                .attr('y', 0)
                // *** FIX: Adjust width to match the step between tick marks ***
                .attr('width', xScale.step()) // Width matches the distance between points
                .attr('height', height)
                 .style('pointer-events', 'all') // Ensure it captures events
                 .style('fill', 'none') // Make it transparent
                 // *** Removed `handleColumnHover` and `handleColumnLeave` calls here ***
                 // D3 will manage the tooltip state and DOM element directly as per original code structure
                .on('mousemove', function(event) {
                     // Manual tooltip positioning by D3 (as per original logic)
                     d3.select('.tooltip-container')
                         .style('visibility', 'visible')
                         .style('left', `${event.pageX + 15}px`)
                         .style('top', `${event.pageY - 10}px`);

                     // Generate tooltip content dynamically here based on the column data
                     let tooltipTitle = "";
                     let tooltipGpus = [];

                     if (column === "90 Ti" && toggleMode) {
                         tooltipTitle = `<div class="tooltip-title">Aligned Flagships</div>`;

                         // Collect the aligned flagships for the tooltip content rendering inside D3
                         tooltipGpus = generations.map(series => {
                            // Only include active generations in the tooltip list
                            if (activeGenerations[series] === false) return null;

                            const seriesData = gpuData.filter(d => d.series === series);
                            const useSpecial = specialFlagshipActive[series];
                            let flagship;

                            if (useSpecial) {
                                flagship = seriesData.find(d => d.specialFlagship);
                            }
                             // If no special or special not active, use regular flagship
                            if (!flagship) {
                                flagship = seriesData.find(d => d.flagship);
                            }

                             // Find the 2000 series flagship for 1600 series reference calculation
                             const series2000Data = gpuData.filter(gpu => gpu.series === "2000");
                             const refFlagship2000 = specialFlagshipActive["2000"] && series2000Data.find(g => g.specialFlagship)
                                ? series2000Data.find(g => g.specialFlagship)
                                : series2000Data.find(g => g.flagship);


                            if (flagship && flagship.cudaCores != null && flagship.cudaCores > 0) {
                                // Use flagship2000 as reference for 1600 series normalization calculation
                                 const refFlagship = (series === "1600" && refFlagship2000 && refFlagship2000.cudaCores > 0) ? refFlagship2000 : flagship;
                                 if (refFlagship.cudaCores != null && refFlagship.cudaCores > 0) {
                                    return {
                                        ...flagship,
                                        normalizedCores: (flagship.cudaCores / refFlagship.cudaCores) * 100,
                                        series // Include series for color indicator
                                    };
                                 }
                            }
                            return null;
                         }).filter(Boolean) // Remove nulls (series without a valid flagship or inactive)
                         .sort((a, b) => { // Sort by series year
                            const seriesA = parseInt(a.series, 10) || 0;
                            const seriesB = parseInt(b.series, 10) || 0;
                            return seriesA - seriesB;
                         });

                     } else {
                         // Regular column behavior
                         tooltipTitle = `<div class="tooltip-title">xx${column} Class</div>`;
                         // Get GPUs in this column that are currently active, sorted by release year/series
                         tooltipGpus = processedDataByColumn[column]?.filter(d => activeGenerations[d.series] !== false).sort((a, b) => {
                            const seriesA = parseInt(a.series, 10) || 0;
                            const seriesB = parseInt(b.series, 10) || 0;
                            return seriesA - seriesB;
                         }) || [];
                     }

                     // Start building the tooltip content with the title
                     let tooltipContent = tooltipTitle;

                     if (tooltipGpus && tooltipGpus.length > 0) {
                         tooltipGpus.forEach(gpu => {
                             // Get flagship information for comparison label in toggle mode
                             let flagshipInfo = '';
                             if (toggleMode) {
                                 const seriesData = gpuData.filter(g => g.series === gpu.series);
                                 let flagshipModel = "";

                                 // Special case for 1600 series which uses 2000 series as reference
                                 const series2000Data = gpuData.filter(g => g.series === "2000");
                                 const refFlagship2000 = specialFlagshipActive["2000"] && series2000Data.find(g => g.specialFlagship)
                                     ? series2000Data.find(g => g.specialFlagship)
                                     : series2000Data.find(g => g.flagship);

                                 if (gpu.series === "1600" && refFlagship2000) { // Use the found 2000 flagship model
                                     flagshipModel = refFlagship2000.model;
                                 } else {
                                     // Normal case - get appropriate flagship based on toggle state for the GPU's series
                                     const regularFlagship = seriesData.find(g => g.flagship);
                                     const specialFlagshipThisSeries = seriesData.find(g => g.specialFlagship);
                                     const useSpecialThisSeries = specialFlagshipActive[gpu.series] && specialFlagshipThisSeries;
                                     flagshipModel = useSpecialThisSeries ? specialFlagshipThisSeries.model : (regularFlagship ? regularFlagship.model : "Unknown flagship");
                                 }

                                  const normalizedText = gpu.normalizedCores != null ? `${gpu.normalizedCores.toFixed(1)}%` : 'N/A';
                                 flagshipInfo = `Vs ${flagshipModel}: ${normalizedText}`;
                             }

                             tooltipContent += `
                                 <div class="gpu-item">
                                     <span class="model-name">
                                         <span class="color-indicator" style="background-color: ${colorScale(gpu.series)};"></span>
                                         ${gpu.model}
                                     </span>
                                     <div class="cores-info">
                                         Cores: ${gpu.cudaCores ? gpu.cudaCores.toLocaleString() : 'N/A'}<br>
                                         ${toggleMode ? flagshipInfo : ''}
                                     </div>
                                 </div>
                             `;
                         });
                     } else {
                         tooltipContent += '<div>No active GPUs in this class</div>';
                     }

                     d3.select('.tooltip-container').html(tooltipContent);

                 })
                 .on('mouseout', function() {
                     // Manual tooltip hiding by D3 (as per original logic)
                     d3.select('.tooltip-container').style('visibility', 'hidden');
                 });
        });

         // Cleanup function to remove tooltips created by D3 when component unmounts or redraws
         return () => {
             d3.select('.tooltip-container').remove();
         };

    }, [
        svgRef,
        gpuData,
        columnOrder,
        getTierFromModel,
        toggleMode,
        useLogScale,
        specialFlagshipActive, // Dependency for flagship logic and legend toggle state/text
        setSpecialFlagshipActive, // Dependency for legend toggle click handler
        activeGenerations, // Dependency for filtering and legend opacity/text color
        setActiveGenerations, // Dependency for legend click handler
        showAllCudaGenerations, // Dependency for legend checkbox state
        setShowAllCudaGenerations // Dependency for legend checkbox click handler
        // Tooltip state/handlers passed from App are not used directly in the D3 effect for rendering/positioning
        // so they are not needed as useEffect dependencies here.
    ]); // Re-run effect when these props change

    return (
        // The SVG element where D3 will draw the chart
        <svg ref={svgRef} style={{ display: 'block', margin: '20px auto' }}></svg>
    );
}

export default CudaPlot;