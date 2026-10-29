// Application wiring for the public auth client, transport and native refresh.
import {
  type AuthActions,
  type AuthState,
  type AuthStateEvent,
  authStoreName,
  createAuthClient,
  createAuthState,
  createTokenStorage,
  type LoginResponse
} from "@alwith/module-auth"
import { createTauriAuthRefresh } from "@alwith/module-auth/tauri"
import { invoke } from "@tauri-apps/api/core"
import { emit, listen } from "@tauri-apps/api/event"
import { fetch } from "@tauri-apps/plugin-http"
import { arch, platform } from "@tauri-apps/plugin-os"
import { create } from "zustand"

import { openStore } from "../store"
import { createAuthTransport } from "@alwith/module-auth/transport"
import { assertActiveLogin } from "@alwith/module-auth"

export const API_BASE_URL = import.meta.env.DEV ? "https://api-dev.alwith.ai/service" : "https://api.alwith.ai/service"
const STATE_EVENT = "alwith-auth-state"
const store = openStore(authStoreName(API_BASE_URL))
const storage = createTokenStorage({
  get: (key) => store.get(key),
  set: (key, value) => store.set(key, value),
  delete: (key) => store.delete(key)
})
const expiredListeners = new Set<() => void>()
const stateListeners = new Set<(event: AuthStateEvent) => void>()
const refreshTokens = createTauriAuthRefresh(invoke)
const transport = createAuthTransport({
  baseUrl: API_BASE_URL,
  fetch,
  storage,
  refresh: (refreshToken) => refreshTokens(API_BASE_URL, refreshToken),
  expired: async () => {
    for (const listener of expiredListeners) listener()
    await storage.clearAllAuth()
    await emit(STATE_EVENT, { action: "logout" } satisfies AuthStateEvent)
  }
})
export const authClient = createAuthClient({
  publicPost: (path, body) => transport.request(path, "POST", body, false),
  apiPost: (path, body) => transport.request(path, "POST", body),
  platform,
  arch,
  getDeviceId: storage.tokenStorage.getDeviceId,
  onLogoutError: () => console.warn("[auth] remote logout failed; clearing local login"),
  logInfo: () => {}
})
export const usePlatformAuth = create<AuthState & AuthActions>(
  createAuthState({
    storage,
    getProfile: () => transport.request("/api/v1/me/profile", "GET"),
    logoutApi: authClient.logoutApi,
    onInit: () => {},
    validateProfile: () => true,
    handleUnauthenticated: () => Promise.resolve(false),
    // ALwith login never alters Codex history, provider credentials or CLI login.
    loadProviders: () => {},
    clearProviders: () => {},
    onProfileRestored: () => {},
    clearAccountConversation: async () => {},
    onSignedIn: () => {},
    subscribeExpired: (listener) => expiredListeners.add(listener),
    subscribeState: (listener) => stateListeners.add(listener),
    broadcast: (event) => emit(STATE_EVENT, event)
  })
)

export async function loginPlatform(response: LoginResponse): Promise<void> {
  assertActiveLogin(response)
  await transport.invalidate()
  await usePlatformAuth.getState().login(response)
}

export async function logoutPlatform(): Promise<void> {
  await transport.invalidate()
  await usePlatformAuth.getState().logout()
}

/** Register the state listener before restoring credentials; called once at startup. */
export async function initPlatformAuth(): Promise<void> {
  await listen<AuthStateEvent>(STATE_EVENT, (event) => {
    for (const listener of stateListeners) listener(event.payload)
  })
  usePlatformAuth.getState().init()
}

export const platformApiRequest = <T>(path: string, method: "GET" | "POST", body?: unknown) => transport.request<T>(path, method, body)
