/**
 * GPU Tier Utility Functions
 * 
 * Extracts and identifies GPU tier information from model names.
 */

/**
 * Extracts GPU tier from model name (e.g., "RTX 4090" -> "90")
 * @param {string} modelName - Full GPU model name
 * @returns {string|null} Tier string like "90 Ti" or "80", or null if unrecognized
 */
export const getTierFromModel = (modelName) => {
    const name = modelName.toUpperCase();
    const numMatch = name.match(/(\d{2,4})/); // Match 2 to 4 digits often representing the tier part
    if (!numMatch) return null; // Cannot determine tier

    const numStr = numMatch[1];
    const tierNum = parseInt(numStr.slice(-2), 10); // Usually the last two digits

    let baseTier = null;
    if (tierNum >= 90) baseTier = "90";
    else if (tierNum >= 80) baseTier = "80";
    else if (tierNum >= 70) baseTier = "70";
    else if (tierNum >= 60) baseTier = "60";
    else if (tierNum >= 50) baseTier = "50";
    else if (tierNum >= 30) baseTier = "30";
    // Add more tiers if needed

    if (!baseTier) return null; // Unknown tier number

    // Check for modifiers like "Ti" (case-insensitive, space required)
    if (name.includes(" TI")) {
        return `${baseTier} Ti`;
    }
    // Add checks for "SUPER" if needed
    // else if (name.includes(" SUPER")) {
    //     return `${baseTier} Super`;
    // }
    return baseTier; // Non-Ti version
};
