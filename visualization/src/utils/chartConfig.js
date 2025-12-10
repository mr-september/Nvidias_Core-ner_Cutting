/**
 * Chart Configuration Constants
 * 
 * Shared configuration values used across chart components.
 */

/**
 * GPU tier ordering for X-axis (flagship to entry-level)
 */
export const columnOrder = [
    "90 Ti", "90", "80 Ti", "80", "70 Ti", "70", "60 Ti", "60", "50 Ti", "50", "30"
];

/**
 * Default chart margins
 */
export const defaultMargins = {
    top: 60,
    right: 250,
    bottom: 50,
    left: 90
};

/**
 * Default chart dimensions
 */
export const defaultDimensions = {
    width: 900,
    height: 450
};

/**
 * Color scheme for chart elements
 */
export const chartColors = {
    text: '#ddd',
    textMuted: '#aaa',
    grid: '#555',
    background: 'transparent',
    accent: '#646cff'
};
