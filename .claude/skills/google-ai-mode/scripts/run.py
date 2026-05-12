#!/usr/bin/env python3
"""
Universal runner for NotebookLM skill scripts
Ensures all scripts run with the correct virtual environment
"""

import os
import sys
import subprocess
from pathlib import Path


def get_venv_python():
    """Get the virtual environment Python executable"""
    skill_dir = Path(__file__).parent.parent
    venv_dir = skill_dir / ".venv"

    if os.name == 'nt':  # Windows
        venv_python = venv_dir / "Scripts" / "python.exe"
    else:  # Unix/Linux/Mac
        venv_python = venv_dir / "bin" / "python"

    return venv_python


def venv_is_healthy(venv_python: Path) -> bool:
    """Verify venv interpreter actually runs (catches stale symlinks after Python upgrade)."""
    if not venv_python.exists():
        return False
    try:
        result = subprocess.run(
            [str(venv_python), "--version"],
            capture_output=True,
            timeout=10,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False


def ensure_venv():
    """Ensure virtual environment exists and is healthy."""
    import shutil

    skill_dir = Path(__file__).parent.parent
    venv_dir = skill_dir / ".venv"
    setup_script = skill_dir / "scripts" / "setup_environment.py"
    venv_python = get_venv_python()

    needs_setup = not venv_dir.exists()
    if not needs_setup and not venv_is_healthy(venv_python):
        print("⚠️  Existing .venv is broken (likely after a system Python upgrade).")
        print("   Rebuilding...")
        shutil.rmtree(venv_dir, ignore_errors=True)
        needs_setup = True

    if needs_setup:
        print("🔧 Setting up virtual environment...")
        result = subprocess.run([sys.executable, str(setup_script)])
        if result.returncode != 0:
            print("❌ Failed to set up environment")
            sys.exit(1)
        print("✅ Environment ready!")

    return get_venv_python()


def main():
    """Main runner"""
    if len(sys.argv) < 2:
        print("Usage: python run.py <script_name> [args...]")
        print("\nAvailable scripts:")
        print("  search.py - Query Google AI Mode for web research")
        print("\nExample:")
        print('  python run.py search.py --query "React hooks 2026" --save --debug')
        sys.exit(1)

    script_name = sys.argv[1]
    script_args = sys.argv[2:]

    # Handle both "scripts/script.py" and "script.py" formats
    if script_name.startswith('scripts/'):
        # Remove the scripts/ prefix if provided
        script_name = script_name[8:]  # len('scripts/') = 8

    # Ensure .py extension
    if not script_name.endswith('.py'):
        script_name += '.py'

    # Get script path
    skill_dir = Path(__file__).parent.parent
    script_path = skill_dir / "scripts" / script_name

    if not script_path.exists():
        print(f"❌ Script not found: {script_name}")
        print(f"   Working directory: {Path.cwd()}")
        print(f"   Skill directory: {skill_dir}")
        print(f"   Looked for: {script_path}")
        sys.exit(1)

    # Ensure venv exists and get Python executable
    venv_python = ensure_venv()

    # Build command
    cmd = [str(venv_python), str(script_path)] + script_args

    # Run the script
    try:
        result = subprocess.run(cmd)
        sys.exit(result.returncode)
    except KeyboardInterrupt:
        print("\n⚠️ Interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()