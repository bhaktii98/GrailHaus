import type { Profile } from "@grailhaus/shared";
import { apiGet } from "./apiClient";

export const profileService = {
  getCurrent: (): Promise<Profile> => apiGet<Profile>("/me"),
};
