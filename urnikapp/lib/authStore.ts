import * as SecureStore from "expo-secure-store";
import type { PublicUser } from "./authlib";

const KEY = "current_user_v1";

export async function saveUser(user: PublicUser) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(user));
}

export async function loadUser(): Promise<PublicUser | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as PublicUser) : null;
}

export async function clearUser() {
  await SecureStore.deleteItemAsync(KEY);
}
