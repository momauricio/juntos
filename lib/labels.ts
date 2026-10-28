import type { ItemStatus, ItemType } from "@/lib/types";

// A ordem das chaves é a ordem na tela (chips, escolha de tipo): Programa primeiro.
export const TYPE_LABELS: Record<ItemType, string> = {
  activity: "Programa",
  restaurant: "Restaurante",
  food_idea: "Ideia de comida",
  tourist_spot: "Ponto turístico",
  movie: "Filme",
  city: "Cidade",
  stay: "Hospedagem",
  event: "Evento",
};

export const STATUS_LABELS: Record<ItemStatus | "all", string> = {
  all: "Todos",
  want: "Queremos",
  done: "Já fizemos",
};

export const TYPE_EMOJI: Record<ItemType, string> = {
  activity: "🧺",
  restaurant: "🍝",
  food_idea: "☕",
  tourist_spot: "🏖️",
  movie: "🎬",
  city: "🏙️",
  stay: "🏨",
  event: "🎟️",
};

// Rótulo curto dos chips de filtro do quadro (mockup 21).
export const TYPE_CHIP_LABELS: Record<ItemType, string> = {
  activity: "Programa",
  restaurant: "Restaurante",
  food_idea: "Comida",
  tourist_spot: "Passeio",
  movie: "Filme",
  city: "Cidade",
  stay: "Hospedagem",
  event: "Evento",
};

// Explica o tipo na escolha (wizard da demo, card de revisão, ItemForm).
export const TYPE_HINTS: Record<ItemType, string> = {
  activity: "Algo pra fazer juntos: trilha, aula, piquenique.",
  restaurant: "Onde comer bem juntos.",
  food_idea: "Um prato ou receita para tentar.",
  tourist_spot: "Lugar para visitar e explorar.",
  movie: "Filme, série ou sessão juntos.",
  city: "Uma cidade ou destino para sonhar.",
  stay: "Hotel, pousada ou cabana pra dormir fora.",
  event: "Show, festa, exposição: tem data marcada.",
};

// Classe da miniatura (.ph1–.ph7 em globals.css; os itens ainda não têm imagem).
// Hospedagem divide o gradiente com Cidade (os dois são de viagem).
export const TYPE_THUMB: Record<ItemType, string> = {
  activity: "ph5",
  restaurant: "ph3",
  food_idea: "ph1",
  tourist_spot: "ph2",
  movie: "ph6",
  city: "ph4",
  stay: "ph4",
  event: "ph7",
};

// Tipo que veio do banco e o app não conhece: não quebra nem mostra "undefined".
export const UNKNOWN_TYPE_LABEL = "Item";
export const UNKNOWN_TYPE_EMOJI = "📍";

export function typeLabel(type: string): string {
  return Object.hasOwn(TYPE_LABELS, type)
    ? TYPE_LABELS[type as ItemType]
    : UNKNOWN_TYPE_LABEL;
}

export function typeEmoji(type: string): string {
  return Object.hasOwn(TYPE_EMOJI, type)
    ? TYPE_EMOJI[type as ItemType]
    : UNKNOWN_TYPE_EMOJI;
}

export function typeHint(type: string): string {
  return Object.hasOwn(TYPE_HINTS, type) ? TYPE_HINTS[type as ItemType] : "";
}

export const NOTES_PLACEHOLDER =
  "Onde? Quando? Ex.: no ateliê do bairro, num sábado de manhã";

// Detalhe de um Programa sem notas.
export const ACTIVITY_NO_ADDRESS_COPY =
  "Programa não precisa de endereço: onde e quando, se quiserem, vão nas notas.";
