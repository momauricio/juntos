export const COMMENT_MAX_LENGTH = 280;

export function assertScore(n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    throw new Error("Nota deve ser um inteiro de 1 a 10");
  }
}

export function restaurantAverage(
  food: number,
  service: number,
  ambiance: number,
): number {
  assertScore(food);
  assertScore(service);
  assertScore(ambiance);
  return Math.round(((food + service + ambiance) / 3) * 10) / 10;
}

export function displayRating(rating: {
  food: number | null;
  service: number | null;
  ambiance: number | null;
  score: number | null;
}): number | null {
  if (
    rating.food != null &&
    rating.service != null &&
    rating.ambiance != null
  ) {
    return restaurantAverage(rating.food, rating.service, rating.ambiance);
  }
  return rating.score;
}

type RatingValues = {
  food: number | null;
  service: number | null;
  ambiance: number | null;
  score: number | null;
};

export function personAverage(rating: RatingValues): number | null {
  if (
    rating.food != null &&
    rating.service != null &&
    rating.ambiance != null
  ) {
    return (rating.food + rating.service + rating.ambiance) / 3;
  }
  return rating.score;
}

// Arredonda só no fim: 9/8/9 (8,666…) e 9/7/8 (8,0) dão 8,3; arredondar as
// médias individuais antes (8,7 e 8,0) daria 8,4.
export function coupleScore(ratings: RatingValues[]): number | null {
  const averages = ratings
    .map(personAverage)
    .filter((value): value is number => value != null);

  if (averages.length === 0) {
    return null;
  }

  const sum = averages.reduce((total, value) => total + value, 0);
  return Math.round((sum / averages.length) * 10) / 10;
}

export function formatScore(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
