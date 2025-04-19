// DieAreaPlot.jsx
import React, { useEffect } from 'react';
import * as d3 from 'd3';
// Import specific statistical functions from d3-array
import { deviation, mean, median, quantile, min, max, range } from 'd3-array'; // Import deviation, mean, etc.
// App.css is imported in App.jsx and applies globally

function DieAreaPlot({
    dieAreaSvgRef,
    gpuData,
    gpuDieData,
    columnOrder, // Not directly used in this component's logic but kept as prop
    getTierFromModel, // Not directly used in this component's logic but kept as prop
    activeGenerations,
    setActiveGenerations,
    showAllDieGenerations,
    setShowAllDieGenerations
}) {

    useEffect(() => {
        // Ensure data and ref are available before attempting to draw
        if (!gpuData || !gpuDieData || !dieAreaSvgRef.current) {
            console.warn("DieAreaPlot: Missing required props or ref.");
            return;
        }

        const svg = d3.select(dieAreaSvgRef.current);
        svg.selectAll("*").remove(); // Clear previous renders

        // --- Chart Dimensions and Margins ---
        const margin = { top: 60, right: 250, bottom: 50, left: 90 };
        const containerWidth = 1000; // Use a fixed container width
        const containerHeight = 450; // Use a fixed container height
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        svg.attr('width', containerWidth)
           .attr('height', containerHeight);

        // Add a rounded border for the chart area with transparent fill and subtle glow
        // Use the full SVG dimensions for the background rect
         svg.append("rect")
            .attr("x", 0) // Start from the SVG edge
            .attr("y", 0) // Start from the SVG edge
            .attr("width", containerWidth)
            .attr("height", containerHeight)
            .attr("rx", 15) // Rounded corners for the whole SVG area
            .attr("ry", 15)
            .attr("fill", "transparent")
            .attr("class", "chart-background")
            .attr("filter", "url(#glow)"); // Apply glow filter

        // Add subtle glow filter for enhanced aesthetics
        const defs = svg.append("defs");
        const filter = defs.append("filter")
            .attr("id", "glow")
            .attr("x", "-20%")
            .attr("y", "-20%")
            .attr("width", "140%")
            .attr("height", "140%");

        filter.append("feGaussianBlur")
            .attr("stdDeviation", "3")
            .attr("result", "blur");

        filter.append("feComposite")
            .attr("in", "SourceGraphic")
            .attr("in2", "blur")
            .attr("operator", "over");

        const chartGroup = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Add tooltip container to the DOM if it doesn't exist with enhanced styling
        const tooltipContainerClass = 'die-area-tooltip-container';
        if (!d3.select('body').select(`.${tooltipContainerClass}`).size()) {
            d3.select('body')
                .append('div')
                .attr('class', tooltipContainerClass)
                .style('position', 'absolute')
                .style('visibility', 'hidden')
                .style('background-color', 'rgba(25, 25, 30, 0.92)')
                .style('color', '#fff')
                .style('border-radius', '10px')
                .style('padding', '12px')
                .style('pointer-events', 'none')
                .style('box-shadow', '0 4px 15px rgba(0, 0, 0, 0.5)')
                .style('border', '1px solid rgba(100, 108, 255, 0.4)')
                .style('z-index', '10')
                .style('max-width', '250px')
                .style('font-size', '12px')
                .style('transition', 'opacity 0.2s ease-in-out')
                .style('backdrop-filter', 'blur(5px)');
        } else {
            // Ensure it's hidden on redraw
            d3.select(`.${tooltipContainerClass}`).style('visibility', 'hidden');
        }


        // Process the data to calculate price per die area
        // Filter out GPUs where we don't have die size data or price data
        const processedData = gpuData
            .filter(gpu => {
                // Check if the generation is active based on the series name
                if (activeGenerations && activeGenerations[gpu.series] === false) {
                    return false;
                }

                // Check if we have the die information and required data points
                const dieInfo = gpuDieData[gpu.dieName];
                return gpu.msrp && dieInfo && dieInfo.dieSizeMM2 && gpu.releaseYear; // Ensure releaseYear exists for sorting
            })
            .map(gpu => {
                const dieInfo = gpuDieData[gpu.dieName];
                return {
                    ...gpu,
                    dieSizeMM2: dieInfo.dieSizeMM2,
                    // Assume generation is consistently available in dieInfo or GPU data
                    generation: dieInfo.generation || "Unknown", // Fallback for generation
                    pricePerMM2: gpu.msrp / dieInfo.dieSizeMM2
                };
            });

        // Get unique series from processed data, sorted by release year
        const seriesInfo = Array.from(
            new Set(processedData.map(d => d.series))
        ).map(series => {
            // Find earliest card of this series to get its first release year
            const seriesCards = processedData.filter(d => d.series === series);
            const earliestYear = seriesCards.length > 0 ? 
                Math.min(...seriesCards.map(card => card.releaseYear)) : 0;
            return {
                series,
                releaseYear: earliestYear // Use the earliest release year in the series
            };
        }).sort((a, b) => a.releaseYear - b.releaseYear);

        // Combine 1600 and 2000 series into a single x-axis tick
        // but keep them separate in the data for coloring
        const combinedSeriesInfo = seriesInfo.filter(info => info.series !== "1600" && info.series !== "2000");

        // Add the combined 1600/2000 entry where 2000 would be
        const has1600 = seriesInfo.some(info => info.series === "1600");
        const has2000 = seriesInfo.some(info => info.series === "2000");

        if (has1600 || has2000) {
            // Find the correct position based on the earlier series sorting
            const series1600 = seriesInfo.find(info => info.series === "1600");
            const series2000 = seriesInfo.find(info => info.series === "2000");
            const releaseYear = series2000 ? series2000.releaseYear : (series1600 ? series1600.releaseYear : 2018); // Use actual year if available, fallback to 2018

             // Determine the insertion index based on sorted combinedSeriesInfo
            // Find where the 2000 series (or 1600 if 2000 is missing) would fit chronologically
             let insertIndex = combinedSeriesInfo.length; // Default to end
             if (series2000) {
                 insertIndex = combinedSeriesInfo.findIndex(info => info.releaseYear > series2000.releaseYear);
                 if (insertIndex === -1) insertIndex = combinedSeriesInfo.length; // Insert at end if no later series
             } else if (series1600) {
                  insertIndex = combinedSeriesInfo.findIndex(info => info.releaseYear > series1600.releaseYear);
                 if (insertIndex === -1) insertIndex = combinedSeriesInfo.length; // Insert at end
             }


            // Create a combined entry and insert it
            combinedSeriesInfo.splice(insertIndex, 0, {
                series: "1600/2000",
                releaseYear: releaseYear,
                isCombo: true,
                series1: "1600",
                series2: "2000"
            });
        }

        // The list is already sorted by release year due to how we built combinedSeriesInfo

        // Extract just the series names in the correct order for x-axis domain
        const xScaleDomain = combinedSeriesInfo.map(info => info.series);
        if (xScaleDomain.length === 0 && processedData.length > 0) {
             // Fallback domain if combining somehow resulted in empty array, but data exists
             console.warn("xScaleDomain is empty after combining. Using all unique series from processed data.");
             const fallbackSeries = Array.from(new Set(processedData.map(d => d.series)))
                 .map(series => {
                     const firstCard = processedData.find(d => d.series === series);
                     return { series, releaseYear: firstCard ? firstCard.releaseYear : 0 };
                 })
                 .sort((a, b) => a.releaseYear - b.releaseYear)
                 .map(info => info.series);
             xScaleDomain.push(...fallbackSeries);
        }
        if (xScaleDomain.length === 0) xScaleDomain.push("No Data"); // Ensure domain is never empty


        // Create a mapping of series (including combined) to their release years for the labels
        const seriesToYear = {};
        combinedSeriesInfo.forEach(info => {
            seriesToYear[info.series] = info.releaseYear;
        });

        // Create a mapping from original series to their display position key (used for scatter points)
        const seriesPositionMapping = {};
        processedData.forEach(d => {
            if (d.series === "1600" || d.series === "2000") {
                seriesPositionMapping[d.series] = "1600/2000";
            } else {
                seriesPositionMapping[d.series] = d.series;
            }
        });


        // X scale for GPU generations (series)
        const xScale = d3.scalePoint()
            .domain(xScaleDomain)
            .range([0, width])
            .padding(0.5);

        // Find maximum price per mm²
        const maxPricePerMM2 = max(processedData, d => d.pricePerMM2) || 5;
        // Round up to a nice value, ensuring it's at least 5
        const yMax = Math.max(4, Math.ceil(maxPricePerMM2 * 1.1)); // Give some padding

        // Y scale for price per mm²
        const yScale = d3.scaleLinear()
            .domain([0, yMax])
            .range([height, 0]);

        // --- Axes ---
        // X-Axis (GPU Generations)
        const xAxis = d3.axisBottom(xScale)
            .tickFormat(d => ""); // Empty string as we'll add custom labels

        const xAxisGroup = chartGroup.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis);

        // Add two-line labels with series and year
        xAxisGroup.selectAll(".tick")
            .append("text")
            .attr("y", 15)
            .attr("x", 0)
            .attr("text-anchor", "middle")
            .attr("fill", "#ddd")
            .style("font-size", "12px")
            .text(d => d); // First line: GPU series name (e.g., "500" or "1600/2000")

        xAxisGroup.selectAll(".tick")
            .append("text")
            .attr("y", 30)
            .attr("x", 0)
            .attr("text-anchor", "middle")
            .attr("fill", "#aaa")
            .style("font-size", "10px")
            .text(d => seriesToYear[d]); // Second line: release year

        // Add X axis label
        chartGroup.append("text")
            .attr("class", "x-axis-label")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + 50) // Adjusted for two-line labels
            .attr("fill", "#ddd")
            .style("font-size", "12px")
            .text("GPU Generation");

        // Y-Axis (Price per mm²)
        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => `$${d}`);

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
            .text("Price per Die Area ($/mm²)");

        // Y-Axis Gridlines
        const yGridlines = d3.axisLeft(yScale)
            .tickSize(-width)
            .tickFormat("");

        chartGroup.append("g")
            .attr("class", "grid")
            .call(yGridlines)
            .selectAll("line")
                .attr("stroke", "#e0e0e0")
                .attr("stroke-opacity", 0.15); // Make gridlines subtle
        chartGroup.select(".grid .domain").remove(); // Remove the vertical line of the grid

        // Display "No data" message if no GPU data is available but keep the chart structure
        if (processedData.length === 0) {
            chartGroup.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .attr("fill", "#ddd")
                .style("font-size", "14px")
                .text("No data to display based on current filters.");
        }

        // Get ALL series from the original data regardless of filtering for legend display
        const allGenerationsWithInfo = Array.from(new Set(
            gpuData
                .filter(gpu => {
                    // Only include GPUs with die data and MSRP for potential plotting
                    const dieInfo = gpuDieData[gpu.dieName];
                    return gpu.msrp && dieInfo && dieInfo.dieSizeMM2 && gpu.releaseYear;
                })
                .map(gpu => gpu.series)
        ))
        .map(series => {
            // Find the first card of this series to get its release year and generation
            const firstCard = gpuData.find(d => d.series === series && gpuDieData[d.dieName]);
            const dieInfo = firstCard ? gpuDieData[firstCard.dieName] : null;
            return {
                series,
                releaseYear: firstCard ? firstCard.releaseYear : 0,
                generation: dieInfo ? dieInfo.generation : "Unknown"
            };
        })
        .sort((a, b) => a.releaseYear - b.releaseYear); // Sort all potential generations by year

        // Extract just the series names in the correct order for ALL generations
        const allGenerations = allGenerationsWithInfo.map(g => g.series);

        // Use consistent color scale across all potential generations from the original data
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(allGenerations);


        // Add legend for die area plot - moved outside of processedData.length check to ensure it's always visible
        const dieAreaLegend = chartGroup.append("g")
            .attr("class", "die-area-legend")
            .attr("transform", `translate(${width + 20}, 0)`);

        // Add "GPU Generation" title to legend
        dieAreaLegend.append("text")
            .attr("x", 60)
            .attr("y", -20)
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", "#ddd")
            .attr("text-anchor", "middle")
            .text("GPU Generation");

        // Use allGenerationsWithInfo for the legend data, sorted by release year initially
        const legendData = allGenerationsWithInfo.slice();
        
        // Ensure 1600 comes directly above 2000 in the legend
        legendData.sort((a, b) => {
            // Special case for 1600 and 2000 series
            if (a.series === "1600" && b.series === "2000") {
                return -1; // 1600 comes before 2000
            }
            if (a.series === "2000" && b.series === "1600") {
                return 1; // 2000 comes after 1600
            }
            // Default sort by release year for other items
            return a.releaseYear - b.releaseYear;
        });

        // Create legend items
        const legendItems = dieAreaLegend.selectAll(".legend-item")
            .data(legendData)
            .enter().append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 25})`);

        // Color rectangle with toggle functionality
        legendItems.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            // Check activeGenerations state for this specific series name
            .attr("fill", d => activeGenerations[d.series] !== false ? colorScale(d.series) : "#555")
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1)
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("cursor", "pointer")
            // Use opacity to indicate active/inactive state
            .attr("opacity", d => activeGenerations[d.series] !== false ? 1 : 0.5)
            .on("click", function(event, d) {
                if (setActiveGenerations && setShowAllDieGenerations) {
                    // Use the original series name for updating the state
                    setActiveGenerations(prev => {
                        const newState = {
                            ...prev,
                            [d.series]: prev[d.series] === false ? true : false
                        };

                        // Logic to update showAllDieGenerations based on ALL generations
                        const allAreSelected = allGenerations.every(gen => newState[gen] !== false);
                        setShowAllDieGenerations(allAreSelected);

                        return newState;
                    });
                }
            });

        // Series name with toggle functionality
        legendItems.append("text")
            .attr("x", 20)
            .attr("y", 12)
            // Display original series name and generation
            .text(d => `${d.series} (${d.generation})`)
            .style("font-size", "12px")
            .style("font-weight", "bold")
            // Use color to indicate active/inactive state
            .attr("fill", d => activeGenerations[d.series] !== false ? "#ddd" : "#777")
            .attr("cursor", "pointer")
            .on("click", function(event, d) {
                if (setActiveGenerations && setShowAllDieGenerations) {
                    // Use the original series name for updating the state
                    setActiveGenerations(prev => {
                        const newState = {
                            ...prev,
                            [d.series]: prev[d.series] === false ? true : false
                        };

                        // Logic to update showAllDieGenerations based on ALL generations
                        const allAreSelected = allGenerations.every(gen => newState[gen] !== false);
                        setShowAllDieGenerations(allAreSelected);

                        return newState;
                    });
                }
            });

        // Add "Show All Generations" checkbox
        const showAllGroup = dieAreaLegend.append("g")
            .attr("class", "legend-item show-all")
            .attr("transform", `translate(0, ${legendData.length * 25 + 10})`); // Position below legend items

        showAllGroup.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("stroke", "#ddd")
            .attr("fill", showAllDieGenerations ? "#646cff" : "transparent")
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("cursor", "pointer")
            .on("click", function() {
                if (setActiveGenerations && setShowAllDieGenerations) {
                    const targetState = !showAllDieGenerations;

                    const newState = {};
                    // Iterate over *all* possible generations from the original data
                    allGenerations.forEach(gen => {
                        newState[gen] = targetState; // Set all to the target state
                    });
                    setActiveGenerations(newState);
                    setShowAllDieGenerations(targetState);
                }
            });

        showAllGroup.append("text")
            .attr("x", 25)
            .attr("y", 12)
            .attr("fill", "#ddd")
            .style("font-size", "12px")
            .text("Show All Generations")
            .attr("alignment-baseline", "middle")
            .attr("cursor", "pointer") // Make text clickable too
            .on("click", function() { // Duplicate click handler for text
                if (setActiveGenerations && setShowAllDieGenerations) {
                    const targetState = !showAllDieGenerations;

                    const newState = {};
                    // Iterate over *all* possible generations from the original data
                    allGenerations.forEach(gen => {
                        newState[gen] = targetState; // Set all to the target state
                    });
                    setActiveGenerations(newState);
                    setShowAllDieGenerations(targetState);
                }
            });


        // Add note about the data below the show all option
        dieAreaLegend.append("text")
            .attr("x", 0)
            .attr("y", legendData.length * 25 + 50) // Position below show all
            .attr("fill", "#aaa")
            .style("font-size", "11px")
            .text("* Colors represent GPU generations");

        dieAreaLegend.append("text")
            .attr("x", 0)
            .attr("y", legendData.length * 25 + 75) // Position below show all
            .attr("fill", "#aaa")
            .style("font-size", "11px")
            .text("* Point sizes are proportional");

        dieAreaLegend.append("text")
            .attr("x", 0)
            .attr("y", legendData.length * 25 + 90) // Position below show all
            .attr("fill", "#aaa")
            .style("font-size", "11px")
            .attr("dx", 8.5)
            .text("to die area (mm²)");

        // For data display, only use processed (filtered) data
        if (processedData.length > 0) {

            // Group processed data by the series *key* that will be used on the X axis
            const dataByDisplaySeries = {};
            xScaleDomain.forEach(displaySeries => {
                // For combined series, make sure we're only including active series
                if (displaySeries === "1600/2000") {
                    // Check which series are active (not filtered out)
                    const has1600 = activeGenerations["1600"] !== false;
                    const has2000 = activeGenerations["2000"] !== false;
                    
                    if (has1600 && has2000) {
                        // Both are active, include both
                        dataByDisplaySeries[displaySeries] = processedData.filter(d => d.series === "1600" || d.series === "2000");
                    } else if (has1600) {
                        // Only 1600 is active
                        dataByDisplaySeries[displaySeries] = processedData.filter(d => d.series === "1600");
                    } else if (has2000) {
                        // Only 2000 is active
                        dataByDisplaySeries[displaySeries] = processedData.filter(d => d.series === "2000");
                    } else {
                        // Neither are active (this shouldn't happen due to earlier filtering)
                        dataByDisplaySeries[displaySeries] = [];
                    }
                } else if (displaySeries !== "No Data") { // Handle the default case
                    dataByDisplaySeries[displaySeries] = processedData.filter(d => d.series === displaySeries);
                }
            });

            // Create a series to x-coordinate mapping
            const seriesToX = Object.fromEntries(xScaleDomain.map(series => [series, xScale(series)]));


            // Draw violin plots per display series key
            Object.entries(dataByDisplaySeries).forEach(([displaySeriesKey, gpusInGroup]) => {
                const seriesX = seriesToX[displaySeriesKey];

                // Filter for valid prices for KDE and stats
                const validPrices = gpusInGroup
                    .map(d => d.pricePerMM2)
                    .filter(price => price != null && isFinite(price) && price >= 0 && price <= yMax); // Ensure price is finite and within y scale bounds

                // Only continue if we have sufficient valid data points for a distribution
                if (validPrices.length >= 2) { // Need at least 2 points to potentially have a spread

                    // Use the imported deviation function
                    const stdDev = deviation(validPrices);

                    // Calculate dynamic bandwidth:
                    // Use a multiple of the standard deviation.
                    // Add a small minimum bandwidth to avoid issues if stdDev is zero but points exist.
                    // The multiplier (e.g., 1.5) and minimum (e.g., 0.1) may need tuning.
                    // Ensure bandwidth is positive and finite.
                    const bandwidth = Math.max(0.1, (stdDev || 0) * 1.5);

                    if (!isFinite(bandwidth) || bandwidth <= 0) {
                        console.warn(`Calculated bandwidth is invalid (${bandwidth}) for ${displaySeriesKey}. Skipping violin.`);
                        return; // Skip drawing violin if bandwidth is bad
                    }

                    // Calculate fixed violin width since xScale is a point scale (not a band scale)
                    const dynamicViolinWidth = 40; // Fixed width value for violins

                    // Calculate the kernel density estimation
                    const numPoints = 100; // Increased points for smoother curves
                    // Generate yValues across the relevant range of the data, plus padding
                    const priceMin = min(validPrices); // Use imported min
                    const priceMax = max(validPrices); // Use imported max
                    const yRangeStart = Math.max(0, (priceMin || 0) - bandwidth * 2); // Extend below min
                    const yRangeEnd = Math.min(yMax, (priceMax || yMax) + bandwidth * 2); // Extend above max
                    const yValues = range(yRangeStart, yRangeEnd, (yRangeEnd - yRangeStart) / numPoints); // Use imported range

                    // Ensure yValues has points if range is zero or small
                    if (yValues.length < 2) {
                        // Fallback to a standard range around the mean if possible
                        const meanPrice = mean(validPrices) || (yMax / 2); // Use imported mean
                        yValues.push(Math.max(0, meanPrice - 1));
                        yValues.push(meanPrice);
                        yValues.push(Math.min(yMax, meanPrice + 1));
                        // Sort in case fallbacks are not ordered
                         yValues.sort(d3.ascending);
                        // Filter unique values
                         const uniqueYValues = Array.from(new Set(yValues));
                         if (uniqueYValues.length < 2) {
                             console.warn(`Could not generate sufficient yValues for KDE for ${displaySeriesKey}. Skipping violin.`);
                             return;
                         }
                         yValues.splice(0, yValues.length, ...uniqueYValues); // Replace yValues with unique sorted ones

                    }


                    const kde = kernelDensityEstimator(kernelEpanechnikov(bandwidth), yValues); // Use dynamic bandwidth

                    const density = kde(validPrices);

                    // Filter density points to ensure valid data and positive values
                    // Calculate a density threshold as a percentage of the maximum density
                    const rawMaxDensity = max(density, d => d[1] != null && isFinite(d[1]) ? d[1] : 0) || 0.001;
                    const densityThreshold = rawMaxDensity * 0.1; // Filter out points with less than 1% of max density
                    
                    const validDensityPoints = density.filter(d => 
                        d[0] != null && 
                        isFinite(d[0]) && 
                        d[1] != null && 
                        isFinite(d[1]) && 
                        d[1] >= densityThreshold // Apply threshold to remove tiny density values
                    );

                    if (validDensityPoints.length < 2) {
                         console.warn(`Not enough valid density points (${validDensityPoints.length}) after KDE for ${displaySeriesKey}. Skipping violin.`);
                         return; // Not enough points to draw a shape
                    }

                    const maxDensity = max(validDensityPoints, d => d[1]) || 0.001; // Add a small minimum for scaling, use imported max
                     if (maxDensity <= 0) {
                         console.warn(`Max density is zero or negative (${maxDensity}) for ${displaySeriesKey}. Skipping violin.`);
                         return; // Cannot scale if max density is not positive
                     }

                    const densityScale = d3.scaleLinear()
                        .domain([0, maxDensity])
                        .range([0, dynamicViolinWidth / 2]); // Map max density to half the violin width

                    // Build the violin path
                    const violinPath = [];
                    // Add points from top-left down to bottom-left
                    validDensityPoints.forEach(d => {
                         const y = yScale(d[0]); // Scale the price value
                         const xOffset = densityScale(d[1]); // Scale the density value
                         violinPath.push([seriesX - xOffset, y]);
                    });

                    // Add points from bottom-right up to top-right (in reverse order of density points)
                    [...validDensityPoints].reverse().forEach(d => {
                         const y = yScale(d[0]);
                         const xOffset = densityScale(d[1]);
                         violinPath.push([seriesX + xOffset, y]);
                    });
                    
                    // Close the path by returning to the first point
                    if (violinPath.length > 0) {
                        violinPath.push(violinPath[0]); // Add the first point again to close the path
                    }

                    // Ensure the path has enough points
                    if (violinPath.length < 4) { // Need at least a few points to form a curve/shape
                         console.warn(`Generated violin path has too few points (${violinPath.length}) for ${displaySeriesKey}. Skipping violin.`);
                         return;
                    }


                    const violinLine = d3.line()
                        .x(d => d[0]) // Access x coordinate from the [x, y] array in violinPath
                        .y(d => d[1]) // Access y coordinate from the [x, y] array in violinPath
                        .curve(d3.curveBasis); // Smooth curve


                    // Determine the color for the violin
                    // For combined series, use the color of the series that is checked
                    let violinColor;
                    if (displaySeriesKey === "1600/2000") {
                        // Check which series is active to determine color
                        if (activeGenerations["2000"] === false && activeGenerations["1600"] !== false) {
                            // If 2000 is unchecked but 1600 is checked, use 1600's color
                            violinColor = colorScale("1600");
                        } else if (activeGenerations["1600"] === false && activeGenerations["2000"] !== false) {
                            // If 1600 is unchecked but 2000 is checked, use 2000's color
                            violinColor = colorScale("2000");
                        } else if (activeGenerations["1600"] !== false && activeGenerations["2000"] !== false) {
                            // If both are checked, prefer 1600's color for consistency
                            violinColor = colorScale("1600");
                        } else {
                            // Fallback if neither is active (shouldn't happen as violin wouldn't render)
                            const representativeSeries = allGenerations.find(s => s === "1600" || s === "2000") || allGenerations[0];
                            violinColor = colorScale(representativeSeries);
                        }
                    } else {
                        violinColor = colorScale(displaySeriesKey);
                    }

                    // Create gradient for enhanced visual appeal
                    const gradientId = `violin-gradient-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`; // Sanitize ID
                     // Check if gradient already exists before creating
                    let gradient = defs.select(`#${gradientId}`);
                     if (gradient.empty()) {
                         gradient = defs.append("linearGradient")
                            .attr("id", gradientId)
                            .attr("gradientTransform", "rotate(90)");

                         gradient.append("stop")
                            .attr("offset", "0%")
                            .attr("stop-color", violinColor)
                            .attr("stop-opacity", 0.9);

                         gradient.append("stop")
                            .attr("offset", "100%")
                            .attr("stop-color", violinColor)
                            .attr("stop-opacity", 0.4);
                     } else {
                         // Update existing gradient color if needed
                         gradient.select("stop:first-child").attr("stop-color", violinColor);
                         gradient.select("stop:last-child").attr("stop-color", violinColor);
                     }


                    // Draw the violin shape
                    chartGroup.append("path")
                        .datum(violinPath)
                        .attr("d", violinLine)
                        .attr("fill", `url(#${gradientId})`) // Use the gradient fill
                        .attr("opacity", 0.8)
                        .attr("stroke", violinColor) // Use the base color for stroke
                        .attr("stroke-width", 1)
                        .attr("stroke-opacity", 0.8)
                        .attr("class", `violin-shape violin-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`)
                        .on('mouseover', function(event) {
                            // Calculate statistics for tooltip
                            const meanPrice = mean(validPrices);
                            const medianPrice = median(validPrices);
                            const stdDev = deviation(validPrices);
                            
                            // Find the generation and node size for this series
                            // Get unique die names for this series group
                            const uniqueDieNames = Array.from(new Set(gpusInGroup.map(gpu => gpu.dieName)));
                            
                            // Get generation and node size for tooltip (use the most common in the group)
                            let generation = "Unknown";
                            let nodeSize = "Unknown";
                            
                            if (uniqueDieNames.length > 0) {
                                // Find the most frequent generation in this group
                                const generationCounts = {};
                                const nodeSizes = {};
                                
                                gpusInGroup.forEach(gpu => {
                                    const dieInfo = gpuDieData[gpu.dieName];
                                    if (dieInfo) {
                                        generationCounts[dieInfo.generation] = (generationCounts[dieInfo.generation] || 0) + 1;
                                        nodeSizes[gpu.manufacturingNode] = (nodeSizes[gpu.manufacturingNode] || 0) + 1;
                                    }
                                });
                                
                                // Find the most common generation
                                let maxCount = 0;
                                Object.entries(generationCounts).forEach(([gen, count]) => {
                                    if (count > maxCount) {
                                        maxCount = count;
                                        generation = gen;
                                    }
                                });
                                
                                // Find the most common node size
                                maxCount = 0;
                                Object.entries(nodeSizes).forEach(([node, count]) => {
                                    if (count > maxCount) {
                                        maxCount = count;
                                        nodeSize = node;
                                    }
                                });
                            }
                            
                            // Show and position tooltip
                            d3.select(`.${tooltipContainerClass}`)
                                .style('visibility', 'visible')
                                .style('left', `${event.pageX + 15}px`)
                                .style('top', `${event.pageY - 10}px`);

                            // Create tooltip content
                            const tooltipContent = `
                                <div class="tooltip-title" style="color: ${violinColor};">${displaySeriesKey} Series</div>
                                <div class="tooltip-info">
                                    <strong>${generation}</strong><br>
                                    <strong>Node Size:</strong> ${nodeSize} nm<br>
                                    <strong>Mean:</strong> $${meanPrice.toFixed(2)} per mm²<br>
                                    <strong>Median:</strong> $${medianPrice.toFixed(2)} per mm²<br>
                                    <strong>S.D.:</strong> $${stdDev.toFixed(2)}<br>
                                    <strong>Sample Size:</strong> ${validPrices.length} GPUs
                                </div>
                            `;

                            d3.select(`.${tooltipContainerClass}`).html(tooltipContent);
                        })
                        .on('mouseout', function() {
                            // Hide tooltip
                            d3.select(`.${tooltipContainerClass}`)
                                .style('visibility', 'hidden');
                        });


                    // Calculate key statistics for the inner box/whiskers
                    // Ensure validPrices has enough points for quartiles
                    if (validPrices.length > 0) {
                        const sortedPrices = validPrices.sort(d3.ascending);
                        const stats = {
                            min: min(sortedPrices), // Use imported min
                            q1: validPrices.length >= 3 ? quantile(sortedPrices, 0.25) : undefined, // Use imported quantile
                            median: median(sortedPrices), // Use imported median
                            q3: validPrices.length >= 3 ? quantile(sortedPrices, 0.75) : undefined, // Use imported quantile
                            max: max(sortedPrices), // Use imported max
                            mean: mean(sortedPrices) // Use imported mean (Not drawn, but might be useful)
                        };


                        // Draw inner statistics - median line
                        if (isFinite(stats.median)) {
                             chartGroup.append("line")
                                .attr("x1", seriesX - dynamicViolinWidth / 4) // Use dynamic width for stats
                                .attr("x2", seriesX + dynamicViolinWidth / 4)
                                .attr("y1", yScale(stats.median))
                                .attr("y2", yScale(stats.median))
                                .attr("stroke", "#fff")
                                .attr("stroke-width", 2)
                                .attr("opacity", 0.9)
                                .attr("class", `violin-median violin-median-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`);
                        }

                        // Draw inner statistics - box for interquartile range (IQR)
                         if (isFinite(stats.q1) && isFinite(stats.q3) && stats.q1 <= stats.q3) {
                             const boxHeight = yScale(stats.q1) - yScale(stats.q3);
                             if (boxHeight >= 0) { // Draw even if height is 0 (single point)
                                  chartGroup.append("rect")
                                    .attr("x", seriesX - dynamicViolinWidth / 6) // Use dynamic width for stats
                                    .attr("y", yScale(stats.q3))
                                    .attr("width", dynamicViolinWidth / 3)
                                    .attr("height", boxHeight)
                                    .attr("fill", "#fff")
                                    .attr("opacity", 0.5)
                                    .attr("class", `violin-iqr violin-iqr-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`);
                             }
                        }

                        // Draw whiskers (connecting IQR box to min/max)
                         // Ensure min/max are valid and within the relevant range relative to the box
                         if (isFinite(stats.min) && isFinite(stats.q1) && stats.min < stats.q1) {
                              chartGroup.append("line") // Whisker line
                                .attr("x1", seriesX)
                                .attr("x2", seriesX)
                                .attr("y1", yScale(stats.min))
                                .attr("y2", yScale(stats.q1))
                                .attr("stroke", "#fff")
                                .attr("stroke-width", 1)
                                .attr("class", `violin-whisker violin-whisker-min-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`);
                             chartGroup.append("line") // Min cap
                                .attr("x1", seriesX - dynamicViolinWidth / 8)
                                .attr("x2", seriesX + dynamicViolinWidth / 8)
                                .attr("y1", yScale(stats.min))
                                .attr("y2", yScale(stats.min))
                                .attr("stroke", "#fff")
                                .attr("stroke-width", 1)
                                .attr("opacity", 0.7)
                                .attr("class", `violin-min-cap violin-min-cap-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`);
                         }

                         if (isFinite(stats.max) && isFinite(stats.q3) && stats.max > stats.q3) {
                             chartGroup.append("line") // Whisker line
                                .attr("x1", seriesX)
                                .attr("x2", seriesX)
                                .attr("y1", yScale(stats.q3))
                                .attr("y2", yScale(stats.max))
                                .attr("stroke", "#fff")
                                .attr("stroke-width", 1)
                                .attr("class", `violin-whisker violin-whisker-max-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`);
                             chartGroup.append("line") // Max cap
                                .attr("x1", seriesX - dynamicViolinWidth / 8)
                                .attr("x2", seriesX + dynamicViolinWidth / 8)
                                .attr("y1", yScale(stats.max))
                                .attr("y2", yScale(stats.max))
                                .attr("stroke", "#fff")
                                .attr("stroke-width", 1)
                                .attr("opacity", 0.7)
                                .attr("class", `violin-max-cap violin-max-cap-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`);
                         }

                    } else {
                        // Not enough points for stats, maybe just add the label below the violin space
                         chartGroup.append("text")
                            .attr("x", seriesX)
                            .attr("y", height + 10) // Position below X-axis label area
                            .attr("text-anchor", "middle")
                            .attr("fill", "#aaa")
                            .style("font-size", "10px")
                            .text(`(${validPrices.length} data point${validPrices.length === 1 ? '' : 's'})`) // Indicate number of points
                             .attr("class", `violin-label violin-label-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`);
                    }
                } else {
                     // Not enough valid data points for KDE/stats for this display series key
                      if (gpusInGroup.length > 0) { // Only add a note if there were GPUs in the group at all
                           console.log(`Not enough valid data points (${validPrices.length}) for violin plot for ${displaySeriesKey}.`);
                           // Optionally add a text note or draw a single point placeholder
                            chartGroup.append("text")
                                .attr("x", seriesX)
                                .attr("y", height / 2)
                                .attr("text-anchor", "middle")
                                .attr("fill", "#777")
                                .style("font-size", "10px")
                                .text(`Too few data points (${validPrices.length})`)
                                .attr("class", `violin-note violin-note-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`);
                      } else {
                           console.log(`No data points for ${displaySeriesKey}.`);
                      }
                }
            }); // End of Object.entries(dataByDisplaySeries).forEach

            // Draw scatter points over the violins
            // Use join for smoother updates
            
            // Create a scale to map die size to circle radius
            // Peg 300mm² as the default size (radius 4)
            const radiusScale = d3.scaleSqrt()  // Square root scale for perceptually accurate area representation
                .domain([0, 300, 800])  // Min, reference point, max expected die size in mm²
                .range([2, 4, 8])       // Min, default, max radius
                .clamp(true);           // Restrict output to the range values
            
            chartGroup.selectAll(".die-area-dot")
                 .data(processedData, d => d.model) // Use processedData and a key function (GPU model)
                 .join(
                     enter => enter.append('circle')
                         .attr('class', d => `die-area-dot dot-${d.series.replace(/\s+/g, '-')}`)
                         .attr('r', 0) // Start with radius 0 for animation
                         .attr('cx', d => {
                             const displaySeries = seriesPositionMapping[d.series] || d.series;
                             return xScale(displaySeries);
                         })
                         .attr('cy', d => yScale(d.pricePerMM2))
                         .attr('fill', d => colorScale(d.series))
                         .attr('stroke', '#fff')
                         .attr('stroke-width', 0.5)
                         .call(enter => enter.transition().duration(500)
                             .attr('r', d => radiusScale(d.dieSizeMM2))), // Scale radius based on die size

                     update => update
                         .attr('class', d => `die-area-dot dot-${d.series.replace(/\s+/g, '-')}`) // Update class if series changes (unlikely here)
                         .transition().duration(500) // Animate updates
                         .attr('cx', d => {
                              const displaySeries = seriesPositionMapping[d.series] || d.series;
                              return xScale(displaySeries);
                         })
                         .attr('cy', d => yScale(d.pricePerMM2))
                         .attr('fill', d => colorScale(d.series))
                         .attr('r', d => radiusScale(d.dieSizeMM2)) // Scale radius based on die size
                         .attr('opacity', 1), // Ensure opacity is correct after update


                     exit => exit.transition().duration(500).attr('r', 0).attr('opacity', 0).remove() // Animate exit
                 )
                 .on('mouseover', function(event, d) {
                     // Show and position tooltip
                     d3.select(`.${tooltipContainerClass}`)
                         .style('visibility', 'visible')
                         .style('left', `${event.pageX + 15}px`)
                         .style('top', `${event.pageY - 10}px`);

                     // Create tooltip content
                     const tooltipContent = `
                         <div class="tooltip-title" style="color: ${colorScale(d.series)};">${d.model}</div>
                         <div class="tooltip-info">
                             <strong>Series:</strong> ${d.series} series (${d.generation})<br>
                             <strong>MSRP:</strong> ${d.msrp ? `$${d.msrp.toLocaleString()}` : 'N/A'}<br>
                             <strong>Die Size:</strong> ${d.dieSizeMM2 ? `${d.dieSizeMM2.toLocaleString()} mm²` : 'N/A'}<br>
                             <strong>Price per mm²:</strong> ${d.pricePerMM2 != null && isFinite(d.pricePerMM2) ? `$${d.pricePerMM2.toFixed(2)}` : 'N/A'}<br>
                             <strong>Die Name:</strong> ${d.dieName || 'N/A'}<br>
                             <strong>Year:</strong> ${d.releaseYear || 'N/A'}
                         </div>
                     `;

                     d3.select(`.${tooltipContainerClass}`).html(tooltipContent);

                     // Highlight the point
                     d3.select(this)
                         .attr('r', 6)
                         .attr('stroke-width', 2)
                         .attr('opacity', 1); // Ensure full opacity when hovered
                 })
                 .on('mouseout', function(event, d) {
                     // Hide tooltip
                     d3.select(`.${tooltipContainerClass}`)
                         .style('visibility', 'hidden');

                     // Return point to its proper scaled size based on die area
                     d3.select(this)
                         .attr('r', d => radiusScale(d.dieSizeMM2))
                         .attr('stroke-width', 0.5)
                         .attr('opacity', 1); // Return to default non-hover opacity
                 });
        }

        // Cleanup function to remove tooltips created by D3 when component unmounts
        return () => {
            d3.select(`.${tooltipContainerClass}`).remove();
        };

    }, [
        dieAreaSvgRef,
        gpuData,
        gpuDieData,
        activeGenerations,
        setActiveGenerations,
        showAllDieGenerations,
        setShowAllDieGenerations,
        // Removed unused props: columnOrder, getTierFromModel
    ]);

    return (
        <svg ref={dieAreaSvgRef} style={{ display: 'block', margin: '20px auto' }}></svg>
    );
}

// Helper function for kernel density estimation
function kernelDensityEstimator(kernel, X) {
    // X are the y-values (price/mm^2 values) where density is estimated
    // V are the data points (validPrices)
    return function(V) {
        // For each estimation point x in X, calculate the mean of the kernel contributions
        return X.map(x => [x, mean(V, v => kernel(x - v))]); // Use imported mean
    };
}

// Epanechnikov kernel function
// v is the difference between the estimation point and a data point (x - data_point)
// k is the bandwidth
function kernelEpanechnikov(k) {
    return function(v) {
        // Only return non-zero if the point v is within the bandwidth k of the center (0)
        return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
    };
}

export default DieAreaPlot;