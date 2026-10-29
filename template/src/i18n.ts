import {vibemonLocales} from "@alwith/module-auth/pets/locales"
import { withChatResources } from "@alwith/module-chat/locales"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"

const resources = withChatResources({
  en: { translation: { platformAuth: { intro: "Sign in to your ALwith account", independent: "This app signs in on its own. Your ALwith account and entitlements stay the same; model provider sign-in is separate.", codeLogin: "Email code", passwordLogin: "Password", register: "Register", email: "Email", code: "Verification code", password: "Password", sendCode: "Send code", resend: "Resend in {{seconds}}s", signIn: "Sign in", failed: "Authentication failed. Please try again.", invalidEmail: "Enter a valid email address.", registered: "This email is already registered. Please sign in.", passwordRule: "8–26 characters, including a letter and a number; no spaces.", waitlisted: "Your account is on the waitlist.", disabled: "Your account is disabled." }, pets: "Pets", ready: "Ready", connecting: "Connecting…", copy: "Copy", signOut: "Sign out", newChat: "New chat", settings: "Settings", updates: { title: "Updates", version: "Version {{version}}", checking: "Checking for updates…", upToDate: "Up to date ({{version}})", available: "Version {{version}} is available", installing: "Downloading and installing {{version}}…", check: "Check for updates", install: "Download and restart" }, untitled: "New conversation", leadingTitle: "Your workspace", leadingBody: "This screen is yours: describe the pages and business you want and your coding agent builds them here." } },
  "zh-CN": { translation: { platformAuth: { intro: "登录你的 ALwith 账号", independent: "本应用单独登录，同一 ALwith 账号的权益不变。模型供应商登录单独设置。", codeLogin: "验证码登录", passwordLogin: "密码登录", register: "注册", email: "邮箱", code: "验证码", password: "密码", sendCode: "发送验证码", resend: "{{seconds}} 秒后重发", signIn: "登录", failed: "认证失败，请重试。", invalidEmail: "请输入有效邮箱。", registered: "该邮箱已注册，请直接登录。", passwordRule: "8–26 位，包含字母和数字，不含空格。", waitlisted: "你的账号正在等待开通。", disabled: "你的账号已停用。" }, pets: "宠物", ready: "就绪", connecting: "连接中…", copy: "复制", signOut: "退出登录", newChat: "新对话", settings: "设置", updates: { title: "更新", version: "版本 {{version}}", checking: "正在检查更新…", upToDate: "已是最新（{{version}}）", available: "发现新版本 {{version}}", installing: "正在下载并安装 {{version}}…", check: "检查更新", install: "下载并重启" }, untitled: "新对话", leadingTitle: "你的工作空间", leadingBody: "这一屏是你的：描述你想要的页面和业务，编程 Agent 会把它们做到这里。" } }
} as never)

for (const language of ["en", "zh-CN"] as const) Object.assign(resources[language], vibemonLocales[language])

void i18next.use(initReactI18next).init({
  resources: resources as never,
  lng: navigator.language.startsWith("zh") ? "zh-CN" : "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }
})

export default i18next
