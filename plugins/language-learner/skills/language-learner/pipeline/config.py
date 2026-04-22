"""Config loader — read config.yaml and expose typed accessors.

Schema:
  target_language: thai | japanese | chinese | <iso code>
  translation_target: en | zh | ...
  ui_language: zh | en
  whisper:
    model_path: path to ggml model
    initial_prompt: proper nouns / domain terms
    gap_threshold_sec: float
    max_duration_sec: float
  vocab:
    min_freq: int
    max_freq: int
    stopwords: list[str]
  transcription:
    fillers: list[str]
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class WhisperConfig:
    model_path: str = "models/ggml-large-v3.bin"
    initial_prompt: str = ""
    gap_threshold_sec: float = 1.5
    max_duration_sec: float = 15.0


@dataclass
class VocabConfig:
    min_freq: int = 2
    max_freq: int = 30
    stopwords: list[str] = field(default_factory=list)


@dataclass
class TranscriptionConfig:
    fillers: list[str] = field(default_factory=list)


@dataclass
class Config:
    target_language: str = "thai"
    translation_target: str = "en"
    ui_language: str = "en"
    whisper: WhisperConfig = field(default_factory=WhisperConfig)
    vocab: VocabConfig = field(default_factory=VocabConfig)
    transcription: TranscriptionConfig = field(default_factory=TranscriptionConfig)

    def tokenizer_config(self) -> dict[str, Any]:
        """Subset passed into tokenizer factory."""
        return {"stopwords": self.vocab.stopwords}


def load_config(path: str | Path) -> Config:
    try:
        import yaml
    except ImportError as e:
        raise RuntimeError("pyyaml required — `pip install pyyaml`") from e

    data = yaml.safe_load(Path(path).read_text()) or {}
    w = data.get("whisper", {}) or {}
    v = data.get("vocab", {}) or {}
    t = data.get("transcription", {}) or {}

    return Config(
        target_language=data.get("target_language", "thai"),
        translation_target=data.get("translation_target", "en"),
        ui_language=data.get("ui_language", "en"),
        whisper=WhisperConfig(
            model_path=w.get("model_path", WhisperConfig.model_path),
            initial_prompt=w.get("initial_prompt", ""),
            gap_threshold_sec=float(w.get("gap_threshold_sec", 1.5)),
            max_duration_sec=float(w.get("max_duration_sec", 15.0)),
        ),
        vocab=VocabConfig(
            min_freq=int(v.get("min_freq", 2)),
            max_freq=int(v.get("max_freq", 30)),
            stopwords=list(v.get("stopwords") or []),
        ),
        transcription=TranscriptionConfig(
            fillers=list(t.get("fillers") or []),
        ),
    )
