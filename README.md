# NVIDIA GPU Core Visualization

This project offers visualizations of several *alternative* NVIDIA GPU metrics over time, starting from the 500 series. It features multiple interactive charts:

- **CUDA Core Visualization**: Tracks the evolution of CUDA core counts, tracking the decreasing percentage of cores in lower-tier cards compared to flagship models.
- **VRAM Analysis**: Displays memory capacity trends across different GPU tiers with console comparison capabilities.
- **Die Area Plots**: Examines die sizes vs MSRP, with options for inflation adjustment and effective (cut-down) vs. full die size analysis.

There are theoretically other visualizations possible from the data `.jsons` in `/visualization/src/assets`. Feel free to submit a pull request! 

### Future Work
- Add estimations for TSMC's supply prices charged to Nvidia.
- Add VRAM/price, VRAM/CUDA Cores.
- Add AMD GPUs. Challenge: AMD's naming scheme/product segmentation has varied wildly over this time period.

## Technologies Used
- **React**
- **Vite**
- **Tailwind CSS**
- **D3.js**

## Acknowledgements
- [u/brennan313](brennan313) for the background image.
- [TechPowerUp](https://www.techpowerup.com/) for GPU data.
- [FRED](https://fred.stlouisfed.org) for CPI and wage data.

## License
This project is licensed under the MIT License.
