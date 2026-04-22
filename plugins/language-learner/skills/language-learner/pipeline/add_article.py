#!/usr/bin/env python3
"""Generic language-learning content pipeline.

Driven entirely by config.yaml + a language tokenizer adapter.

Usage:
  python3 pipeline/add_article.py --config config.yaml --url <YouTube URL>
  python3 pipeline/add_article.py --config config.yaml --audio file.mp3 --title "…"
  python3 pipeline/add_article.py --config config.yaml --text file.txt --title "…"
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
import warnings
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# Allow running as script
_HERE = Path(__file__).resolve().parent
if str(_HERE.parent) not in sys.path:
    sys.path.insert(0, str(_HERE.parent))

from pipeline.config import Config, load_config  # noqa: E402
from pipeline.tokenizers import get_tokenizer  # noqa: E402

SRT_RE = re.compile(
    r"(\d+)\n(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})\n((?:.+\n?)+)",
    re.MULTILINE,
)


# ---------------------------------------------------------------------------
# Runtime context
# ---------------------------------------------------------------------------

class Ctx:
    def __init__(self, project_root: Path, cfg: Config):
        self.root = project_root
        self.cfg = cfg
        self.data = project_root / "data"
        self.site_audio = project_root / "audio-local"
        self.raw_audio = project_root / "raw-audio"
        self.transcripts = project_root / "transcripts"
        self.tokenizer = get_tokenizer(cfg.target_language, cfg.tokenizer_config())
        self.text_key = "text"  # field name on sentence/vocab objects
        self.fillers = set(cfg.transcription.fillers)
        self.lang_iso = _iso_code(cfg.target_language)
        self.translator_source = _translator_code(cfg.target_language)
        self.translator_target = _translator_code(cfg.translation_target)


def _iso_code(name: str) -> str:
    """Short code used by Whisper."""
    key = (name or "").lower()
    return {
        "thai": "th", "th": "th",
        "japanese": "ja", "ja": "ja", "jp": "ja",
        "chinese": "zh", "zh": "zh", "zh-cn": "zh", "zh-tw": "zh",
        "korean": "ko", "ko": "ko",
    }.get(key, key)


def _translator_code(name: str) -> str:
    """Code accepted by deep-translator's GoogleTranslator (e.g. zh-CN, not zh)."""
    key = (name or "").lower()
    return {
        "thai": "th", "th": "th",
        "japanese": "ja", "ja": "ja", "jp": "ja",
        "chinese": "zh-CN", "zh": "zh-CN", "zh-cn": "zh-CN",
        "zh-tw": "zh-TW", "traditional-chinese": "zh-TW",
        "korean": "ko", "ko": "ko",
        "english": "en", "en": "en",
    }.get(key, key)


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def slugify(s: str, max_len: int = 24) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.strip()).strip("-")
    return s[:max_len].lower() or "article"


def unique_id(seed: str) -> str:
    h = hashlib.md5(seed.encode()).hexdigest()[:8]
    return f"{slugify(seed)}-{h}"


def youtube_id(url: str) -> str | None:
    p = urlparse(url)
    if p.hostname == "youtu.be":
        return p.path.lstrip("/")
    return parse_qs(p.query).get("v", [None])[0]


def audio_duration(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(r.stdout.strip())


def to_16k_wav(src: Path, dst: Path):
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
         "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(dst)],
        check=True,
    )


# ---------------------------------------------------------------------------
# Whisper
# ---------------------------------------------------------------------------

def parse_srt(path: Path):
    text = path.read_bytes().decode("utf-8", errors="ignore")
    out = []
    for m in SRT_RE.finditer(text):
        idx = int(m.group(1))
        start = int(m.group(2)) * 3600 + int(m.group(3)) * 60 + int(m.group(4)) + int(m.group(5)) / 1000
        end = int(m.group(6)) * 3600 + int(m.group(7)) * 60 + int(m.group(8)) + int(m.group(9)) / 1000
        body = m.group(10).strip()
        if not body or (body.startswith("[") and body.endswith("]")):
            continue
        out.append({"idx": idx, "start": start, "end": end, "text": body})
    return out


def transcribe(ctx: Ctx, wav: Path, article_id: str, translate: bool) -> Path:
    suffix = "translate" if translate else ctx.lang_iso
    base = ctx.transcripts / f"{article_id}_{suffix}"
    srt = base.with_suffix(".srt")
    if srt.exists():
        return srt
    ctx.transcripts.mkdir(parents=True, exist_ok=True)
    cmd = [
        "whisper-cli", "-m", ctx.cfg.whisper.model_path, "-f", str(wav),
        "-l", ctx.lang_iso, "-otxt", "-osrt", "-of", str(base),
        "--suppress-nst", "-mc", "0",
    ]
    if ctx.cfg.whisper.initial_prompt:
        cmd.extend(["--prompt", ctx.cfg.whisper.initial_prompt])
    if translate:
        cmd.append("-tr")
    print(f"  ↳ transcribing ({suffix}) — may take a while…")
    subprocess.run(cmd, check=True)
    return srt


# ---------------------------------------------------------------------------
# Sentence merging
# ---------------------------------------------------------------------------

def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("-", "").strip()).strip()


def _is_filler(ctx: Ctx, text: str) -> bool:
    n = _normalize(text)
    return n in ctx.fillers or len(n) < 4


def merge_blocks(ctx: Ctx, blocks):
    cleaned = [b for b in blocks if not _is_filler(ctx, b["text"])]
    groups, current, prev_end = [], [], -100.0
    for b in cleaned:
        if not current:
            current = [b]; prev_end = b["end"]; continue
        gap = b["start"] - prev_end
        duration = b["end"] - current[0]["start"]
        if (b["text"].lstrip().startswith("-")
                or gap > ctx.cfg.whisper.gap_threshold_sec
                or duration > ctx.cfg.whisper.max_duration_sec):
            groups.append(current); current = [b]
        else:
            current.append(b)
        prev_end = b["end"]
    if current:
        groups.append(current)
    out = []
    for i, grp in enumerate(groups, start=1):
        text = re.sub(r"\s+", " ", " ".join(x["text"].strip() for x in grp)).strip()
        out.append({"idx": i, "start": round(grp[0]["start"], 2),
                    "end": round(grp[-1]["end"], 2), "text": text})
    return out


def align_translation(target_blocks, trans_blocks):
    for m in target_blocks:
        overlap = [b for b in trans_blocks if b["end"] > m["start"] and b["start"] < m["end"]]
        m["translation"] = re.sub(r"\s+", " ", " ".join(b["text"].strip() for b in overlap)).strip()
    return target_blocks


# ---------------------------------------------------------------------------
# Audio slicing
# ---------------------------------------------------------------------------

def slice_audio(ctx: Ctx, wav: Path, article_id: str, sentences):
    out_dir = ctx.site_audio / article_id
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"  ↳ slicing {len(sentences)} clips…")
    for s in sentences:
        idx = int(s["id"].rsplit("_", 1)[1])
        out_file = out_dir / f"{idx:04d}.mp3"
        start = max(0, s["start"] - 0.1)
        dur = (s["end"] - s["start"]) + 0.2
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
             "-ss", f"{start:.2f}", "-t", f"{dur:.2f}",
             "-c:a", "libmp3lame", "-b:a", "64k", str(out_file)],
            check=True,
        )


# ---------------------------------------------------------------------------
# Vocab annotation + expansion
# ---------------------------------------------------------------------------

def annotate_sentences(ctx: Ctx, sentences):
    vocab_file = ctx.data / "vocab.json"
    if not vocab_file.exists():
        return
    vocab = json.loads(vocab_file.read_text())
    for v in vocab:
        v.setdefault("frequency", 0)
    for s in sentences:
        anns = []
        for v in vocab:
            needle = v.get(ctx.text_key) or ""
            if not needle:
                continue
            start = 0
            text = s.get(ctx.text_key, "")
            while True:
                i = text.find(needle, start)
                if i == -1:
                    break
                anns.append({"start": i, "end": i + len(needle), "vocab_id": v["id"]})
                v["frequency"] += 1
                start = i + 1
        anns.sort(key=lambda x: (x["start"], -(x["end"] - x["start"])))
        merged, last_end = [], -1
        for a in anns:
            if a["start"] >= last_end:
                merged.append(a); last_end = a["end"]
        s["annotations"] = merged
    vocab.sort(key=lambda v: -v.get("frequency", 0))
    vocab_file.write_text(json.dumps(vocab, ensure_ascii=False, indent=2))


def expand_vocab(ctx: Ctx, article_id: str):
    sentences_file = ctx.data / "sentences.json"
    vocab_file = ctx.data / "vocab.json"
    sents = json.loads(sentences_file.read_text())
    vocab = json.loads(vocab_file.read_text()) if vocab_file.exists() else []
    existing = {v.get(ctx.text_key) for v in vocab}

    counter: Counter[str] = Counter()
    for s in sents:
        if s.get("article_id") != article_id:
            continue
        for t in ctx.tokenizer.extract_candidates(s.get(ctx.text_key, "")):
            counter[t] += 1

    lo, hi = ctx.cfg.vocab.min_freq, ctx.cfg.vocab.max_freq
    new_words = [(w, f) for w, f in counter.most_common()
                 if lo <= f <= hi and w not in existing]
    if not new_words:
        print("  ↳ no new vocab to add")
        return

    translations = _batch_translate(ctx, [w for w, _ in new_words])

    for word, freq in new_words:
        vocab.append({
            "id": ctx.tokenizer.vocab_id(word),
            ctx.text_key: word,
            "romanization": "",
            "translation": translations.get(word, ""),
            "part_of_speech": "",
            "frequency": freq,
            "tags": [],
        })

    # Re-annotate all sentences
    for v in vocab:
        v["frequency"] = 0
    for s in sents:
        anns = []
        for v in vocab:
            needle = v.get(ctx.text_key) or ""
            if not needle:
                continue
            start = 0
            text = s.get(ctx.text_key, "")
            while True:
                i = text.find(needle, start)
                if i == -1:
                    break
                anns.append({"start": i, "end": i + len(needle), "vocab_id": v["id"]})
                v["frequency"] += 1
                start = i + 1
        anns.sort(key=lambda x: (x["start"], -(x["end"] - x["start"])))
        merged, last_end = [], -1
        for a in anns:
            if a["start"] >= last_end:
                merged.append(a); last_end = a["end"]
        s["annotations"] = merged

    vocab.sort(key=lambda v: -v.get("frequency", 0))
    vocab_file.write_text(json.dumps(vocab, ensure_ascii=False, indent=2))
    sentences_file.write_text(json.dumps(sents, ensure_ascii=False, indent=2))
    print(f"  ↳ vocab: +{len(new_words)} words (total {len(vocab)})")


def _batch_translate(ctx: Ctx, items: list[str]) -> dict[str, str]:
    if not items:
        return {}
    try:
        warnings.filterwarnings("ignore")
        from deep_translator import GoogleTranslator
    except ImportError:
        print("  ↳ deep-translator not installed; skipping translation")
        return {}
    tr = GoogleTranslator(source=ctx.translator_source, target=ctx.translator_target)
    out: dict[str, str] = {}
    print(f"  ↳ translating {len(items)} items…")
    batch = 20
    for i in range(0, len(items), batch):
        chunk = items[i:i + batch]
        try:
            joined = "\n".join(chunk)
            result = tr.translate(joined)
            parts = (result or "").split("\n")
            for j, word in enumerate(chunk):
                if j < len(parts) and parts[j].strip():
                    out[word] = parts[j].strip()
        except Exception as e:
            print(f"    ! batch {i}: {e}")
        time.sleep(0.3)
    return out


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def save_article(ctx: Ctx, article, sentences):
    articles_file = ctx.data / "articles.json"
    sentences_file = ctx.data / "sentences.json"
    articles = json.loads(articles_file.read_text()) if articles_file.exists() else []
    all_sents = json.loads(sentences_file.read_text()) if sentences_file.exists() else []
    articles = [a for a in articles if a["id"] != article["id"]]
    all_sents = [s for s in all_sents if s.get("article_id") != article["id"]]
    articles.append(article)
    all_sents.extend(sentences)
    articles_file.write_text(json.dumps(articles, ensure_ascii=False, indent=2))
    sentences_file.write_text(json.dumps(all_sents, ensure_ascii=False, indent=2))


# ---------------------------------------------------------------------------
# Top-level input processors
# ---------------------------------------------------------------------------

def process_from_audio(ctx: Ctx, wav: Path, article_id: str, title: str,
                       source_url: str, atype: str):
    target_srt = transcribe(ctx, wav, article_id, translate=False)
    trans_srt = transcribe(ctx, wav, article_id, translate=True)
    target_blocks = parse_srt(target_srt)
    trans_blocks = parse_srt(trans_srt)
    merged = align_translation(merge_blocks(ctx, target_blocks), trans_blocks)
    if not merged:
        print("⚠️  No content parsed"); sys.exit(1)

    sentences = []
    for m in merged:
        sid = f"{article_id}_{m['idx']:04d}"
        sentences.append({
            "id": sid,
            "article_id": article_id,
            "start": m["start"],
            "end": m["end"],
            ctx.text_key: m["text"],
            "translation": m.get("translation", ""),
            "romanization": "",
            "vocab_ids": [],
            "annotations": [],
            "is_highlight": False,
            "audio_url": f"audio-local/{article_id}/{m['idx']:04d}.mp3",
        })

    slice_audio(ctx, wav, article_id, sentences)
    annotate_sentences(ctx, sentences)

    duration = audio_duration(wav)
    article = {
        "id": article_id,
        "title": title,
        "type": atype,
        "source_url": source_url,
        "duration_sec": duration,
        "duration_str": f"{int(duration // 60)}:{int(duration % 60):02d}",
        "sentence_count": len(sentences),
        "status": "studying",
        "favorite": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    save_article(ctx, article, sentences)
    print(f"✅ Added article: {article_id} — {len(sentences)} sentences")

    for p in [wav, wav.with_suffix(".mp3")]:
        if p.exists():
            p.unlink()
            print(f"  ↳ deleted {p.name}")

    expand_vocab(ctx, article_id)


def process_youtube(ctx: Ctx, url: str, title: str | None):
    vid = youtube_id(url)
    if not vid:
        print("Could not parse YouTube URL"); sys.exit(1)
    article_id = vid
    ctx.raw_audio.mkdir(parents=True, exist_ok=True)
    wav = ctx.raw_audio / f"{article_id}.wav"
    mp3 = ctx.raw_audio / f"{article_id}.mp3"
    if not wav.exists():
        if not mp3.exists():
            print("  ↳ downloading audio…")
            subprocess.run([
                "yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "0",
                "-o", str(ctx.raw_audio / "%(id)s.%(ext)s"), url,
            ], check=True)
        print("  ↳ converting to 16kHz wav…")
        to_16k_wav(mp3, wav)
    if not title:
        r = subprocess.run(["yt-dlp", "--get-title", url],
                           capture_output=True, text=True, check=True)
        title = r.stdout.strip().splitlines()[-1]
    process_from_audio(ctx, wav, article_id, title, url, "youtube")


def process_audio_file(ctx: Ctx, path: Path, title: str):
    src = path.resolve()
    if not src.exists():
        print(f"File not found: {src}"); sys.exit(1)
    article_id = unique_id(title or src.stem)
    ctx.raw_audio.mkdir(parents=True, exist_ok=True)
    wav = ctx.raw_audio / f"{article_id}.wav"
    if not wav.exists():
        print("  ↳ converting to 16kHz wav…")
        to_16k_wav(src, wav)
    process_from_audio(ctx, wav, article_id, title, f"file://{src}", "audio")


def process_text_file(ctx: Ctx, path: Path, title: str):
    src = path.resolve()
    if not src.exists():
        print(f"File not found: {src}"); sys.exit(1)
    article_id = unique_id(title or src.stem)
    text = src.read_text(encoding="utf-8").strip()
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n|(?<=[\.\?\!。])\s+", text) if p.strip()]

    translations = _batch_sentences(ctx, paragraphs)

    sentences = []
    for i, p in enumerate(paragraphs, start=1):
        sid = f"{article_id}_{i:04d}"
        sentences.append({
            "id": sid,
            "article_id": article_id,
            "start": 0,
            "end": 0,
            ctx.text_key: p,
            "translation": translations.get(p, ""),
            "romanization": "",
            "vocab_ids": [],
            "annotations": [],
            "is_highlight": False,
            "audio_url": "",
        })
    annotate_sentences(ctx, sentences)

    article = {
        "id": article_id,
        "title": title,
        "type": "text",
        "source_url": f"file://{src}",
        "duration_sec": 0,
        "duration_str": "",
        "sentence_count": len(sentences),
        "status": "studying",
        "favorite": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    save_article(ctx, article, sentences)
    print(f"✅ Added text article: {article_id} — {len(sentences)} paragraphs")
    expand_vocab(ctx, article_id)


def _batch_sentences(ctx: Ctx, texts: list[str]) -> dict[str, str]:
    if not texts:
        return {}
    try:
        warnings.filterwarnings("ignore")
        from deep_translator import GoogleTranslator
    except ImportError:
        print("  ↳ deep-translator not installed; sentences untranslated")
        return {}
    tr = GoogleTranslator(source=ctx.translator_source, target=ctx.translator_target)
    out: dict[str, str] = {}
    print(f"  ↳ translating {len(texts)} sentences…")
    for t in texts:
        try:
            r = tr.translate(t)
            if r:
                out[t] = r.strip()
        except Exception as e:
            print(f"    ! {e}")
        time.sleep(0.25)
    return out


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="config.yaml", help="Path to config.yaml")
    ap.add_argument("--project-root", default=".", help="Project directory (where data/ lives)")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--url", help="YouTube URL")
    g.add_argument("--audio", help="Local audio file path")
    g.add_argument("--text", help="Plain text file path")
    ap.add_argument("--title", help="Article title (required for --audio / --text)")
    args = ap.parse_args()

    cfg = load_config(args.config)
    ctx = Ctx(Path(args.project_root).resolve(), cfg)
    ctx.data.mkdir(parents=True, exist_ok=True)

    if args.url:
        process_youtube(ctx, args.url, args.title)
    elif args.audio:
        if not args.title:
            print("--title required for --audio"); sys.exit(1)
        process_audio_file(ctx, Path(args.audio), args.title)
    elif args.text:
        if not args.title:
            print("--title required for --text"); sys.exit(1)
        process_text_file(ctx, Path(args.text), args.title)


if __name__ == "__main__":
    main()
