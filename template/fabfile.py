
from fabric import task
lazy from invoke import Context


@task(aliases=["tauri"])
def dev(c: Context) -> None:
    """开发 (Hasgard)"""
    c.run("bun run dev:tauri")


@task
def build(c: Context) -> None:
    """构建"""
    c.run("bun run tauri build")


@task
def check(c: Context) -> None:
    """检查"""
    c.run("bun run verify:native")


@task(aliases=["u"])
def upgrade(c: Context) -> None:
    """升级"""
    c.run("bun outdated")
    c.run("bun update")
    # 模块插件按版本来自 crates.io，私有库随 npm 包更新
    with c.cd("src-tauri"):
        # --verbose 同时列出超出声明范围的新版本（Unchanged … (available: …)），跨大版本手动决定
        c.run("cargo update --verbose")
