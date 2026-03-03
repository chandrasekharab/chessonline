/**
 * ELO Rating Service
 * Uses standard ELO with K-factor based on rating range.
 */

export type EloResult = 'white' | 'black' | 'draw';

function kFactor(rating: number): number {
  if (rating < 1200) return 40;
  if (rating < 1800) return 30;
  if (rating < 2200) return 20;
  return 16;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export interface EloChange {
  whiteChange: number;
  blackChange: number;
  newWhiteRating: number;
  newBlackRating: number;
}

export function calculateElo(
  whiteRating: number,
  blackRating: number,
  result: EloResult
): EloChange {
  const kW = kFactor(whiteRating);
  const kB = kFactor(blackRating);

  const eW = expectedScore(whiteRating, blackRating);
  const eB = expectedScore(blackRating, whiteRating);

  let sW: number;
  let sB: number;

  if (result === 'white') {
    sW = 1;
    sB = 0;
  } else if (result === 'black') {
    sW = 0;
    sB = 1;
  } else {
    sW = 0.5;
    sB = 0.5;
  }

  const whiteChange = Math.round(kW * (sW - eW));
  const blackChange = Math.round(kB * (sB - eB));

  return {
    whiteChange,
    blackChange,
    newWhiteRating: Math.max(100, whiteRating + whiteChange),
    newBlackRating: Math.max(100, blackRating + blackChange),
  };
}
