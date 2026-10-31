"""Vercel Python entry point: serves the FastAPI app (UI, API and live evaluation)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import os  # noqa: E402
os.environ.setdefault("TORQUESTRIPE_DATA", str(ROOT / "data/faa/ad_nprm.xlsx"))

from torquestripe.api import app  # noqa: E402,F401
