import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';
import './App.css';
import gpuData from './assets/gpu_data.json';

function App() {
  const [toggleMode, setToggleMode] = useState(false);

  useEffect(() => {
    // Clear previous chart
    d3.select('#line-chart').selectAll('*').remove();

    const svg = d3.select('#line-chart')
      .attr('width', 800) // Adjust width based on number of columns needed
      .attr('height', 400);

    const generations = Array.from(new Set(gpuData.map(d => d.series)));
    console.log("GPU Data:", gpuData); // Keep this for debugging
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(generations);

    // Define the desired order and assign a value (lower = earlier/left)
    const modelOrderValue = (modelName) => {
      const name = modelName.toUpperCase(); // Case-insensitive matching
      // Extract the number part (e.g., 4090, 580)
      const numMatch = name.match(/(\d{3,4})/);
      if (!numMatch) return 999; // Unknown models last

      const numStr = numMatch[1];
      // Get the tier number (last two digits usually)
      const tierNum = parseInt(numStr.slice(-2), 10);
      const isTi = name.includes(' TI'); // Check for " TI"
      // Add isSuper if needed: const isSuper = name.includes(' SUPER');

      let baseValue;
      // Assign base values - lower is better/higher tier
      if (tierNum >= 90) baseValue = 0;
      else if (tierNum >= 80) baseValue = 2;
      else if (tierNum >= 70) baseValue = 4;
      else if (tierNum >= 60) baseValue = 6;
      else if (tierNum >= 50) baseValue = 8;
      // Add handling for lower tiers if necessary
      else return 998; // Other known numbers after the main tiers

      // Adjust value: Ti comes BEFORE non-Ti
      if (isTi) {
        return baseValue; // e.g., 90 Ti gets 0
      } else {
        return baseValue + 1; // e.g., 90 gets 1
      }
      // Example extension for Super:
      // else if (isSuper) { return baseValue + 1; }
      // else { return baseValue + 2; }
    };

    generations.forEach(series => {
      const seriesData = gpuData.filter(d => d.series === series);

      // Find the flagship for normalization - CHECK this logic matches your data
      // Maybe you want the highest CUDA core card per series instead?
      // Let's assume the 'flagship' boolean is reliable for now.
      let flagship = seriesData.find(d => d.flagship);

      // Fallback if no explicit flagship: find highest CUDA? Or highest tier card?
      if (!flagship) {
         console.warn(`No flagship found for series ${series}. Normalization might be off.`);
         // Example fallback: use the card with the highest modelOrderValue (lowest number)
         flagship = seriesData.sort((a, b) => modelOrderValue(a.model) - modelOrderValue(b.model))[0];
         // Or fallback: use the card with highest CUDA cores
         // flagship = seriesData.sort((a,b) => b.cudaCores - a.cudaCores)[0];
         if (!flagship) return; // Skip series if no usable card found
      }

      const normalizedData = seriesData.map(d => ({
        ...d,
        normalizedCores: d.cudaCores != null && flagship.cudaCores ? (d.cudaCores / flagship.cudaCores) * 100 : null,
        orderValue: modelOrderValue(d.model) // Calculate order value for sorting
      }));

      // Filter out models we can't position and sort by the calculated order value
      const sortedData = normalizedData
        .filter(d => d.orderValue < 900) // Remove models that didn't get a proper value
        .sort((a, b) => a.orderValue - b.orderValue); // Sort by the calculated value

      console.log(`Sorted data for series ${series}:`, sortedData.map(d => ({ model: d.model, order: d.orderValue, normCores: d.normalizedCores })));

      // Adjust for toggle mode *after* sorting
      if (toggleMode && flagship && flagship.model.toUpperCase().includes('80')) {
         // Check if the first element IS the 80 Ti or 80 to decide where to insert
         const firstCardOrderValue = sortedData.length > 0 ? sortedData[0].orderValue : -1;
         // We want to insert before the 80/80Ti group (value 2 or 3)
         if (firstCardOrderValue >= 2) {
             // Insert blank at the beginning if 90s aren't present
             sortedData.unshift({ model: 'Blank', normalizedCores: null, orderValue: -1 });
         } else {
             // Find where the 80/80Ti group starts and insert before it
             const insertIndex = sortedData.findIndex(d => d.orderValue >= 2);
             if (insertIndex !== -1) {
                 sortedData.splice(insertIndex, 0, { model: 'Blank', normalizedCores: null, orderValue: -1 });
             } else {
                 // If only 90s exist, add blank at the end? Or maybe not needed?
                 // This case needs thought - what should toggle do if only 90/90Ti exist?
                 // Let's ignore adding blank if only 90s are present for now.
             }
         }
       }


      // Define X scale based on the number of potential positions (e.g., 10 for 50-90 + Ti variants)
      // Or use the index 'i' if the sorted array is guaranteed to have gaps where models don't exist
      const xOffset = 50; // Left margin
      const columnWidth = 70; // Space between points

      const line = d3.line()
        .defined(d => d.normalizedCores !== null)
        // Use index 'i' - relies on sortedData having items in the correct column order
        .x((d, i) => xOffset + i * columnWidth)
        // Use normalized cores for Y
        .y(d => 350 - (d.normalizedCores || 0) * 3); // Use 0 for null cores to avoid errors

      svg.append('path')
        .datum(sortedData)
        .attr('fill', 'none')
        .attr('stroke', colorScale(series))
        .attr('stroke-width', 2)
        .attr('d', line);

      // Add points and labels (Optional but helpful)
      svg.selectAll(`.dot-${series}`)
        .data(sortedData.filter(d => d.normalizedCores !== null)) // Only plot points with data
        .enter().append('circle')
          .attr('class', `dot-${series}`)
          .attr('cx', (d, i) => xOffset + i * columnWidth)
          .attr('cy', d => 350 - (d.normalizedCores || 0) * 3)
          .attr('r', 4)
          .attr('fill', colorScale(series))
          .append('title') // Tooltip
            .text(d => `${d.model}\nNorm. Cores: ${d.normalizedCores.toFixed(1)}%`);

    });

     // Add X-axis labels (Optional) - Needs refinement based on actual columns plotted
     const potentialColumns = ["90 Ti", "90", "80 Ti", "80", "70 Ti", "70", "60 Ti", "60", "50 Ti", "50"]; // Example full set
     svg.selectAll(".x-axis-label")
        .data(potentialColumns) // Or derive labels from the actual sortedData if dynamic
        .enter().append("text")
        .attr("class", "x-axis-label")
        .attr("x", (d, i) => xOffset + i * columnWidth)
        .attr("y", 370) // Position below the chart
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text(d => d);


  }, [toggleMode, gpuData]); // Add gpuData dependency if it could change, although it's imported statically here

  return (
    <div className="App">
      <h1 style={{ textAlign: 'center', margin: '20px 0' }}>Nvidia's Core-ner Cutting</h1>
      <button
        onClick={() => setToggleMode(!toggleMode)}
        style={{ display: 'block', margin: '10px auto', padding: '10px 20px', cursor: 'pointer' }}
      >
        Toggle Mode
      </button>
      <svg id="line-chart" style={{ display: 'block', margin: '0 auto' }}></svg>
    </div>
  );
}

export default App;
