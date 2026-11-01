export type ItemType =
  | "activity"
  | "restaurant"
  | "food_idea"
  | "tourist_spot"
  | "movie"
  | "city"
  | "stay"
  | "event";

export type ItemStatus = "want" | "done";

export type SpaceRole = "owner" | "member";

// Tokens da paleta P (classes .ph1–.ph8 em globals.css). O banco guarda o token, nunca o hex.
export type CategoryColor =
  | "ph1"
  | "ph2"
  | "ph3"
  | "ph4"
  | "ph5"
  | "ph6"
  | "ph7"
  | "ph8";

// Visualização dentro da categoria, por pessoa (profiles.item_view).
export type ItemView = "grid" | "compact";

export type Category = {
  id: string;
  space_id: string;
  name: string;
  // lower(unaccent(trim(name))) com espaços repetidos viram 1; preenchido pelo banco.
  name_key: string;
  emoji: string;
  color: CategoryColor;
  position: number;
  // Tipo que um item novo criado nessa categoria recebe (regras de nota).
  item_type: ItemType;
  // null nas categorias padrão semeadas.
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Item = {
  id: string;
  space_id: string;
  type: ItemType;
  category_id: string;
  title: string;
  url: string | null;
  notes: string | null;
  status: ItemStatus;
  created_by: string;
  updated_by?: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Rating = {
  id: string;
  item_id: string;
  rated_by: string;
  food: number | null;
  service: number | null;
  ambiance: number | null;
  score: number | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  display_name: string;
  // Quando a pessoa passou pela tela "Seu nome" (null = ainda não passou).
  onboarded_at: string | null;
  item_view?: ItemView;
  created_at: string;
};
