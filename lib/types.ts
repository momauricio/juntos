export type ItemType =
  | "restaurant"
  | "food_idea"
  | "tourist_spot"
  | "movie"
  | "city";

export type ItemStatus = "want" | "done";

export type SpaceRole = "owner" | "member";

export type Item = {
  id: string;
  space_id: string;
  type: ItemType;
  title: string;
  url: string | null;
  notes: string | null;
  status: ItemStatus;
  created_by: string;
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
  created_at: string;
  updated_at: string;
};
