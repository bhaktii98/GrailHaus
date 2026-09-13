import type { Category, ItemDetail } from "@grailhaus/shared";
import { apiGet } from "./apiClient";

export const itemsService = {
  get: (id: string): Promise<ItemDetail> => apiGet<ItemDetail>(`/items/${id}`),
  list: (category?: Category): Promise<ItemDetail[]> =>
    apiGet<ItemDetail[]>(category ? `/items?category=${category}` : "/items"),
};
