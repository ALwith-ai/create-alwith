import {vibemonLocales} from "@alwith/module-auth/vibemon/locales"
import { withChatResources } from "@alwith/module-chat/locales"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"

import app from "../alwith.app.json"

const resources = withChatResources({
  en: { translation: { platformAuth: { intro: "Sign in to your ALwith account", independent: "This app signs in on its own. Your ALwith account and entitlements stay the same; model provider sign-in is separate.", codeLogin: "Email code", passwordLogin: "Password", register: "Register", email: "Email", code: "Verification code", password: "Password", sendCode: "Send code", resend: "Resend in {{seconds}}s", signIn: "Sign in", failed: "Authentication failed. Please try again.", invalidEmail: "Enter a valid email address.", registered: "This email is already registered. Please sign in.", passwordRule: "8–26 characters, including a letter and a number; no spaces.", waitlisted: "Your account is on the waitlist.", disabled: "Your account is disabled." }, showDesktopVibemon: "Show desktop Vibemon", vibemon: "Vibemon", ready: "Ready", connecting: "Connecting…", copy: "Copy", signOut: "Sign out", chat: "Chat", newChat: "New chat", settings: "Settings", userGuide: "User guide", leadingNavigation: "Leading navigation", pinSidebar: "Pin sidebar", collapseSidebar: "Collapse sidebar", licensesTitle: "Licenses", licenses: "Bundles the OpenAI Codex CLI (Apache-2.0) and codex-acp-v2 (Apache-2.0). Not affiliated with OpenAI.", updates: { title: "Updates", version: "Version {{version}}", checking: "Checking for updates…", upToDate: "Up to date ({{version}})", downloading: "Downloading {{version}}…", available: "Version {{version}} is ready to install", installing: "Installing {{version}}…", check: "Check for updates", install: "Relaunch to update" }, untitled: "New conversation", leadingTitle: "Your workspace", leadingBody: "This screen is yours: describe the pages and business you want and your coding agent builds them here." } },
  "zh-CN": { translation: { platformAuth: { intro: "登录你的 ALwith 账号", independent: "本应用单独登录，同一 ALwith 账号的权益不变。模型供应商登录单独设置。", codeLogin: "验证码登录", passwordLogin: "密码登录", register: "注册", email: "邮箱", code: "验证码", password: "密码", sendCode: "发送验证码", resend: "{{seconds}} 秒后重发", signIn: "登录", failed: "认证失败，请重试。", invalidEmail: "请输入有效邮箱。", registered: "该邮箱已注册，请直接登录。", passwordRule: "8–26 位，包含字母和数字，不含空格。", waitlisted: "你的账号正在等待开通。", disabled: "你的账号已停用。" }, showDesktopVibemon: "显示桌面 Vibemon", vibemon: "Vibemon", ready: "就绪", connecting: "连接中…", copy: "复制", signOut: "退出登录", chat: "对话", newChat: "新对话", settings: "设置", userGuide: "用户指南", leadingNavigation: "左侧导航", pinSidebar: "固定侧边栏", collapseSidebar: "收起侧边栏", licensesTitle: "许可", licenses: "内置 OpenAI Codex CLI（Apache-2.0）与 codex-acp-v2（Apache-2.0）。与 OpenAI 无关联。", updates: { title: "更新", version: "版本 {{version}}", checking: "正在检查更新…", upToDate: "已是最新（{{version}}）", downloading: "正在下载 {{version}}…", available: "版本 {{version}} 已可安装", installing: "正在安装 {{version}}…", check: "检查更新", install: "重新启动以更新" }, untitled: "新对话", leadingTitle: "你的工作空间", leadingBody: "这一屏是你的：描述你想要的页面和业务，编程 Agent 会把它们做到这里。" } }
} as never)

for (const language of ["en", "zh-CN"] as const) Object.assign(resources[language], vibemonLocales[language])

const LANGUAGE_LABELS: Record<string, string> = { en: "English", "zh-CN": "简体中文" }
/** The languages this app ships (`alwith.app.json`), for the account menu. */
export const LANGUAGES = app.languages.map((code) => ({ code, label: LANGUAGE_LABELS[code] ?? code }))
const LANGUAGE_KEY = `${app.identifier}.language`

function storedLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_KEY)
  } catch {
    return null
  }
}

/** Switches the UI language and remembers it for the next launch. */
export async function changeLanguage(code: string): Promise<void> {
  await i18next.changeLanguage(code)
  localStorage.setItem(LANGUAGE_KEY, code)
}

void i18next.use(initReactI18next).init({
  resources: resources as never,
  lng: storedLanguage() ?? (navigator.language.startsWith("zh") ? "zh-CN" : "en"),
  fallbackLng: "en",
  interpolation: { escapeValue: false }
})

export default i18next
