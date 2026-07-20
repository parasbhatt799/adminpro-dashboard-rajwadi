import banks from './camlenio_banks';

/**
 * Finds the correct Bank Profile ID for a given IFSC code.
 * It does a prefix match on the IFSC code.
 */
export function getBankProfileId(ifsc: string): string | null {
  if (!ifsc) return null;
  const upperIfsc = ifsc.toUpperCase();
  
  let bestMatch = '';
  let bestId: string | null = null;

  for (const [code, id] of Object.entries(banks)) {
    if (upperIfsc.startsWith(code.toUpperCase())) {
      if (code.length > bestMatch.length) {
        bestMatch = code;
        bestId = id;
      }
    }
  }

  return bestId;
}
