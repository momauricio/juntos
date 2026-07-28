export function assertScore(n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error("Nota deve ser um inteiro de 1 a 5");
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
