# NVIDIA GPU Analyzer

> Interactive data visualization dashboard for analyzing NVIDIA GPU specifications, pricing, and market trends across generations.

**[Live Demo](https://mr-september.github.io/nvidia-gpu-analyzer/)** · **[Report Bug](https://github.com/mr-september/nvidia-gpu-analyzer/issues)**

![React](https://img.shields.io/badge/React-18.0-61DAFB?logo=react&logoColor=white)
![D3.js](https://img.shields.io/badge/D3.js-7.0-F9A03C?logo=d3.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## Overview

This project provides an interactive visualization platform for exploring NVIDIA GPU data spanning from the 500 series to present. It offers multiple analytical perspectives on GPU specifications and value propositions, with features like inflation-adjusted pricing, die utilization analysis, and cross-generation comparisons.

### Key Features

- **CUDA Core Analysis** — Track core count evolution with normalized flagship comparisons and logarithmic scaling options
- **VRAM Trend Visualization** — Compare memory capacity across GPU tiers with gaming console memory as context
- **Die Area Pricing** — Analyze $/mm² metrics with CPI inflation adjustment and real wage scaling
- **Interactive Filtering** — Toggle generations, GPU classes, and visualization modes in real-time
- **Responsive Tooltips** — Hover for detailed specifications on any data point

## Technical Highlights

- **D3.js Integration** — Custom-built visualizations including violin plots with kernel density estimation
- **React State Management** — Efficient re-rendering with component-level state lifting
- **Modular Architecture** — Separated chart components (`CudaPlot`, `VramPlot`, `DieAreaPlot`) for maintainability
- **Economic Data Integration** — Incorporates CPI and median wage data for real-value analysis
- **SEO Optimized** — Full Open Graph and Twitter Card meta tags with structured data

## Tech Stack

| Category | Technologies |
|----------|-------------|
| Frontend | React 18, D3.js 7 |
| Build | Vite, ESLint |
| Styling | CSS3, Tailwind (config) |
| Deployment | GitHub Pages |

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/mr-september/nvidia-gpu-analyzer.git
cd nvidia-gpu-analyzer/visualization

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

Built files are output to `/docs` for GitHub Pages deployment.

## Project Structure

```
visualization/
├── src/
│   ├── App.jsx           # Main application component
│   ├── CudaPlot.jsx      # CUDA cores visualization
│   ├── VramPlot.jsx      # VRAM comparison chart
│   ├── DieAreaPlot.jsx   # Die area pricing analysis
│   └── assets/           # GPU/economic data (JSON)
├── public/               # Static assets
└── docs/                 # Production build output
```

## Data Sources

- **GPU Specifications**: [TechPowerUp GPU Database](https://www.techpowerup.com/gpu-specs/)
- **Economic Data**: [Federal Reserve Economic Data (FRED)](https://fred.stlouisfed.org)
- **Wafer Pricing**: Industry estimates from public reports

## Roadmap

- [ ] Implement VRAM/price and VRAM/core ratio charts
- [ ] Expand dataset to include AMD GPUs
- [ ] Add export functionality for charts

## Contributing

Contributions are welcome! The data files in `/visualization/src/assets` can be extended to enable new visualizations.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-chart`)
3. Commit changes (`git commit -m 'Add new visualization'`)
4. Push to branch (`git push origin feature/new-chart`)
5. Open a Pull Request

## Acknowledgements

- [u/brennan313](https://reddit.com/u/brennan313) — Background image
- [TechPowerUp](https://www.techpowerup.com/) — GPU specification data
- [FRED](https://fred.stlouisfed.org) — CPI and wage statistics

## License

Distributed under the MIT License. See `LICENSE` for more information.
