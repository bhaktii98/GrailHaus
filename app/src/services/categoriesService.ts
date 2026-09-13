import type { CategoryReveal } from "@grailhaus/shared";
import { apiGet } from "./apiClient";

export const categoriesService = {
  list: (): Promise<CategoryReveal[]> => apiGet<CategoryReveal[]>("/categories"),
};
