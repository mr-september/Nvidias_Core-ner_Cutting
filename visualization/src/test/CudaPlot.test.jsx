import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import CudaPlot from '../CudaPlot'

// Mock data for testing
const mockGpuData = [
    { model: 'RTX 4090', series: '4000', cudaCores: 16384, releaseYear: 2022, flagship: true },
    { model: 'RTX 4080', series: '4000', cudaCores: 9728, releaseYear: 2022 },
    { model: 'RTX 3090', series: '3000', cudaCores: 10496, releaseYear: 2020, flagship: true },
]

const mockColumnOrder = ["90 Ti", "90", "80 Ti", "80", "70 Ti", "70", "60 Ti", "60", "50 Ti", "50", "30"]

const mockGetTierFromModel = (modelName) => {
    const name = modelName.toUpperCase()
    if (name.includes('4090') || name.includes('3090')) return '90'
    if (name.includes('4080') || name.includes('3080')) return '80'
    return '70'
}

describe('CudaPlot', () => {
    it('renders without crashing', () => {
        const svgRef = { current: document.createElementNS('http://www.w3.org/2000/svg', 'svg') }

        render(
            <CudaPlot
                svgRef={svgRef}
                gpuData={mockGpuData}
                columnOrder={mockColumnOrder}
                getTierFromModel={mockGetTierFromModel}
                toggleMode={false}
                useLogScale={false}
                specialFlagshipActive={{}}
                setSpecialFlagshipActive={vi.fn()}
                activeGenerations={{ '4000': true, '3000': true }}
                setActiveGenerations={vi.fn()}
                showAllCudaGenerations={true}
                setShowAllCudaGenerations={vi.fn()}
            />
        )
    })

    it('renders with toggle mode enabled', () => {
        const svgRef = { current: document.createElementNS('http://www.w3.org/2000/svg', 'svg') }

        render(
            <CudaPlot
                svgRef={svgRef}
                gpuData={mockGpuData}
                columnOrder={mockColumnOrder}
                getTierFromModel={mockGetTierFromModel}
                toggleMode={true}
                useLogScale={false}
                specialFlagshipActive={{}}
                setSpecialFlagshipActive={vi.fn()}
                activeGenerations={{ '4000': true, '3000': true }}
                setActiveGenerations={vi.fn()}
                showAllCudaGenerations={true}
                setShowAllCudaGenerations={vi.fn()}
            />
        )
    })

    it('renders with log scale enabled', () => {
        const svgRef = { current: document.createElementNS('http://www.w3.org/2000/svg', 'svg') }

        render(
            <CudaPlot
                svgRef={svgRef}
                gpuData={mockGpuData}
                columnOrder={mockColumnOrder}
                getTierFromModel={mockGetTierFromModel}
                toggleMode={false}
                useLogScale={true}
                specialFlagshipActive={{}}
                setSpecialFlagshipActive={vi.fn()}
                activeGenerations={{ '4000': true, '3000': true }}
                setActiveGenerations={vi.fn()}
                showAllCudaGenerations={true}
                setShowAllCudaGenerations={vi.fn()}
            />
        )
    })
})
