import filecmp
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
import numpy as np

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEMPLATES_SCRIPTS = os.path.join(REPO_ROOT, "templates", "scripts")
if TEMPLATES_SCRIPTS not in sys.path:
    sys.path.insert(0, TEMPLATES_SCRIPTS)

import align_manifest  # noqa: E402
import constitution  # noqa: E402
import gen_horror_voice  # noqa: E402
import horror_story  # noqa: E402
import validate_continuity  # noqa: E402
import validate_manifest  # noqa: E402


class TestV11CrossSkillConsistency(unittest.TestCase):
    def test_constitution_matches_code_and_skills(self):
        const = constitution.load_constitution()
        self.assertEqual(const["version"], "11.0.0")
        self.assertEqual(const["fps"], 30)

        # 1. Python validators & horror_story.py share identical enums & bounds
        self.assertEqual(set(const["enums"]["validLights"]), validate_manifest.VALID_LIGHTS)
        self.assertEqual(set(const["enums"]["validPoses"]), validate_manifest.VALID_POSES)
        self.assertEqual(set(const["enums"]["validPoses"]), horror_story.VALID_ENGINE_POSES)
        self.assertEqual(validate_continuity.PART_DUR_MIN, const["partDurationSec"]["min"])
        self.assertEqual(validate_continuity.PART_DUR_MAX, const["partDurationSec"]["max"])

        # 2. lights.ts fogNear/fogFar & fog hex match pipeline_constitution.json
        with open(os.path.join(REPO_ROOT, "templates", "engine", "lights.ts"), encoding="utf-8") as fp:
            lights_ts = fp.read()
        for preset, spec in const["lightPresets"].items():
            self.assertIn(f'fog: "{spec["fog"]}"', lights_ts, f"lights.ts fog hex drift on {preset}")
            self.assertIn(f"fogNear: {spec['fogNear']}", lights_ts, f"lights.ts fogNear drift on {preset}")

        # 3. Byte-identical mirrors: horror_story.py & 4 reference pairs
        mirror_hs = os.path.join(REPO_ROOT, "companion-skills", "horror-story", "scripts", "horror_story.py")
        src_hs = os.path.join(REPO_ROOT, "templates", "scripts", "horror_story.py")
        self.assertTrue(filecmp.cmp(src_hs, mirror_hs, shallow=False), "horror_story.py mirror is out of sync!")

        ref_pairs = [
            ("references/HORROR_FORMULAS.md", "companion-skills/horror-script-storyboard/references/HORROR_FORMULAS.md"),
            ("references/LIGHTING_AND_PALETTE.md", "companion-skills/horror-world-lookdev/references/LIGHTING_AND_PALETTE.md"),
            ("references/SERIES_ARCHITECTURE.md", "companion-skills/horror-series-pipeline/references/SERIES_ARCHITECTURE.md"),
            ("references/SOUND_CUES_COOKBOOK.md", "companion-skills/horror-audio-sfx/references/SOUND_CUES_COOKBOOK.md"),
        ]
        for root_rel, comp_rel in ref_pairs:
            p_a = os.path.join(REPO_ROOT, root_rel)
            p_b = os.path.join(REPO_ROOT, comp_rel)
            self.assertTrue(filecmp.cmp(p_a, p_b, shallow=False), f"Reference drift between {root_rel} and {comp_rel}")

        # 4. Zero contradictory rules across all 6 SKILL.md files
        skill_files = [
            os.path.join(REPO_ROOT, "SKILL.md"),
            os.path.join(REPO_ROOT, "companion-skills", "horror-story", "SKILL.md"),
            os.path.join(REPO_ROOT, "companion-skills", "horror-script-storyboard", "SKILL.md"),
            os.path.join(REPO_ROOT, "companion-skills", "horror-world-lookdev", "SKILL.md"),
            os.path.join(REPO_ROOT, "companion-skills", "horror-audio-sfx", "SKILL.md"),
            os.path.join(REPO_ROOT, "companion-skills", "horror-series-pipeline", "SKILL.md"),
        ]
        for sf in skill_files:
            with open(sf, encoding="utf-8") as fp:
                body = fp.read()
            self.assertNotIn("No On-Screen Captions by Default", body, f"Stale caption contradiction in {sf}")
            self.assertNotIn("2.7–3.2 words/s", body, f"Stale speech rate in {sf}")

    def test_acoustic_island_aligner_eliminates_pause_drift_and_visual_directive(self):
        sr = 24000
        # Synthesize 2 voiced bursts [0.05..0.95s] and [1.95..2.85s] separated by a HUGE 1.00s real silence [0.95..1.95s]!
        t1 = np.linspace(0, 0.90, int(0.90 * sr), endpoint=False)
        t2 = np.linspace(0, 0.90, int(0.90 * sr), endpoint=False)
        burst1 = 0.25 * np.sin(2 * np.pi * 160 * t1)
        burst2 = 0.25 * np.sin(2 * np.pi * 175 * t2)
        wav = np.concatenate([
            np.zeros(int(0.05 * sr)),
            burst1,
            np.zeros(int(1.00 * sr)),  # 1.00s silent breath/clause pause!
            burst2,
            np.zeros(int(0.10 * sr)),
        ])
        text = "Đêm mưa lạnh buốt, cửa phà đã đóng chặt."
        words, mode = gen_horror_voice.align_audio_words_v11(
            text, wav, sr, 0.0, "NARRATOR", "calm_omen", aligner_mode="acoustic"
        )
        self.assertEqual(mode, "acoustic_island")
        self.assertEqual([w["w"] for w in words], text.split())
        # Verify ZERO word overlaps the silent valley [1.02s .. 1.90s]!
        for w in words:
            overlaps_silence = max(w["s"], 1.02) < min(w["e"], 1.90)
            self.assertFalse(overlaps_silence, f"Word {w} drifted into 1.00s acoustic silence [1.02..1.90s]!")

        # Verify [VISUAL Xs] directive is parsed separately from [DEAD SILENCE Xs]
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(
                    "[VISUAL 2.5s]\n[NARRATOR | mood=calm_omen]\nĐêm mưa lạnh buốt.\n[DEAD SILENCE 0.7s]\nAi đang gõ cửa?\n"
                )
            items = gen_horror_voice.parse_script(sp)
            kinds = [it["kind"] for it in items]
            self.assertEqual(kinds, ["visual", "speech", "dead_silence", "speech"])

    def test_single_lock_shots_extract_and_strict_cinema_gates(self):
        words = [
            {"w": "Đêm", "s": 2.60, "e": 2.90, "speaker": "NARRATOR"},
            {"w": "mưa", "s": 2.92, "e": 3.20, "speaker": "NARRATOR"},
            {"w": "bão", "s": 3.22, "e": 3.60, "speaker": "NARRATOR"},
            {"w": "Chú", "s": 4.10, "e": 4.40, "speaker": "NARRATOR"},
            {"w": "Tư", "s": 4.42, "e": 4.70, "speaker": "NARRATOR"},
            {"w": "đưa", "s": 4.72, "e": 5.05, "speaker": "NARRATOR"},
            {"w": "chìa", "s": 5.08, "e": 5.40, "speaker": "NARRATOR"},
            {"w": "khóa", "s": 5.42, "e": 5.85, "speaker": "NARRATOR"},
        ]
        visual_beats = [{"s": 0.0, "e": 2.55, "dur": 2.55}]
        manifest = {
            "projectId": "v11-lock-test",
            "title": "V11 Lock Test",
            "totalFrames": 180,
            "aspect": "9:16",
            "locations": [
                {
                    "id": "S01",
                    "archetype": "ferryTicketBoothTest",
                    "dimensions": [5.0, 5.0, 3.2],
                    "ceilingType": "flatConcrete",
                    "materials": {"wall": "darkTimberTex", "floor": "concreteFloorTex", "ceiling": "corrugatedTinTex"},
                    "practicalLights": ["oilLamp"],
                    "heroProps": ["ledger", "ironBolt", "coalStove"],
                    "signatureShadowBeat": "Warm oil lamp against rain glass",
                    "anchors": {"DESK": [0, 0, 0], "CLERK": [0, 0, -1.5]},
                }
            ],
            "castBlueprints": [
                {"id": "C01", "role": "human", "storyDescription": "Protagonist night shift worker", "appearance": {"height": 1.72}},
                {"id": "C02", "role": "human", "storyDescription": "Elderly ferryman", "appearance": {"height": 1.66}},
            ],
            "beats": [
                {
                    "beatId": "B1",
                    "shotId": 1,
                    "a": 0,
                    "b": 180,
                    "peakFrame": 90,
                    "locationId": "S01",
                    "spokenLine": {"speaker": "NAM", "text": "Đêm mưa bão Chú Tư đưa chìa khóa"},
                    "lightState": {"preset": "warmLamp", "lampsOn": ["oilLamp"]},
                    "castStates": {
                        "C01": {"visible": True, "anchor": "DESK", "pose": "standIdle", "speakingAs": "NARRATOR", "dialogueMode": "voiceOver"},
                        "C02": {"visible": True, "anchor": "CLERK", "pose": "talkCalm", "dialogueMode": "silent"},
                    },
                    "propStates": {},
                    "cameraIntent": "Master into anchored POV",
                }
            ],
            "shots": [
                {
                    "id": 1,
                    "a": 0,
                    "b": 60,
                    "scale": "WS",
                    "light": "warmLamp",
                    "cameraMode": "master",
                    "axisSide": "pov_center",
                    "visualBeatIndex": 0,
                    "note": "Master Establishing",
                },
                {
                    "id": 2,
                    "a": 60,
                    "b": 120,
                    "scale": "POV",
                    "light": "warmLamp",
                    "cameraMode": "pov",
                    "axisSide": "pov_center",
                    "startPhrase": "Đêm mưa bão",
                    "note": "POV desk",
                },
                {
                    "id": 3,
                    "a": 120,
                    "b": 180,
                    "scale": "POV_PROP",
                    "light": "warmLamp",
                    "cameraMode": "pov_interact",
                    "axisSide": "pov_center",
                    "startPhrase": "Chú Tư đưa",
                    "actionTriggerPhrase": "chìa khóa",
                    "note": "POV reach keys",
                },
            ],
        }

        aligned, _ = align_manifest.align_manifest_data(manifest, words, fps=30.0, visual_beats=visual_beats)
        self.assertEqual(aligned["shots"][0]["a"], 0)
        self.assertEqual(aligned["shots"][1]["a"], int(round(2.60 * 30)))  # f78 exact lock!
        self.assertEqual(aligned["shots"][2]["a"], int(round(4.10 * 30)))  # f123 exact lock!
        self.assertEqual(aligned["shots"][2]["actionTriggerFrame"], int(round(5.08 * 30)))  # f152 exact trigger!

        with tempfile.TemporaryDirectory() as td:
            mp = os.path.join(td, "manifest.json")
            wp = os.path.join(td, "words.json")
            st_ts = os.path.join(td, "story.ts")
            sh_out = os.path.join(td, "shots.json")
            with open(mp, "w", encoding="utf-8") as fp:
                json.dump(aligned, fp, ensure_ascii=False)
            with open(wp, "w", encoding="utf-8") as fp:
                json.dump({"words": words, "visual_beats": visual_beats}, fp, ensure_ascii=False)
            with open(st_ts, "w", encoding="utf-8") as fp:
                fp.write('import rawManifest from "./manifest.json";\nexport const SHOTS = shotsFromManifest(rawManifest);\n')

            # Valid manifest passes --strict-cinema!
            res_ok = subprocess.run(
                [sys.executable, os.path.join(TEMPLATES_SCRIPTS, "validate_manifest.py"), mp, "--words", wp, "--strict-cinema"],
                capture_output=True, text=True,
            )
            self.assertEqual(res_ok.returncode, 0, res_ok.stdout + res_ok.stderr)

            # extract_shots.py reads manifest.json shots[] cleanly even with zero hardcoded array in story.ts!
            res_ex = subprocess.run(
                [sys.executable, os.path.join(TEMPLATES_SCRIPTS, "extract_shots.py"), st_ts, sh_out],
                capture_output=True, text=True,
            )
            self.assertEqual(res_ex.returncode, 0, res_ex.stdout + res_ex.stderr)
            with open(sh_out, encoding="utf-8") as fp:
                ex_data = json.load(fp)
            self.assertEqual(len(ex_data["shots"]), 3)
            self.assertEqual(ex_data["shots"][1]["a"], 78)

            # Invalid manifest triggers MASTER_ESTABLISHING_ERROR, AXIS_180_VIOLATION_ERROR & VOICEOVER_LIPSYNC_ERROR!
            bad = json.loads(json.dumps(aligned))
            bad["shots"][0]["cameraMode"] = "pov"
            bad["shots"][1]["cameraMode"] = "ots_same_side"
            bad["shots"][1]["axisSide"] = "left"
            bad["shots"][2]["cameraMode"] = "ots_same_side"
            bad["shots"][2]["axisSide"] = "right"
            bad["beats"][0]["castStates"]["C01"]["dialogueMode"] = "directSpeech"
            bad_mp = os.path.join(td, "bad_manifest.json")
            with open(bad_mp, "w", encoding="utf-8") as fp:
                json.dump(bad, fp, ensure_ascii=False)
            res_bad = subprocess.run(
                [sys.executable, os.path.join(TEMPLATES_SCRIPTS, "validate_manifest.py"), bad_mp, "--words", wp, "--strict-cinema"],
                capture_output=True, text=True,
            )
            self.assertNotEqual(res_bad.returncode, 0)
            self.assertIn("MASTER_ESTABLISHING_ERROR", res_bad.stdout)
            self.assertIn("AXIS_180_VIOLATION_ERROR", res_bad.stdout)
            self.assertIn("VOICEOVER_LIPSYNC_ERROR", res_bad.stdout)


if __name__ == "__main__":
    unittest.main()
