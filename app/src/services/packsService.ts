import type { Category, PackSku } from "@grailhaus/shared";
import { apiGet } from "./apiClient";

export const packsService = {
  list: (category?: Category): Promise<PackSku[]> =>
    apiGet<PackSku[]>(category ? `/packs?category=${category}` : "/packs"),
};
