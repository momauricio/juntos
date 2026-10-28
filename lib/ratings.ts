export const COMMENT_MAX_LENGTH = 280;

export const SCORE_ERROR = "Nota deve ser de 1 a 10, com até 1 casa (ex.: 8,2)";

// Para o atributo pattern do campo de nota: 1 a 9 com até 1 casa, ou 10 / 10,0.
export const SCORE_PATTERN = "10([.,]0)?|[1-9]([.,][0-9])?";
const SCORE_RE = new RegExp(`^(?:${SCORE_PATTERN})$`);

// Notas em décimos inteiros (8,2 → 82), para as contas não pegarem erro de float.
function tenths(n: number): number {
  return Math.round(n * 10);
}

export function assertScore(n: number): void {
  if (
    !Number.isFinite(n) ||
    n < 1 ||
    n > 10 ||
    Math.abs(n * 10 - tenths(n)) > 1e-9
  ) {
    throw new Error(SCORE_ERROR);
  }
}

// Texto digitado ("8,2", "8.2", "8") → número; vírgula vira ponto.
export function parseScore(text: string): number {
  const trimmed = text.trim();
  if (!SCORE_RE.test(trimmed)) {
    throw new Error(SCORE_ERROR);
  }
  const value = Number(trimmed.replace(",", "."));
  assertScore(value);
  return value;
}

// Valor do campo de nota: 8 → "8,0", sem nota → "".
export function scoreInputValue(value: number | null | undefined): string {
  return value == null ? "" : formatScore(value);
}

export function restaurantAverage(
  food: number,
  service: number,
  ambiance: number,
): number {
  assertScore(food);
  assertScore(service);
  assertScore(ambiance);
  return Math.round((tenths(food) + tenths(service) + tenths(ambiance)) / 3) / 10;
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

  // Soma em terços de décimo (inteiros) para o meio (8,25) arredondar sempre para cima.
  const sum = averages.reduce(
    (total, value) => total + Math.round(value * 30),
    0,
  );
  return Math.round(sum / (3 * averages.length)) / 10;
}

export function formatScore(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
