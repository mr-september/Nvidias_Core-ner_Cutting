import { describe, it, expect } from 'vitest'
import { getTierFromModel } from '../utils/tierUtils'

describe('getTierFromModel', () => {
    describe('flagship tier extraction', () => {
        it('extracts tier 90 from RTX 4090', () => {
            expect(getTierFromModel('RTX 4090')).toBe('90');
        });

        it('extracts tier 90 Ti from RTX 3090 Ti', () => {
            expect(getTierFromModel('RTX 3090 Ti')).toBe('90 Ti');
        });

        it('extracts tier 80 from RTX 2080', () => {
            expect(getTierFromModel('RTX 2080')).toBe('80');
        });

        it('extracts tier 80 Ti from GTX 1080 Ti', () => {
            expect(getTierFromModel('GTX 1080 Ti')).toBe('80 Ti');
        });
    });

    describe('mid-range tier extraction', () => {
        it('extracts tier 70 from RTX 4070', () => {
            expect(getTierFromModel('RTX 4070')).toBe('70');
        });

        it('extracts tier 60 from GTX 1660', () => {
            expect(getTierFromModel('GTX 1660')).toBe('60');
        });

        it('extracts tier 60 Ti from GTX 1660 Ti', () => {
            expect(getTierFromModel('GTX 1660 Ti')).toBe('60 Ti');
        });
    });

    describe('budget tier extraction', () => {
        it('extracts tier 50 from RTX 4050', () => {
            expect(getTierFromModel('RTX 4050')).toBe('50');
        });

        it('extracts tier 30 from GT 1030', () => {
            expect(getTierFromModel('GT 1030')).toBe('30');
        });
    });

    describe('edge cases', () => {
        it('handles lowercase model names', () => {
            expect(getTierFromModel('rtx 4090')).toBe('90');
        });

        it('handles Ti suffix case-insensitively', () => {
            expect(getTierFromModel('RTX 3080 ti')).toBe('80 Ti');
        });

        it('returns null for invalid model names', () => {
            expect(getTierFromModel('Invalid GPU')).toBeNull();
        });

        it('returns null for empty string', () => {
            expect(getTierFromModel('')).toBeNull();
        });

        it('handles older 3-digit series like GTX 780', () => {
            expect(getTierFromModel('GTX 780')).toBe('80');
        });

        it('handles GTX 780 Ti correctly', () => {
            expect(getTierFromModel('GTX 780 Ti')).toBe('80 Ti');
        });
    });
});
