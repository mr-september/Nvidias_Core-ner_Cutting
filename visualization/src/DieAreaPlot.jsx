// DieAreaPlot.jsx
import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';
// Import specific statistical functions from d3-array
import { deviation, mean, median, quantile, min, max, range } from 'd3-array';
import inflationData from './assets/inflation_data.json'; // Import inflation data
import medianRealWageData from './assets/median_real_wage_data.json'; // Import median REAL wage data
import waferPrices from './assets/wafer_prices.json'; // Import wafer prices data
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
    // State for toggling between full and effective die calculations
    const [useEffectiveDieSize, setUseEffectiveDieSize] = useState(false);
    // State for toggling CPI inflation adjustment
    const [useCpiAdjustment, setUseCpiAdjustment] = useState(false);
    // State for toggling scaling based on real wage changes
    const [useRealWageScaling, setUseRealWageScaling] = useState(false);
    // State for toggling wafer price background area and second axis
    const [showWaferPriceArea, setShowWaferPriceArea] = useState(true); // State controls area + second axis

    // Function to handle adjustment toggle clicks
    const handleAdjustmentToggle = (type) => {
        if (type === 'cpi') {
            setUseCpiAdjustment(!useCpiAdjustment);
        } else if (type === 'wage') {
            setUseRealWageScaling(!useRealWageScaling);
        }
    };

    useEffect(() => {
        // Ensure data and ref are available
        if (!gpuData || !gpuDieData || !dieAreaSvgRef.current || !waferPrices || !inflationData || !medianRealWageData) {
            console.warn("DieAreaPlot: Missing required props, ref, or data files.");
            return;
        }

        const svg = d3.select(dieAreaSvgRef.current);
        svg.selectAll("*").remove(); // Clear previous renders

        // --- Chart Dimensions and Margins ---
        // Increase right margin for the second Y-axis
        const margin = { top: 80, right: 300, bottom: 60, left: 90 }; // Increased top margin for node labels too
        const containerWidth = 1100; // Increased container width slightly
        const containerHeight = 450;
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        svg.attr('width', containerWidth)
           .attr('height', containerHeight);

        // --- Background and Filters ---
        svg.append("rect")
            .attr("x", 0).attr("y", 0)
            .attr("width", containerWidth).attr("height", containerHeight)
            .attr("rx", 15).attr("ry", 15)
            .attr("fill", "transparent")
            .attr("class", "chart-background")
            .attr("filter", "url(#glow)");

        const defs = svg.append("defs");
        const filter = defs.append("filter")
            .attr("id", "glow")
            .attr("x", "-20%").attr("y", "-20%")
            .attr("width", "140%").attr("height", "140%");
        filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
        filter.append("feComposite").attr("in", "SourceGraphic").attr("in2", "blur").attr("operator", "over");

        const chartGroup = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // --- Tooltip Setup ---
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
            d3.select(`.${tooltipContainerClass}`).style('visibility', 'hidden');
        }

        // --- Toggle Buttons ---
        const toggleButtonWidth = 120;
        const toggleButtonHeight = 25;
        const toggleButtonSpacing = 10;
        // Position toggles slightly lower due to increased top margin
        const toggleButtonY = -60;

        // Position toggles from right to left
        const dieToggleX = width - toggleButtonWidth - 10;
        const wageToggleX = dieToggleX - toggleButtonWidth - toggleButtonSpacing;
        const cpiToggleX = wageToggleX - toggleButtonWidth - toggleButtonSpacing;
        const waferToggleX = cpiToggleX - toggleButtonWidth - toggleButtonSpacing; // New toggle on the far left

        // Wafer Price Area Toggle
        chartGroup.append("rect")
            .attr("x", waferToggleX).attr("y", toggleButtonY)
            .attr("width", toggleButtonWidth).attr("height", toggleButtonHeight)
            .attr("rx", 5).attr("ry", 5)
            .attr("fill", showWaferPriceArea ? "#4CAF50" : "#444") // Green for wafer
            .attr("cursor", "pointer")
            .attr("class", "wafer-toggle-btn")
            .on("click", () => setShowWaferPriceArea(!showWaferPriceArea)) // Update state setter
            .on("mouseover", (event) => {
                d3.select(`.${tooltipContainerClass}`)
                    .style('visibility', 'visible').style('left', `${event.pageX}px`).style('top', `${event.pageY - 40}px`)
                    .html(`<div style="text-align: center; padding: 5px;"><strong>Wafer Price Trend</strong></div>
                           <div style="padding: 5px;"><strong>Off:</strong> Hide wafer price trend area & axis.<br>
                           <strong>On:</strong> Show estimated wafer price per mm² background area and dedicated Y-axis.<br>
                           <span style="font-size: 0.9em; color: #aaa;">Data represents rough third-party estimates for wafer prices. Adjustments (CPI/Wage) applied if active.</span></div>`); // Updated tooltip text
            })
            .on("mouseout", () => d3.select(`.${tooltipContainerClass}`).style('visibility', 'hidden'));
        chartGroup.append("text")
            .attr("x", waferToggleX + toggleButtonWidth / 2).attr("y", toggleButtonY + toggleButtonHeight / 2 + 4)
            .attr("text-anchor", "middle").attr("fill", "#fff").style("font-size", "12px").style("pointer-events", "none")
            .text(showWaferPriceArea ? "Wafer On" : "Wafer Off"); // Text remains the same

        // CPI Inflation Toggle
        chartGroup.append("rect")
            .attr("x", cpiToggleX).attr("y", toggleButtonY)
            .attr("width", toggleButtonWidth).attr("height", toggleButtonHeight)
            .attr("rx", 5).attr("ry", 5)
            .attr("fill", useCpiAdjustment ? "#646cff" : "#444")
            .attr("cursor", "pointer").attr("class", "cpi-toggle-btn")
            .on("click", () => handleAdjustmentToggle('cpi'))
            .on("mouseover", (event) => {
                d3.select(`.${tooltipContainerClass}`)
                    .style('visibility', 'visible').style('left', `${event.pageX}px`).style('top', `${event.pageY - 40}px`)
                    .html(`<div style="text-align: center; padding: 5px;"><strong>CPI Adjustment</strong></div>
                           <div style="padding: 5px;"><strong>Off:</strong> No CPI adjustment applied.<br>
                           <strong>On:</strong> Adjusts MSRP to constant ${inflationData.base_year} dollars using US CPI data.<br>
                           <span style="font-size: 0.9em; color: #aaa;">Can be combined with Wage toggle.</span><br>Base year: ${inflationData.base_year}</div>`);
            })
            .on("mouseout", () => d3.select(`.${tooltipContainerClass}`).style('visibility', 'hidden'));
        chartGroup.append("text")
            .attr("x", cpiToggleX + toggleButtonWidth / 2).attr("y", toggleButtonY + toggleButtonHeight / 2 + 4)
            .attr("text-anchor", "middle").attr("fill", "#fff").style("font-size", "12px").style("pointer-events", "none")
            .text(useCpiAdjustment ? "CPI On" : "CPI Off");

        // Real Wage Scaling Toggle
        chartGroup.append("rect")
            .attr("x", wageToggleX).attr("y", toggleButtonY)
            .attr("width", toggleButtonWidth).attr("height", toggleButtonHeight)
            .attr("rx", 5).attr("ry", 5)
            .attr("fill", useRealWageScaling ? "#ff646c" : "#444") // Red for wage
            .attr("cursor", "pointer").attr("class", "wage-toggle-btn")
            .on("click", () => handleAdjustmentToggle('wage'))
            .on("mouseover", (event) => {
                d3.select(`.${tooltipContainerClass}`)
                    .style('visibility', 'visible').style('left', `${event.pageX}px`).style('top', `${event.pageY - 40}px`)
                    .html(`<div style="text-align: center; padding: 5px;"><strong>Wage Scaling</strong></div>
                           <div style="padding: 5px;"><strong>Off:</strong> No wage scaling.<br>
                           <strong>On, CPI Off:</strong> Scales MSRP by nominal wage change.<br>
                           <strong>On, CPI On:</strong> Scales MSRP by real wage change.<br>
                           <span style="font-size: 0.9em; color: #aaa;">Base year: 2024</span></div>`);
            })
            .on("mouseout", () => d3.select(`.${tooltipContainerClass}`).style('visibility', 'hidden'));
        chartGroup.append("text")
            .attr("x", wageToggleX + toggleButtonWidth / 2).attr("y", toggleButtonY + toggleButtonHeight / 2 + 4)
            .attr("text-anchor", "middle").attr("fill", "#fff").style("font-size", "12px").style("pointer-events", "none")
            .text(useRealWageScaling ? "Wage On" : "Wage Off");

        // Die Calculation Toggle
        chartGroup.append("rect")
            .attr("x", dieToggleX).attr("y", toggleButtonY)
            .attr("width", toggleButtonWidth).attr("height", toggleButtonHeight)
            .attr("rx", 5).attr("ry", 5)
            .attr("fill", useEffectiveDieSize ? "#646cff" : "#444")
            .attr("cursor", "pointer").attr("class", "die-toggle-btn")
            .on("click", () => setUseEffectiveDieSize(!useEffectiveDieSize))
            .on("mouseover", (event) => {
                d3.select(`.${tooltipContainerClass}`)
                    .style('visibility', 'visible').style('left', `${event.pageX}px`).style('top', `${event.pageY - 40}px`)
                    .html(`<div style="text-align: center; padding: 5px;"><strong>Die Price Calculation</strong></div>
                           <div style="padding: 5px;"><strong>Full Die:</strong> Uses total die area.<br>
                           <strong>Disabled Die:</strong> Accounts for partially disabled dies (30% fixed + 70% linear scaling).</div>`);
            })
            .on("mouseout", () => d3.select(`.${tooltipContainerClass}`).style('visibility', 'hidden'));
        chartGroup.append("text")
            .attr("x", dieToggleX + toggleButtonWidth / 2).attr("y", toggleButtonY + toggleButtonHeight / 2 + 4)
            .attr("text-anchor", "middle").attr("fill", "#fff").style("font-size", "12px").style("pointer-events", "none")
            .text(useEffectiveDieSize ? "Disabled Die" : "Full Die");


        // --- Data Processing ---
        // Function to calculate adjustment multiplier based on year and toggles
        const getAdjustmentMultiplier = (yearStr) => {
             const year = yearStr.toString();
             let multiplier = 1;
             let type = 'Nominal';

             const baseRealWage = medianRealWageData["2024"] || 373;
             const baseCPI = inflationData.cpi_data["2024"] || 313.2;
             const yearRealWage = medianRealWageData[year];
             const yearCPI = inflationData.cpi_data[year];
             const cpiMultiplier = inflationData.multipliers[year];
             const baseNominalWage = baseRealWage * (baseCPI / 100);
             const yearNominalWage = yearRealWage && yearCPI ? yearRealWage * (yearCPI / 100) : null;

             if (useCpiAdjustment && useRealWageScaling) {
                 if (yearRealWage && baseRealWage && yearRealWage > 0) {
                     multiplier = baseRealWage / yearRealWage;
                     type = 'Real Wage (to 2024)';
                 } else { type = 'Nominal (Wage Data Missing)'; }
             } else if (useCpiAdjustment && !useRealWageScaling) {
                 if (cpiMultiplier) {
                     multiplier = cpiMultiplier;
                     type = `CPI Adj. (to ${inflationData.base_year})`;
                 }
             } else if (!useCpiAdjustment && useRealWageScaling) {
                 if (yearNominalWage && baseNominalWage && yearNominalWage > 0) {
                     multiplier = baseNominalWage / yearNominalWage;
                     type = 'Nominal Wage (to 2024)';
                 } else { type = 'Nominal (Wage Data Missing)'; }
             }
             return { multiplier, type };
        };

        // Process GPU data
        const processedData = gpuData
            .filter(gpu => {
                if (activeGenerations && activeGenerations[gpu.series] === false) return false;
                const dieInfo = gpuDieData[gpu.dieName];
                return gpu.msrp && dieInfo && dieInfo.dieSizeMM2 && gpu.releaseYear;
            })
            .map(gpu => {
                const dieInfo = gpuDieData[gpu.dieName];
                const fullCudaCores = dieInfo.fullCudaCores || 0;
                const actualCudaCores = gpu.cudaCores || 0;
                const dieUtilizationRatio = fullCudaCores > 0 ? actualCudaCores / fullCudaCores : 1;
                const effectiveDieSize = dieInfo.dieSizeMM2 * (0.3 + 0.7 * dieUtilizationRatio);

                const { multiplier: adjustmentMultiplier, type: adjustmentType } = getAdjustmentMultiplier(gpu.releaseYear);
                const adjustedMsrp = gpu.msrp * adjustmentMultiplier;

                return {
                    ...gpu,
                    dieSizeMM2: dieInfo.dieSizeMM2,
                    fullCudaCores: fullCudaCores,
                    dieUtilizationRatio: dieUtilizationRatio,
                    effectiveDieSize: effectiveDieSize,
                    generation: dieInfo.generation || "Unknown",
                    adjustmentMultiplier: adjustmentMultiplier,
                    adjustmentType: adjustmentType,
                    originalMsrp: gpu.msrp,
                    adjustedMsrp: adjustedMsrp,
                    pricePerMM2: adjustedMsrp / dieInfo.dieSizeMM2,
                    effectivePricePerMM2: adjustedMsrp / effectiveDieSize,
                    rawPricePerMM2: gpu.msrp / dieInfo.dieSizeMM2,
                    rawEffectivePricePerMM2: gpu.msrp / effectiveDieSize,
                    displayPricePerMM2: useEffectiveDieSize ? (adjustedMsrp / effectiveDieSize) : (adjustedMsrp / dieInfo.dieSizeMM2),
                    // Add manufacturing node for wafer price linkage
                    manufacturingNode: gpu.manufacturingNode
                };
            });

        // --- X Axis Setup (Generations) ---
        const seriesInfo = Array.from(new Set(processedData.map(d => d.series)))
            .map(series => {
                const seriesCards = processedData.filter(d => d.series === series);
                const earliestYear = seriesCards.length > 0 ? Math.min(...seriesCards.map(card => card.releaseYear)) : 0;
                 const firstCard = seriesCards.sort((a, b) => a.releaseYear - b.releaseYear)[0];
                 const manufacturingNode = firstCard ? firstCard.manufacturingNode : null;
                return { series, releaseYear: earliestYear, manufacturingNode };
            }).sort((a, b) => a.releaseYear - b.releaseYear);

        // Combine 1600/2000 series for X-axis tick
        const combinedSeriesInfo = seriesInfo.filter(info => info.series !== "1600" && info.series !== "2000");
        const has1600 = seriesInfo.some(info => info.series === "1600");
        const has2000 = seriesInfo.some(info => info.series === "2000");
        if (has1600 || has2000) {
            const series1600 = seriesInfo.find(info => info.series === "1600");
            const series2000 = seriesInfo.find(info => info.series === "2000");
            const releaseYear = series2000 ? series2000.releaseYear : (series1600 ? series1600.releaseYear : 2018);
            const manufacturingNode = series2000 ? series2000.manufacturingNode : (series1600 ? series1600.manufacturingNode : null);

            let insertIndex = combinedSeriesInfo.length;
            if (series2000) insertIndex = combinedSeriesInfo.findIndex(info => info.releaseYear > series2000.releaseYear);
            else if (series1600) insertIndex = combinedSeriesInfo.findIndex(info => info.releaseYear > series1600.releaseYear);
            if (insertIndex === -1) insertIndex = combinedSeriesInfo.length;

            combinedSeriesInfo.splice(insertIndex, 0, {
                series: "1600/2000", releaseYear, manufacturingNode, isCombo: true, series1: "1600", series2: "2000"
            });
        }

        const xScaleDomain = combinedSeriesInfo.length > 0 ? combinedSeriesInfo.map(info => info.series) : ["No Data"];

        const seriesToYear = {};
        const seriesToNode = {}; // Map display series name to manufacturing node
        combinedSeriesInfo.forEach(info => {
            seriesToYear[info.series] = info.releaseYear;
            seriesToNode[info.series] = info.manufacturingNode;
        });

        // Map original series name to its X-axis display key
        const seriesPositionMapping = {};
        processedData.forEach(d => {
            if (d.series === "1600" || d.series === "2000") seriesPositionMapping[d.series] = "1600/2000";
            else seriesPositionMapping[d.series] = d.series;
        });

        const xScale = d3.scalePoint().domain(xScaleDomain).range([0, width]).padding(0.5);

        // --- Y Axis Setup (Primary - GPU Price/mm²) ---
        const maxGpuPrice = max(processedData, d => d.displayPricePerMM2) || 5;
        const yMaxGpu = Math.ceil((maxGpuPrice || 5) * 1.1); // Max for GPU data only, add padding
        const yScale = d3.scaleLinear().domain([0, yMaxGpu]).range([height, 0]);

        // --- Prepare Wafer Data (Needed for both axes and area plot) ---
        let waferAreaData = []; // Initialize empty
        let maxWaferPrice = 0; // Initialize max wafer price

        if (showWaferPriceArea && processedData.length > 0) {
            waferAreaData = combinedSeriesInfo
                .map(info => {
                    const node = info.manufacturingNode;
                    const year = info.releaseYear;
                    const seriesKey = info.series;

                    if (!node || !year || !waferPrices[node] || !xScale(seriesKey)) return null;

                    const yieldFactor = { 40: 0.85, 28: 0.80, 16: 0.75, 12: 0.70, 8: 0.65, 5: 0.60 };
                    const effectiveArea = 70686 * (yieldFactor[node] || 0.7);
                    if (effectiveArea <= 0) return null;

                    const basePricePerMM2 = waferPrices[node] / effectiveArea;
                    const { multiplier, type } = getAdjustmentMultiplier(year);
                    const adjustedPricePerMM2 = basePricePerMM2 * multiplier;

                    // Store the raw price for potential use, and the adjusted one for plotting
                    return {
                        series: seriesKey,
                        node: node,
                        year: year,
                        xPos: xScale(seriesKey),
                        pricePerMM2: adjustedPricePerMM2, // Use adjusted price for scaling/plotting
                        adjustmentType: type
                    };
                })
                .filter(d => d !== null && isFinite(d.pricePerMM2) && d.pricePerMM2 >= 0);

            // Calculate max wafer price AFTER adjustments
            maxWaferPrice = max(waferAreaData, d => d.pricePerMM2) || 0;

            // Sort by X position for drawing the area/labels
            waferAreaData.sort((a, b) => a.xPos - b.xPos);
        }

        // --- Y Axis Setup (Secondary - Wafer Price/mm²) ---
        const yMaxWafer = Math.ceil((maxWaferPrice || 1) / 0.10) * 0.10;
        const yScaleWafer = d3.scaleLinear().domain([0, yMaxWafer]).range([height, 0]);


        // --- Draw Axes ---
        // X-Axis
        const xAxis = d3.axisBottom(xScale).tickFormat("");
        const xAxisGroup = chartGroup.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`).call(xAxis);
        xAxisGroup.selectAll(".tick").append("text").attr("y", 15).attr("x", 0).attr("text-anchor", "middle").attr("fill", "#ddd").style("font-size", "12px").text(d => d);
        xAxisGroup.selectAll(".tick").append("text").attr("y", 30).attr("x", 0).attr("text-anchor", "middle").attr("fill", "#aaa").style("font-size", "10px").text(d => seriesToYear[d]);
        chartGroup.append("text").attr("class", "x-axis-label").attr("text-anchor", "middle").attr("x", width / 2).attr("y", height + 50).attr("fill", "#ddd").style("font-size", "12px").text("GPU Generation");

        // Y-Axis (Primary - Left)
        const yAxisLeft = d3.axisLeft(yScale).tickFormat(d => `$${d}`);
        chartGroup.append("g").attr("class", "y-axis y-axis-left").call(yAxisLeft);
        let yAxisLabelText = "GPU Price per Die Area ($/mm²)";
        const { type: adjustmentTypeLabel } = getAdjustmentMultiplier("2024");
        if (adjustmentTypeLabel.includes('Real Wage')) yAxisLabelText = "GPU Price/Area ($/mm², Scaled by Real Wage vs 2024)";
        else if (adjustmentTypeLabel.includes('CPI Adj.')) yAxisLabelText = `GPU Price/Area ($/mm², ${inflationData.base_year} USD)`;
        else if (adjustmentTypeLabel.includes('Nominal Wage')) yAxisLabelText = "GPU Price/Area ($/mm², Scaled by Nominal Wage vs 2024)";
        chartGroup.append("text").attr("class", "y-axis-label").attr("text-anchor", "middle").attr("transform", "rotate(-90)").attr("y", -55).attr("x", -height / 2).attr("fill", "#ddd").style("font-size", "12px").text(yAxisLabelText);

        // Y-Axis (Secondary - Right, only if wafer data shown)
        if (showWaferPriceArea && waferAreaData.length > 0) {
            const yAxisRight = d3.axisRight(yScaleWafer).tickFormat(d => `$${d.toFixed(2)}`).ticks(5); // Fewer ticks might be good
            chartGroup.append("g")
                .attr("class", "y-axis y-axis-right")
                .attr("transform", `translate(${width}, 0)`)
                .call(yAxisRight)
                .selectAll("text") // Style the tick labels
                .attr("fill", "#aaaaaa"); // Muted color for secondary axis

            chartGroup.append("text")
                .attr("class", "y-axis-label-right")
                .attr("text-anchor", "middle")
                .attr("transform", `translate(${width + 45}, ${height / 2}) rotate(90)`) // Position and rotate
                .attr("fill", "#aaaaaa") // Muted color
                .style("font-size", "12px")
                .text("Est. Wafer Price ($/mm²)"); // Label for the right axis
        }


        // Gridlines (Based on Primary Left Axis)
        const yGridlines = d3.axisLeft(yScale).tickSize(-width).tickFormat("");
        chartGroup.append("g").attr("class", "grid").call(yGridlines).selectAll("line").attr("stroke", "#e0e0e0").attr("stroke-opacity", 0.15);
        chartGroup.select(".grid .domain").remove();

        // --- Legend ---
        const allGenerationsWithInfo = Array.from(new Set(gpuData.filter(gpu => gpuDieData[gpu.dieName]).map(gpu => gpu.series)))
            .map(series => {
                const firstCard = gpuData.find(d => d.series === series && gpuDieData[d.dieName]);
                const dieInfo = firstCard ? gpuDieData[firstCard.dieName] : null;
                return { series, releaseYear: firstCard ? firstCard.releaseYear : 0, generation: dieInfo ? dieInfo.generation : "Unknown" };
            })
            .sort((a, b) => a.releaseYear - b.releaseYear);
        const allGenerations = allGenerationsWithInfo.map(g => g.series);
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(allGenerations);

        // Adjust legend position due to increased right margin
        const dieAreaLegend = chartGroup.append("g").attr("class", "die-area-legend").attr("transform", `translate(${width + 70}, 0)`);
        dieAreaLegend.append("text").attr("x", 60).attr("y", -20).attr("font-size", "14px").attr("font-weight", "bold").attr("fill", "#ddd").attr("text-anchor", "middle").text("GPU Generation");

        const legendData = allGenerationsWithInfo.slice().sort((a, b) => {
            if (a.series === "1600" && b.series === "2000") return -1;
            if (a.series === "2000" && b.series === "1600") return 1;
            return a.releaseYear - b.releaseYear;
        });

        const legendItems = dieAreaLegend.selectAll(".legend-item").data(legendData).enter().append("g")
            .attr("class", "legend-item").attr("transform", (d, i) => `translate(0, ${i * 25})`);

        const toggleGeneration = (event, d) => {
             if (setActiveGenerations && setShowAllDieGenerations) {
                 setActiveGenerations(prev => {
                     const newState = { ...prev, [d.series]: prev[d.series] === false ? true : false };
                     const allAreSelected = allGenerations.every(gen => newState[gen] !== false);
                     setShowAllDieGenerations(allAreSelected);
                     return newState;
                 });
             }
        };

        legendItems.append("rect").attr("x", 0).attr("y", 0).attr("width", 15).attr("height", 15)
            .attr("fill", d => activeGenerations[d.series] !== false ? colorScale(d.series) : "#555")
            .attr("stroke", "#ddd").attr("stroke-width", 1).attr("rx", 3).attr("ry", 3).attr("cursor", "pointer")
            .attr("opacity", d => activeGenerations[d.series] !== false ? 1 : 0.5)
            .on("click", toggleGeneration);

        legendItems.append("text").attr("x", 20).attr("y", 12).text(d => `${d.series} (${d.generation})`)
            .style("font-size", "12px").style("font-weight", "bold")
            .attr("fill", d => activeGenerations[d.series] !== false ? "#ddd" : "#777")
            .attr("cursor", "pointer")
            .on("click", toggleGeneration);

        // Show All Checkbox
        const showAllGroup = dieAreaLegend.append("g").attr("class", "legend-item show-all")
            .attr("transform", `translate(0, ${legendData.length * 25 + 10})`);
        const toggleShowAll = () => {
             if (setActiveGenerations && setShowAllDieGenerations) {
                 const targetState = !showAllDieGenerations;
                 const newState = {};
                 allGenerations.forEach(gen => { newState[gen] = targetState; });
                 setActiveGenerations(newState);
                 setShowAllDieGenerations(targetState);
             }
        };
        showAllGroup.append("rect").attr("x", 0).attr("y", 0).attr("width", 15).attr("height", 15)
            .attr("stroke", "#ddd").attr("fill", showAllDieGenerations ? "#646cff" : "transparent")
            .attr("rx", 3).attr("ry", 3).attr("cursor", "pointer")
            .on("click", toggleShowAll);
        showAllGroup.append("text").attr("x", 25).attr("y", 12).attr("fill", "#ddd").style("font-size", "12px")
            .text("Show All Generations").attr("alignment-baseline", "middle").attr("cursor", "pointer")
            .on("click", toggleShowAll);

        // Legend Notes
        dieAreaLegend.append("text").attr("x", 0).attr("y", legendData.length * 25 + 50).attr("fill", "#aaa").style("font-size", "11px").text("* Colors represent GPU generations");
        dieAreaLegend.append("text").attr("x", 0).attr("y", legendData.length * 25 + 75).attr("fill", "#aaa").style("font-size", "11px").text("* Point sizes proportional");
        dieAreaLegend.append("text").attr("x", 0).attr("y", legendData.length * 25 + 90).attr("fill", "#aaa").style("font-size", "11px").attr("dx", 8.5).text("to die area (mm²)");


        // --- Draw Wafer Price Background Area & Node Labels (if enabled) ---
        if (showWaferPriceArea && waferAreaData.length > 0) {
             // Define the area generator using the SECONDARY (wafer) Y scale
             const waferArea = d3.area()
                 .x(d => d.xPos)
                 .y0(height) // Bottom of the area is the x-axis
                 .y1(d => yScaleWafer(Math.min(d.pricePerMM2, yMaxWafer))) // Use wafer scale, clamp to wafer max
                 .curve(d3.curveMonotoneX);

             // Draw the area
             chartGroup.append("path")
                 .datum(waferAreaData)
                 .attr("class", "wafer-price-area")
                 .attr("fill", "#cccccc") // Neutral light gray
                 .attr("fill-opacity", 0.25) // Slightly reduced opacity
                 .attr("stroke", "none") // No outline
                 .attr("d", waferArea);

             // Draw Node Labels AT THE TOP of the chart area
             chartGroup.append("g") // Group for node labels
                 .attr("class", "wafer-node-labels-top")
                 .selectAll(".wafer-node-label-top")
                 .data(waferAreaData)
                 .enter().append("text")
                 .attr("class", "wafer-node-label-top")
                 .attr("x", d => d.xPos)
                 .attr("y", -10) // Position labels 10px above the chart area (0 line)
                 .attr("text-anchor", "middle")
                 .attr("fill", "#aaaaaa") // Muted gray color
                 .attr("font-size", "10px")
                 .attr("font-weight", "bold")
                 .attr("opacity", 0.9) // Slightly transparent
                 .text(d => `${d.node}nm`);

        }


        // --- Draw Violin Plots and Scatter Points (AFTER area plot) ---
        if (processedData.length > 0) {
            // Group processed data by the *display* series key (e.g., "1600/2000")
            const dataByDisplaySeries = {};
            xScaleDomain.forEach(displaySeries => {
                if (displaySeries === "1600/2000") {
                     const active1600 = activeGenerations["1600"] !== false;
                     const active2000 = activeGenerations["2000"] !== false;
                     // Handle display based on active state
                     if (active1600 && active2000) dataByDisplaySeries[displaySeries] = processedData.filter(d => d.series === "1600" || d.series === "2000");
                     else if (active1600) dataByDisplaySeries[displaySeries] = processedData.filter(d => d.series === "1600");
                     else if (active2000) dataByDisplaySeries[displaySeries] = processedData.filter(d => d.series === "2000");
                     else dataByDisplaySeries[displaySeries] = [];
                } else if (displaySeries !== "No Data") {
                    // Only include data for active generations
                    if (activeGenerations[displaySeries] !== false) {
                        dataByDisplaySeries[displaySeries] = processedData.filter(d => seriesPositionMapping[d.series] === displaySeries);
                    } else {
                         dataByDisplaySeries[displaySeries] = [];
                    }
                }
            });


            const seriesToX = Object.fromEntries(xScaleDomain.map(series => [series, xScale(series)]));

            // Draw violin plots per display series key (Original Logic - Uses primary yScale)
            Object.entries(dataByDisplaySeries).forEach(([displaySeriesKey, gpusInGroup]) => {
                const seriesX = seriesToX[displaySeriesKey];
                 if (!seriesX && seriesX !== 0 || gpusInGroup.length === 0) { // Skip if series not found or group is empty
                     return;
                 }

                const validPrices = gpusInGroup
                    .map(d => d.displayPricePerMM2)
                    .filter(price => price != null && isFinite(price) && price >= 0 && price <= yMaxGpu); // Clamp to primary axis max

                if (validPrices.length >= 2) { // Need >= 2 for deviation/KDE
                    const stdDev = deviation(validPrices);
                    const bandwidth = Math.max(0.1, (stdDev || 0) * 1.5);
                    if (!isFinite(bandwidth) || bandwidth <= 0) {
                         console.warn(`Invalid bandwidth (${bandwidth}) for ${displaySeriesKey}. Skipping violin.`);
                         return;
                    }

                    const dynamicViolinWidth = 40;

                    // KDE Calculation (Uses primary yScale domain)
                     const priceMinKDE = min(validPrices);
                     const priceMaxKDE = max(validPrices);
                     const yRangeStart = Math.max(0, (priceMinKDE || 0) - bandwidth * 2);
                     const yRangeEnd = Math.min(yMaxGpu, (priceMaxKDE || yMaxGpu) + bandwidth * 2); // Clamp to primary max
                     const numPointsKDE = 100;
                     let yValues = range(yRangeStart, yRangeEnd, (yRangeEnd - yRangeStart) / numPointsKDE);
                     if (yValues.length < 2) {
                          const meanPrice = mean(validPrices) || (yMaxGpu / 2);
                          yValues = [...new Set([Math.max(0, meanPrice - 1), meanPrice, Math.min(yMaxGpu, meanPrice + 1)])].sort(d3.ascending);
                          if (yValues.length < 2) {
                              console.warn(`Could not generate sufficient yValues for KDE for ${displaySeriesKey}. Skipping violin.`);
                              return;
                          }
                     }

                    const kde = kernelDensityEstimator(kernelEpanechnikov(bandwidth), yValues);
                    const density = kde(validPrices);

                    const rawMaxDensity = max(density, d => d[1] != null && isFinite(d[1]) ? d[1] : 0) || 0.001;
                    const densityThreshold = rawMaxDensity * 0.01;

                    const validDensityPoints = density.filter(d =>
                        d[0] != null && isFinite(d[0]) && d[1] != null && isFinite(d[1]) && d[1] >= densityThreshold
                    );

                    if (validDensityPoints.length < 2) {
                         console.warn(`Not enough valid density points (${validDensityPoints.length}) after KDE for ${displaySeriesKey}. Skipping violin.`);
                         return;
                    }

                    const maxDensityValue = max(validDensityPoints, d => d[1]) || 0.001;
                     if (maxDensityValue <= 0) {
                         console.warn(`Max density is zero or negative (${maxDensityValue}) for ${displaySeriesKey}. Skipping violin.`);
                         return;
                     }

                    const densityScale = d3.scaleLinear().domain([0, maxDensityValue]).range([0, dynamicViolinWidth / 2]);

                    // Build violin path (Uses primary yScale)
                    const violinPath = [];
                    validDensityPoints.forEach(d => { violinPath.push([seriesX - densityScale(d[1]), yScale(d[0])]); });
                    [...validDensityPoints].reverse().forEach(d => { violinPath.push([seriesX + densityScale(d[1]), yScale(d[0])]); });
                    if (violinPath.length > 0) violinPath.push(violinPath[0]);

                    if (violinPath.length < 4) {
                         console.warn(`Generated violin path has too few points (${violinPath.length}) for ${displaySeriesKey}. Skipping violin.`);
                         return;
                    }

                    const violinLine = d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveBasis);

                    // Determine color (handle combined series)
                    let violinColor;
                     if (displaySeriesKey === "1600/2000") {
                         // Determine color based on which series actually has data in the group
                         const has1600Data = gpusInGroup.some(g => g.series === "1600");
                         const has2000Data = gpusInGroup.some(g => g.series === "2000");
                         if (has2000Data && (!has1600Data || activeGenerations["1600"] === false)) violinColor = colorScale("2000");
                         else violinColor = colorScale("1600"); // Default to 1600 if it has data or both do
                     } else {
                         violinColor = colorScale(displaySeriesKey) || "#ccc"; // Fallback color
                     }


                    // Gradient for violin fill
                    const gradientId = `violin-gradient-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`;
                    let gradient = defs.select(`#${gradientId}`);
                    if (gradient.empty()) {
                        gradient = defs.append("linearGradient").attr("id", gradientId).attr("gradientTransform", "rotate(90)");
                        gradient.append("stop").attr("offset", "0%").attr("stop-color", violinColor).attr("stop-opacity", 0.9);
                        gradient.append("stop").attr("offset", "100%").attr("stop-color", violinColor).attr("stop-opacity", 0.4);
                    } else {
                         gradient.selectAll("stop").attr("stop-color", violinColor);
                    }

                    // Draw violin shape
                    chartGroup.append("path")
                        .datum(violinPath)
                        .attr("d", violinLine)
                        .attr("fill", `url(#${gradientId})`)
                        .attr("opacity", 0.8)
                        .attr("stroke", violinColor)
                        .attr("stroke-width", 1)
                        .attr("stroke-opacity", 0.8)
                        .attr("class", `violin-shape violin-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`)
                        .on('mouseover', (event) => { // Tooltip (Original logic)
                            const meanVal = mean(validPrices);
                            const medianVal = median(validPrices);
                            const stdDevVal = deviation(validPrices);
                            const effectivePrices = gpusInGroup.map(d => d.effectivePricePerMM2).filter(p => p != null && isFinite(p) && p >= 0 && p <= yMaxGpu);
                            const effectiveMean = effectivePrices.length > 0 ? mean(effectivePrices) : null;
                            const effectiveMedian = effectivePrices.length > 0 ? median(effectivePrices) : null;
                            const { generation, node } = getGenerationAndNode(gpusInGroup, gpuDieData);

                             d3.select(`.${tooltipContainerClass}`)
                                .style('visibility', 'visible').style('left', `${event.pageX + 15}px`).style('top', `${event.pageY - 10}px`)
                                .html(`<div class="tooltip-title" style="color: ${violinColor};">${displaySeriesKey} Series</div>
                                       <div class="tooltip-info"><strong>${generation}</strong><br><strong>Node:</strong> ${node} nm<br>
                                       <div style="margin-top:5px; border-bottom:1px dotted #777; padding-bottom:3px;">
                                           <strong style="color:#a0e6ff;">Full Price/mm²:</strong><br>Mean: $${meanVal ? meanVal.toFixed(2) : 'N/A'}<br>Median: $${medianVal ? medianVal.toFixed(2) : 'N/A'}<br>S.D.: $${stdDevVal ? stdDevVal.toFixed(2) : 'N/A'}</div>
                                       <div style="margin-top:5px; border-bottom:1px dotted #777; padding-bottom:3px;">
                                           <strong style="color:#a0ffb0;">Cut Price/mm²:</strong>
                                           ${effectiveMean !== null ? `<br>Mean: $${effectiveMean.toFixed(2)}` : ''}
                                           ${effectiveMedian !== null ? `<br>Median: $${effectiveMedian.toFixed(2)}` : ''}
                                           ${effectivePrices.length > 0 ? `<br>(${effectivePrices.length} cut GPUs)` : '<br>No data'}</div>
                                       <div style="margin-top:5px;"><strong>Sample Size:</strong> ${validPrices.length} GPUs</div></div>`);
                        })
                        .on('mouseout', () => d3.select(`.${tooltipContainerClass}`).style('visibility', 'hidden'));

                    // Draw inner box/whiskers (Uses primary yScale)
                    if (validPrices.length > 0) {
                         const sortedPrices = [...validPrices].sort(d3.ascending);
                         const stats = {
                             min: min(sortedPrices),
                             q1: sortedPrices.length >= 3 ? quantile(sortedPrices, 0.25) : undefined,
                             median: median(sortedPrices),
                             q3: sortedPrices.length >= 3 ? quantile(sortedPrices, 0.75) : undefined,
                             max: max(sortedPrices)
                         };

                         const statGroup = chartGroup.append("g").attr("class", `violin-stats violin-stats-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`);
                         const statWidth = dynamicViolinWidth / 3;

                         if (isFinite(stats.median)) {
                              statGroup.append("line")
                                 .attr("x1", seriesX - statWidth / 2).attr("x2", seriesX + statWidth / 2)
                                 .attr("y1", yScale(stats.median)).attr("y2", yScale(stats.median))
                                 .attr("stroke", "#fff").attr("stroke-width", 2).attr("opacity", 0.9).attr("class", "violin-median");
                         }
                         if (isFinite(stats.q1) && isFinite(stats.q3) && stats.q1 <= stats.q3) {
                              const boxHeight = Math.max(0, yScale(stats.q1) - yScale(stats.q3));
                              statGroup.append("rect")
                                 .attr("x", seriesX - statWidth / 2).attr("y", yScale(stats.q3))
                                 .attr("width", statWidth).attr("height", boxHeight)
                                 .attr("fill", "#fff").attr("opacity", 0.4).attr("class", "violin-iqr");
                         }
                         if (isFinite(stats.min) && isFinite(stats.q1) && stats.min < stats.q1) {
                             statGroup.append("line").attr("x1", seriesX).attr("x2", seriesX).attr("y1", yScale(stats.min)).attr("y2", yScale(stats.q1)).attr("stroke", "#fff").attr("stroke-width", 1).attr("class", "violin-whisker");
                             statGroup.append("line").attr("x1", seriesX - statWidth / 4).attr("x2", seriesX + statWidth / 4).attr("y1", yScale(stats.min)).attr("y2", yScale(stats.min)).attr("stroke", "#fff").attr("stroke-width", 1).attr("opacity", 0.7).attr("class", "violin-min-cap");
                         }
                         if (isFinite(stats.max) && isFinite(stats.q3) && stats.max > stats.q3) {
                             statGroup.append("line").attr("x1", seriesX).attr("x2", seriesX).attr("y1", yScale(stats.q3)).attr("y2", yScale(stats.max)).attr("stroke", "#fff").attr("stroke-width", 1).attr("class", "violin-whisker");
                             statGroup.append("line").attr("x1", seriesX - statWidth / 4).attr("x2", seriesX + statWidth / 4).attr("y1", yScale(stats.max)).attr("y2", yScale(stats.max)).attr("stroke", "#fff").attr("stroke-width", 1).attr("opacity", 0.7).attr("class", "violin-max-cap");
                         }
                    }
                } else {
                      if (gpusInGroup.length > 0) {
                           console.log(`Not enough valid data points (${validPrices.length}) for violin plot for ${displaySeriesKey}.`);
                            chartGroup.append("text")
                                .attr("x", seriesX).attr("y", height / 2).attr("text-anchor", "middle")
                                .attr("fill", "#777").style("font-size", "10px")
                                .text(`Too few data points`).attr("class", `violin-note violin-note-${displaySeriesKey.replace(/[^a-zA-Z0-9-_]/g, '-')}`);
                      }
                }
            }); // End of violin loop

            // Draw scatter points (Uses primary yScale)
            const radiusScale = d3.scaleSqrt()
                .domain([0, 300, 800])
                .range([1, 4, 11])
                .clamp(true);

            const sortedDataForScatter = [...processedData].sort((a, b) => b.dieSizeMM2 - a.dieSizeMM2);

            chartGroup.selectAll(".die-area-dot")
                 .data(sortedDataForScatter.filter(d => activeGenerations[d.series] !== false), d => d.model) // Filter scatter points by active generation
                 .join(
                     enter => enter.append('circle')
                         .attr('class', d => `die-area-dot dot-${(seriesPositionMapping[d.series] || d.series).replace(/[^a-zA-Z0-9-_]/g, '-')}`)
                         .attr('cx', d => xScale(seriesPositionMapping[d.series] || d.series))
                         .attr('cy', d => yScale(d.displayPricePerMM2)) // Use primary scale
                         .attr('fill', d => colorScale(d.series))
                         .attr('stroke', '#fff').attr('stroke-width', 0.5)
                         .attr('r', 0)
                         .call(enter => enter.transition().duration(500).attr('r', d => radiusScale(d.dieSizeMM2))),
                     update => update
                         .attr('class', d => `die-area-dot dot-${(seriesPositionMapping[d.series] || d.series).replace(/[^a-zA-Z0-9-_]/g, '-')}`)
                         .transition().duration(500)
                         .attr('cx', d => xScale(seriesPositionMapping[d.series] || d.series))
                         .attr('cy', d => yScale(d.displayPricePerMM2)) // Use primary scale
                         .attr('fill', d => colorScale(d.series))
                         .attr('r', d => radiusScale(d.dieSizeMM2))
                         .attr('opacity', 0.85), // Set opacity on update too
                     exit => exit.transition().duration(500).attr('r', 0).attr('opacity', 0).remove()
                 )
                 .attr("opacity", 0.85)
                 .on('mouseover', function(event, d) { // Tooltip (Original logic)
                      d3.select(`.${tooltipContainerClass}`)
                         .style('visibility', 'visible').style('left', `${event.pageX + 15}px`).style('top', `${event.pageY - 10}px`);
                      let nominalValueString = '';
                      if (d.adjustmentType !== 'Nominal') {
                          const nominalPrice = useEffectiveDieSize ? d.rawEffectivePricePerMM2 : d.rawPricePerMM2;
                          nominalValueString = ` <span style="color: #aaa;">($${nominalPrice.toFixed(2)} nominal)</span>`;
                      }
                      d3.select(`.${tooltipContainerClass}`).html(
                         `<div class="tooltip-title" style="color: ${colorScale(d.series)};">${d.model}</div>
                          <div class="tooltip-info">
                              <strong>Series:</strong> ${d.series} (${d.generation})<br>
                              <strong>MSRP:</strong> ${d.originalMsrp ? `$${d.originalMsrp.toLocaleString()}` : 'N/A'}
                              ${d.adjustmentType !== 'Nominal' ? `<br><strong>Adj. MSRP (${d.adjustmentType}):</strong> $${d.adjustedMsrp.toFixed(0)}` : ''}<br>
                              <strong>Die Size:</strong> ${d.dieSizeMM2 ? `${d.dieSizeMM2.toLocaleString()} mm²` : 'N/A'}<br>
                              <strong>CUDA:</strong> ${d.cudaCores ? d.cudaCores.toLocaleString() : 'N/A'} / ${d.fullCudaCores ? d.fullCudaCores.toLocaleString() : 'N/A'} (${d.dieUtilizationRatio != null ? `${(d.dieUtilizationRatio * 100).toFixed(1)}%` : 'N/A'})<br>
                              <strong>${useEffectiveDieSize ? 'Cut' : 'Full'} Price/mm²:</strong> ${d.displayPricePerMM2 != null && isFinite(d.displayPricePerMM2) ? `$${d.displayPricePerMM2.toFixed(2)}` : 'N/A'}${nominalValueString}<br>
                              <span style="color: #ccc; font-size: 0.9em;">(${d.adjustmentType})</span><br>
                              <strong>Die:</strong> ${d.dieName || 'N/A'} (${d.manufacturingNode || 'N/A'}nm)<br>
                              <strong>Year:</strong> ${d.releaseYear || 'N/A'}
                          </div>`);
                      d3.select(this).attr('stroke-width', 2).attr('opacity', 1);
                 })
                 .on('mouseout', function(event, d) {
                      d3.select(`.${tooltipContainerClass}`).style('visibility', 'hidden');
                      d3.select(this).attr('stroke-width', 0.5).attr('opacity', 0.85);
                 });

        } else { // No processed data
            chartGroup.append("text").attr("x", width / 2).attr("y", height / 2)
                .attr("text-anchor", "middle").attr("fill", "#ddd").style("font-size", "14px")
                .text("No data to display based on current filters.");
        }

        // Cleanup function
        return () => {
            const tooltip = d3.select(`.${tooltipContainerClass}`);
            if (tooltip.size()) {
                tooltip.remove();
            }
        };

    }, [ // Update dependencies
        gpuData, gpuDieData, dieAreaSvgRef, activeGenerations,
        useEffectiveDieSize, useCpiAdjustment, useRealWageScaling, showWaferPriceArea, // Updated state variable dependency
        setActiveGenerations, setShowAllDieGenerations
    ]);

    return (
        <svg ref={dieAreaSvgRef} style={{ display: 'block', margin: '20px auto' }}></svg>
    );
}

// Helper function for kernel density estimation (from original code)
function kernelDensityEstimator(kernel, X) {
    return function(V) {
        return X.map(x => [x, mean(V, v => kernel(x - v))]);
    };
}

// Epanechnikov kernel function (from original code)
function kernelEpanechnikov(k) {
    return function(v) {
        return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
    };
}

// Helper to get most common generation and node for violin tooltip
function getGenerationAndNode(gpusInGroup, gpuDieData) {
     let generation = "Unknown";
     let node = "Unknown";
     if (!gpusInGroup || gpusInGroup.length === 0) return { generation, node };

     const generationCounts = {};
     const nodeCounts = {};
     gpusInGroup.forEach(gpu => {
         const dieInfo = gpuDieData[gpu.dieName];
         if (dieInfo && dieInfo.generation) {
             generationCounts[dieInfo.generation] = (generationCounts[dieInfo.generation] || 0) + 1;
         }
         if (gpu.manufacturingNode) {
             nodeCounts[gpu.manufacturingNode] = (nodeCounts[gpu.manufacturingNode] || 0) + 1;
         }
     });

     let maxGenCount = 0;
     Object.entries(generationCounts).forEach(([gen, count]) => {
         if (count > maxGenCount) { maxGenCount = count; generation = gen; }
     });

     let maxNodeCount = 0;
     Object.entries(nodeCounts).forEach(([n, count]) => {
         if (count > maxNodeCount) { maxNodeCount = count; node = n; }
     });

     return { generation, node };
}


export default DieAreaPlot;