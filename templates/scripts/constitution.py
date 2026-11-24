#!/usr/bin/env python3
"""Horror Engine v11.0: Single-Source-of-Truth Pipeline Constitution Loader.

Loads `pipeline_constitution.json` from `templates/` or a synced workspace root so every Python CLI
(`horror_story.py`, `gen_horror_voice.py`, `align_manifest.py`, `validate_manifest.py`,
`validate_continuity.py`, `extract_shots.py`, `short_qa.py`) enforces identical constants and enums.
"""

import json
import os
from functools import lru_cache

FALLBACK_CONSTITUTION = {
    "version": "11.0.0",
    "fps": 30,
    "speech": {
        "wordsPerSecondMin": 2.0,
        "wordsPerSecondTarget": 2.35,
        "wordsPerSecondMax": 2.75,
        "minVisualBreathingRatio": 0.20,
        "directives": ["[VISUAL Xs]", "[PAUSE Xs]", "[DEAD SILENCE Xs]"],
    },
    "partDurationSec": {
        "min": 45,
        "max": 105,
        "recommendedMin": 72,
        "recommendedMax": 95,
    },
    "captions": {
        "enabledByDefault": True,
        "minWords": 3,
        "maxWords": 8,
        "maxChars": 44,
        "maxLines": 2,
        "wallOfTextErrorWords": 12,
        "headerStyleDefault": "minimal",
    },
    "cameraGrammar": {
        "style": "anchored_pov_first",
        "requireMasterEstablishingPerLocation": True,
        "masterMinFrames": 60,
        "forbid180AxisFlip": True,
        "maxOtsRatio": 0.22,
        "maxPerspectiveSwitchesPerMinute": 4,
        "maxShotSyncDriftFrames": 4,
        "validCameraModes": ["master", "pov", "pov_turn", "pov_walk", "pov_interact", "ots_same_side"],
        "validAxisSides": ["pov_center", "left", "right"],
    },
}


def resolve_constitution_path() -> str | None:
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.abspath(os.path.join(here, "..", "pipeline_constitution.json")),
        os.path.abspath(os.path.join(here, "..", "..", "..", "templates", "pipeline_constitution.json")),
        os.path.abspath(os.path.join(os.getcwd(), "pipeline_constitution.json")),
        os.path.abspath(os.path.join(os.getcwd(), "templates", "pipeline_constitution.json")),
    ]
    for cand in candidates:
        if os.path.isfile(cand):
            return cand
    return None


@lru_cache(maxsize=1)
def load_constitution() -> dict:
    p = resolve_constitution_path()
    if p:
        with open(p, encoding="utf-8") as fp:
            return json.load(fp)
    return json.loads(json.dumps(FALLBACK_CONSTITUTION))
