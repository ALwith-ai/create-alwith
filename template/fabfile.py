"""Convenience commands for the generated desktop application."""

import os
import shutil
import subprocess
from pathlib import Path

from fabric import task

ROOT = Path(__file__).resolve().parent


def run(*command: str) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


@task(aliases=["tauri"])
def dev(_context) -> None:
    """Start the desktop application with the Hasgard debugging bridge."""
    os.chdir(ROOT)
    os.execvp("bun", ["bun", "run", "dev:tauri"])


@task
def build(_context) -> None:
    """Build the desktop application using Tauri's staging and frontend hooks."""
    run("bun", "run", "tauri", "build")


@task
def check(_context) -> None:
    """Check types, independence, frontend build and native compilation without starting a session."""
    run("bun", "run", "check")
    run("bun", "run", "check:independence")
    run("bun", "run", "build")
    run("bun", "run", "stage")
    run("cargo", "check", "--manifest-path", "src-tauri/Cargo.toml", "--locked", "--features", "hasgard-testing")


@task(aliases=["u"])
def upgrade(_context) -> None:
    """Update dependencies within declared ranges and report newer releases."""
    run("bun", "install", "--frozen-lockfile")
    run("bun", "outdated")
    run("bun", "update")
    # Published npm packages contain the Rust SDKs; update them before Cargo resolves paths.
    run("cargo", "update", "--manifest-path", "src-tauri/Cargo.toml")
    # Report newer direct dependencies without rewriting Cargo.toml or resolving a modified workspace.
    if shutil.which("cargo-upgrade") is None:
        run("cargo", "install", "cargo-edit", "--locked")
    run(
        "cargo", "upgrade", "--manifest-path", "src-tauri/Cargo.toml",
        "--dry-run", "--incompatible", "allow", "--pinned", "allow",
    )
