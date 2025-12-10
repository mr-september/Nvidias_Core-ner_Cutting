import { describe, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import DieAreaPlot from '../DieAreaPlot'

// Mock data for testing
const mockGpuData = [
    {
        model: 'RTX 4090',
        series: '4000',
        cudaCores: 16384,
        releaseYear: 2022,
        msrp: 1599,
        dieName: 'AD102',
        manufacturingNode: 5
    },
    {
        model: 'RTX 4080',
        series: '4000',
        cudaCores: 9728,
        releaseYear: 2022,
        msrp: 1199,
        dieName: 'AD103',
        manufacturingNode: 5
    },
]

const mockGpuDieData = {
    'AD102': { dieSizeMM2: 608, fullCudaCores: 18432, generation: 'Ada Lovelace' },
    'AD103': { dieSizeMM2: 379, fullCudaCores: 10240, generation: 'Ada Lovelace' },
}

const mockColumnOrder = ["90 Ti", "90", "80 Ti", "80", "70 Ti", "70", "60 Ti", "60", "50 Ti", "50", "30"]

const mockGetTierFromModel = (modelName) => {
    const name = modelName.toUpperCase()
    if (name.includes('4090') || name.includes('3090')) return '90'
    if (name.includes('4080') || name.includes('3080')) return '80'
    return '70'
}

describe('DieAreaPlot', () => {
    it('renders without crashing', () => {
        const svgRef = { current: document.createElementNS('http://www.w3.org/2000/svg', 'svg') }

        render(
            <DieAreaPlot
                dieAreaSvgRef={svgRef}
                gpuData={mockGpuData}
                gpuDieData={mockGpuDieData}
                columnOrder={mockColumnOrder}
                getTierFromModel={mockGetTierFromModel}
                activeGenerations={{ '4000': true }}
                setActiveGenerations={vi.fn()}
                showAllDieGenerations={true}
                setShowAllDieGenerations={vi.fn()}
            />
        )
    })

    it('renders with some generations hidden', () => {
        const svgRef = { current: document.createElementNS('http://www.w3.org/2000/svg', 'svg') }

        render(
            <DieAreaPlot
                dieAreaSvgRef={svgRef}
                gpuData={mockGpuData}
                gpuDieData={mockGpuDieData}
                columnOrder={mockColumnOrder}
                getTierFromModel={mockGetTierFromModel}
                activeGenerations={{ '4000': false }}
                setActiveGenerations={vi.fn()}
                showAllDieGenerations={false}
                setShowAllDieGenerations={vi.fn()}
            />
        )
    })
})
