import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { ItemStatus, ItemType } from "@/lib/types";

// Chips do quadro (mockup 21): "Tudo" + um chip por tipo, na ordem de TYPE_LABELS.
export type TypeChip = "all" | ItemType;

const ALL_TYPES = Object.keys(TYPE_LABELS) as ItemType[];

export const TYPE_CHIPS: TypeChip[] = ["all", ...ALL_TYPES];

export const ALL_CHIP_LABEL = "Tudo";

// Grupos dos chips antigos (Comer/Passeios/Viagens), só para links salvos.
const LEGACY_GROUPS: Record<string, ItemType[]> = {
  comer: ["restaurant", "food_idea"],
  passeios: ["tourist_spot", "event", "movie"],
  viagens: ["city"],
};

export type TypeParamFilter = {
  // Chip destacado; null = nenhum (grupo antigo, que não tem chip).
  chip: TypeChip | null;
  // Tipos a buscar; null = sem filtro de tipo.
  types: ItemType[] | null;
};

// ?type=<tipo>. Os grupos antigos (?type=comer|passeios|viagens) continuam
// filtrando pelos tipos do grupo, sem destacar chip: nenhum chip corresponde,
// e "Tudo" mentiria sobre a lista. Tocar em "Tudo" limpa o filtro.
export function parseTypeParam(
  value: string | string[] | undefined,
): TypeParamFilter {
  const param = Array.isArray(value) ? value[0] : value;

  if (param && ALL_TYPES.includes(param as ItemType)) {
    const type = param as ItemType;
    return { chip: type, types: [type] };
  }

  if (param && Object.hasOwn(LEGACY_GROUPS, param)) {
    return { chip: null, types: LEGACY_GROUPS[param] };
  }

  return { chip: "all", types: null };
}

export type StatusCounts = Record<ItemStatus, number>;

// Números das abas: contam os itens já filtrados por tipo, ignorando o status.
export function countByStatus(items: { status: ItemStatus }[]): StatusCounts {
  return {
    want: items.filter((item) => item.status === "want").length,
    done: items.filter((item) => item.status === "done").length,
  };
}

const TYPE_NOUNS: Record<ItemType, [singular: string, plural: string]> = {
  activity: ["programa", "programas"],
  restaurant: ["restaurante", "restaurantes"],
  food_idea: ["ideia de comida", "ideias de comida"],
  tourist_spot: ["ponto turístico", "pontos turísticos"],
  movie: ["filme", "filmes"],
  city: ["cidade", "cidades"],
  event: ["evento", "eventos"],
};

// Rodapé com filtro de tipo (mockup 21b): "3 programas em Queremos".
export function typeFilterSummary(
  type: ItemType,
  count: number,
  status: ItemStatus,
): string {
  const [singular, plural] = TYPE_NOUNS[type];
  return `${count} ${count === 1 ? singular : plural} em ${STATUS_LABELS[status]}`;
}
