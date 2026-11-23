import json
import os
import subprocess
import sys
import tempfile
import unittest

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRIPTS = os.path.join(REPO, "templates", "scripts")
VALIDATE = os.path.join(SCRIPTS, "validate_manifest.py")
EXTRACT = os.path.join(SCRIPTS, "extract_shots.py")
HORROR_STORY = os.path.join(SCRIPTS, "horror_story.py")
HORROR_STORY_COMP = os.path.join(REPO, "companion-skills", "horror-story", "scripts", "horror_story.py")
VALIDATE_CONT = os.path.join(SCRIPTS, "validate_continuity.py")


def make_sample_manifest(project_id="demo-a", loc_id="funeralRoom", archetype="ruralThatchedHouse", same_ref=None):
    loc = {
        "id": loc_id,
        "archetype": archetype,
        "dimensions": [6.4, 7.6, 4.2],
        "ceilingType": "aFrameThatch",
        "materials": {"wall": "mottledPlasterTex", "floor": "packedEarthTex", "ceiling": "thatchRoofTex"},
        "practicalLights": ["oilLamp", "altarCandle"],
        "heroProps": ["coffin", "ancestralAltar", "glassOilLamp"],
        "signatureShadowBeat": "Feet shadow cutting moonlight under door",
    }
    if same_ref:
        loc["sameLocationOf"] = same_ref
    return {
        "projectId": project_id,
        "title": "Demo",
        "totalFrames": 90,
        "aspect": "9:16",
        "locations": [loc],
        "beats": [
            {
                "beatId": "B1",
                "shotId": 1,
                "a": 0,
                "b": 45,
                "peakFrame": 20,
                "locationId": loc_id,
                "spokenLine": {"speaker": "TÙNG", "text": "Đếm lại vẫn ra bốn."},
                "lightState": {"preset": "warmLamp", "lampsOn": ["oilLamp"], "doorMoonlight": True, "feetShadow": False},
                "castStates": {"npc": {"visible": True, "anchor": "SEAT", "pose": "sitCrossLegged", "expr": "uneasy"}},
                "propStates": {
                    "phone": {
                        "visible": True,
                        "state": "raised",
                        "detail": {"clock": "01:06", "notifTime": "01:06", "notifSender": "Cô Lan", "notifBody": "Cô ở nhà."},
                    }
                },
                "cameraIntent": "POV holding phone showing 01:06",
            },
            {
                "beatId": "B2",
                "shotId": 2,
                "a": 45,
                "b": 90,
                "peakFrame": 70,
                "locationId": loc_id,
                "spokenLine": {"speaker": "BÓNG NGƯỜI", "text": "Còn thiếu một."},
                "lightState": {"preset": "coldMoon", "lampsOn": [], "doorMoonlight": True, "feetShadow": True},
                "castStates": {"entity": {"visible": True, "anchor": "DOOR", "pose": "loomingStill", "eyeGlow": True}},
                "propStates": {"phone": {"visible": False, "state": "hidden"}},
                "cameraIntent": "Lights out, cold moonlight crack under door with foot shadows",
            },
        ],
    }


class TestScriptsV3(unittest.TestCase):
    def test_validate_manifest_passes_and_emits_still_manifest_and_registry(self):
        with tempfile.TemporaryDirectory() as td:
            mp = os.path.join(td, "manifest.json")
            sp = os.path.join(td, "SCRIPT.md")
            wp = os.path.join(td, "words.json")
            reg = os.path.join(td, "LOCATION_REGISTRY.json")
            still_out = os.path.join(td, "still_manifest.json")

            json.dump(make_sample_manifest(), open(mp, "w", encoding="utf-8"), ensure_ascii=False)
            open(sp, "w", encoding="utf-8").write("Đếm lại vẫn ra bốn.\nCòn thiếu một.\n")
            json.dump(
                [
                    {"word": "Đếm", "start": 0.05, "end": 0.35},
                    {"word": "lại", "start": 0.36, "end": 0.65},
                    {"word": "vẫn", "start": 0.66, "end": 0.95},
                    {"word": "ra", "start": 0.96, "end": 1.15},
                    {"word": "bốn.", "start": 1.16, "end": 1.45},
                    {"word": "Còn", "start": 1.55, "end": 1.90},
                    {"word": "thiếu", "start": 1.91, "end": 2.35},
                    {"word": "một.", "start": 2.36, "end": 2.85},
                ],
                open(wp, "w", encoding="utf-8"),
                ensure_ascii=False,
            )

            res = subprocess.run(
                [sys.executable, VALIDATE, mp, "--script", sp, "--words", wp, "--registry", reg, "--update-registry", "--still-out", still_out],
                capture_output=True, text=True,
            )
            self.assertEqual(res.returncode, 0, msg=res.stdout + res.stderr)
            stills = json.load(open(still_out, encoding="utf-8"))
            self.assertEqual(len(stills), 2)
            self.assertEqual(stills[0]["peakFrame"], 20)
            self.assertEqual(stills[1]["peakFrame"], 70)
            registry = json.load(open(reg, encoding="utf-8"))
            self.assertEqual(len(registry), 1)

    def test_anti_repeat_rejects_unrelated_duplicate_and_allows_explicit_sameLocationOf(self):
        with tempfile.TemporaryDirectory() as td:
            reg = os.path.join(td, "LOCATION_REGISTRY.json")
            mp1 = os.path.join(td, "m1.json")
            mp2 = os.path.join(td, "m2.json")
            mp3 = os.path.join(td, "m3.json")

            json.dump(make_sample_manifest(project_id="video-1"), open(mp1, "w", encoding="utf-8"), ensure_ascii=False)
            r1 = subprocess.run([sys.executable, VALIDATE, mp1, "--registry", reg, "--update-registry"], capture_output=True, text=True)
            self.assertEqual(r1.returncode, 0, msg=r1.stdout + r1.stderr)

            # Unrelated video-2 reusing the exact same rural thatched house -> MUST FAIL with ANTI_REPEAT_ERROR
            json.dump(make_sample_manifest(project_id="video-2", loc_id="otherRoom"), open(mp2, "w", encoding="utf-8"), ensure_ascii=False)
            r2 = subprocess.run([sys.executable, VALIDATE, mp2, "--registry", reg], capture_output=True, text=True)
            self.assertNotEqual(r2.returncode, 0)
            self.assertIn("ANTI_REPEAT_ERROR", r2.stdout + r2.stderr)

            # Explicit narrative revisit via sameLocationOf -> MUST PASS
            json.dump(make_sample_manifest(project_id="video-1-part2", loc_id="funeralRoomP2", same_ref="video-1:funeralRoom"), open(mp3, "w", encoding="utf-8"), ensure_ascii=False)
            r3 = subprocess.run([sys.executable, VALIDATE, mp3, "--registry", reg], capture_output=True, text=True)
            self.assertEqual(r3.returncode, 0, msg=r3.stdout + r3.stderr)

    def test_validate_manifest_catches_script_drift_timeline_gap_bad_light_and_phone_mismatch(self):
        with tempfile.TemporaryDirectory() as td:
            mp = os.path.join(td, "bad.json")
            sp = os.path.join(td, "SCRIPT.md")
            open(sp, "w", encoding="utf-8").write("Câu thoại hoàn toàn khác.\n")

            bad = make_sample_manifest()
            bad["beats"][1]["a"] = 50  # gap 45..50
            bad["beats"][1]["lightState"]["preset"] = "blood"  # banned v2 preset
            bad["beats"][0]["propStates"]["phone"]["detail"]["notifTime"] = "02:30"  # contradicts clock 01:06
            json.dump(bad, open(mp, "w", encoding="utf-8"), ensure_ascii=False)

            res = subprocess.run([sys.executable, VALIDATE, mp, "--script", sp], capture_output=True, text=True)
            self.assertNotEqual(res.returncode, 0)
            out = res.stdout + res.stderr
            self.assertIn("gap", out.lower())
            self.assertIn("blood", out.lower())
            self.assertIn("phone", out.lower())

    def test_extract_shots_exports_whipPan_intervals_into_planned(self):
        with tempfile.TemporaryDirectory() as td:
            story_ts = os.path.join(td, "story.ts")
            shots_json = os.path.join(td, "shots.json")
            open(story_ts, "w", encoding="utf-8").write(
                """
export const FPS = 30;
export const TOTAL = 120;
export const SHOTS = [
  { id: 1, a: 0, b: 60, light: "warmLamp", scale: "POV" },
  { id: 2, a: 60, b: TOTAL, light: "coldMoon", scale: "POV_TURN" },
];
export const WHIP_PANS = [
  { f0: 52, dur: 7, fromLook: [0, 1, -2], toLook: [2, 1, 0] },
];
export const CAMS = {
  1: [{ f: 0, s: (f: number) => whipPan([0, 1.1, 2], { f0: 52, dur: 7, fromLook: [0,1,-2], toLook: [2,1,0] }, f) }],
  2: [{ f: 60, s: () => ({ pos: [0, 1.1, 2], look: [2, 1, 0] }) }],
};
"""
            )
            res = subprocess.run([sys.executable, EXTRACT, story_ts, shots_json], capture_output=True, text=True)
            self.assertEqual(res.returncode, 0, msg=res.stdout + res.stderr)
            data = json.load(open(shots_json, encoding="utf-8"))
            planned = data["planned"]
            self.assertTrue(any(a <= 52 and b >= 59 for a, b in planned), f"whipPan [52,59] missing from planned={planned}")

    def test_v3_valid_lights_synced_in_horror_story_and_validate_continuity(self):
        for p in (HORROR_STORY, HORROR_STORY_COMP, VALIDATE_CONT):
            txt = open(p, encoding="utf-8").read()
            self.assertIn("warmLamp", txt, msg=f"{p} missing warmLamp")
            self.assertIn("coldMoon", txt, msg=f"{p} missing coldMoon")
            self.assertIn("fluorescent", txt, msg=f"{p} missing fluorescent")
            self.assertIn("duskFog", txt, msg=f"{p} missing duskFog")
            self.assertIn("flashlight", txt, msg=f"{p} missing flashlight")
            self.assertNotIn('"blood"', txt, msg=f"{p} must not retain banned v2 blood light")


if __name__ == "__main__":
    unittest.main()
