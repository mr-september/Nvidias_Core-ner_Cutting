import { describe, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import VramPlot from '../VramPlot'

// Mock data for testing
const mockGpuData = [
    { model: 'RTX 4090', series: '4000', vram: 24, releaseYear: 2022 },
    { model: 'RTX 4080', series: '4000', vram: 16, releaseYear: 2022 },
    { model: 'RTX 3090', series: '3000', vram: 24, releaseYear: 2020 },
]

const mockConsoleData = [
    { name: 'PlayStation 5', platform: 'PlayStation', launchYear: 2020, memory: '16', launchPriceUSD: 499 },
    { name: 'Xbox Series X', platform: 'Xbox', launchYear: 2020, memory: '16', launchPriceUSD: 499 },
]

const mockColumnOrder = ["90 Ti", "90", "80 Ti", "80", "70 Ti", "70", "60 Ti", "60", "50 Ti", "50", "30"]

const mockGetTierFromModel = (modelName) => {
    const name = modelName.toUpperCase()
    if (name.includes('4090') || name.includes('3090')) return '90'
    if (name.includes('4080') || name.includes('3080')) return '80'
    return '70'
}

describe('VramPlot', () => {
    it('renders without crashing', () => {
        const svgRef = { current: document.createElementNS('http://www.w3.org/2000/svg', 'svg') }

        render(
            <VramPlot
                vramSvgRef={svgRef}
                gpuData={mockGpuData}
                consoleData={mockConsoleData}
                columnOrder={mockColumnOrder}
                getTierFromModel={mockGetTierFromModel}
                selectedClasses={{
                    "90 Ti": true, "90": true, "80 Ti": true, "80": true,
                    "70 Ti": false, "70": true, "60 Ti": false, "60": true,
                    "50 Ti": false, "50": true, "30": false
                }}
                setSelectedClasses={vi.fn()}
                showAllClasses={true}
                setShowAllClasses={vi.fn()}
                showConsoleData={true}
                setShowConsoleData={vi.fn()}
                visibleConsolePlatforms={{ PlayStation: true, Xbox: true }}
                setVisibleConsolePlatforms={vi.fn()}
                memoryAllocationPercentage={100}
                setMemoryAllocationPercentage={vi.fn()}
            />
        )
    })

    it('renders without console data', () => {
        const svgRef = { current: document.createElementNS('http://www.w3.org/2000/svg', 'svg') }

        render(
            <VramPlot
                vramSvgRef={svgRef}
                gpuData={mockGpuData}
                consoleData={mockConsoleData}
                columnOrder={mockColumnOrder}
                getTierFromModel={mockGetTierFromModel}
                selectedClasses={{
                    "90 Ti": true, "90": true, "80 Ti": true, "80": true,
                    "70 Ti": false, "70": true, "60 Ti": false, "60": true,
                    "50 Ti": false, "50": true, "30": false
                }}
                setSelectedClasses={vi.fn()}
                showAllClasses={true}
                setShowAllClasses={vi.fn()}
                showConsoleData={false}
                setShowConsoleData={vi.fn()}
                visibleConsolePlatforms={{ PlayStation: true, Xbox: true }}
                setVisibleConsolePlatforms={vi.fn()}
                memoryAllocationPercentage={100}
                setMemoryAllocationPercentage={vi.fn()}
            />
        )
    })
})
