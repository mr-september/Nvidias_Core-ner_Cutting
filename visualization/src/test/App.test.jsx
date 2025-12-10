import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
    it('renders without crashing', () => {
        render(<App />)
    })

    it('renders the main title', () => {
        render(<App />)
        expect(screen.getByText('NVIDIA GPU Analyzer')).toBeInTheDocument()
    })

    it('renders all three chart sections', () => {
        render(<App />)

        // Check for chart section headings
        expect(screen.getByText('VRAM Evolution Over Time')).toBeInTheDocument()
        expect(screen.getByText('GPU Price per Die Area Over Time')).toBeInTheDocument()
    })

    it('renders the GitHub link', () => {
        render(<App />)
        const githubLink = screen.getByTitle('View on GitHub')
        expect(githubLink).toBeInTheDocument()
        expect(githubLink).toHaveAttribute('href', 'https://github.com/mr-september/nvidia-gpu-analyzer')
    })
})
