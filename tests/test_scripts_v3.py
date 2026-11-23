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


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False)


def read_json(path):
    with open(path, encoding="utf-8") as fp:
        return json.load(fp)


class TestScriptsV3(unittest.TestCase):
    def test_validate_manifest_passes_and_emits_still_manifest_and_registry(self):
        with tempfile.TemporaryDirectory() as td:
            mp = os.path.join(td, "manifest.json")
            sp = os.path.join(td, "SCRIPT.md")
            wp = os.path.join(td, "words.json")
            reg = os.path.join(td, "LOCATION_REGISTRY.json")
            still_out = os.path.join(td, "still_manifest.json")

            write_json(mp, make_sample_manifest())
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write("Đếm lại vẫn ra bốn.\nCòn thiếu một.\n")
            write_json(
                wp,
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
            )

            res = subprocess.run(
                [sys.executable, VALIDATE, mp, "--script", sp, "--words", wp, "--registry", reg, "--update-registry", "--still-out", still_out],
                capture_output=True, text=True,
            )
            self.assertEqual(res.returncode, 0, msg=res.stdout + res.stderr)
            stills = read_json(still_out)
            self.assertEqual(len(stills), 2)
            self.assertEqual(stills[0]["peakFrame"], 20)
            self.assertEqual(stills[1]["peakFrame"], 70)
            registry = read_json(reg)
            self.assertEqual(len(registry), 1)

    def test_anti_repeat_rejects_unrelated_duplicate_self_ref_and_allows_explicit_sameLocationOf(self):
        with tempfile.TemporaryDirectory() as td:
            reg = os.path.join(td, "LOCATION_REGISTRY.json")
            mp1 = os.path.join(td, "m1.json")
            mp2 = os.path.join(td, "m2.json")
            mp3 = os.path.join(td, "m3.json")
            mp4 = os.path.join(td, "m4.json")

            write_json(mp1, make_sample_manifest(project_id="video-1"))
            r1 = subprocess.run([sys.executable, VALIDATE, mp1, "--registry", reg, "--update-registry"], capture_output=True, text=True)
            self.assertEqual(r1.returncode, 0, msg=r1.stdout + res_err(r1))

            # Unrelated video-2 reusing the exact same rural thatched house -> MUST FAIL with ANTI_REPEAT_ERROR
            write_json(mp2, make_sample_manifest(project_id="video-2", loc_id="otherRoom"))
            r2 = subprocess.run([sys.executable, VALIDATE, mp2, "--registry", reg], capture_output=True, text=True)
            self.assertNotEqual(r2.returncode, 0)
            self.assertIn("ANTI_REPEAT_ERROR", r2.stdout + r2.stderr)

            # Self-referencing sameLocationOf bypass attempt -> MUST FAIL
            write_json(mp4, make_sample_manifest(project_id="video-3", loc_id="cheatRoom", same_ref="cheatRoom"))
            r4 = subprocess.run([sys.executable, VALIDATE, mp4, "--registry", reg], capture_output=True, text=True)
            self.assertNotEqual(r4.returncode, 0)
            self.assertIn("ANTI_REPEAT_ERROR", r4.stdout + r4.stderr)

            # Explicit narrative revisit via sameLocationOf -> MUST PASS
            write_json(mp3, make_sample_manifest(project_id="video-1-part2", loc_id="funeralRoomP2", same_ref="video-1:funeralRoom"))
            r3 = subprocess.run([sys.executable, VALIDATE, mp3, "--registry", reg], capture_output=True, text=True)
            self.assertEqual(r3.returncode, 0, msg=r3.stdout + r3.stderr)

    def test_validate_manifest_catches_script_drift_words_overrun_bad_light_pose_and_phone_mismatch(self):
        with tempfile.TemporaryDirectory() as td:
            mp = os.path.join(td, "bad.json")
            sp = os.path.join(td, "SCRIPT.md")
            wp = os.path.join(td, "words.json")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write("Câu thoại hoàn toàn khác.\n")

            bad = make_sample_manifest()
            bad["beats"][1]["a"] = 50  # gap 45..50
            bad["beats"][1]["lightState"]["preset"] = "blood"  # banned v2 preset
            bad["beats"][1]["castStates"]["entity"]["pose"] = "flyingLaser"  # invalid pose
            bad["beats"][0]["propStates"]["phone"]["detail"]["notifTime"] = "02:30"  # contradicts clock 01:06
            write_json(mp, bad)
            write_json(
                wp,
                [
                    {"word": "Đếm", "start": 0.85, "end": 1.2},  # > 0.35s drift from 0.0s
                    {"word": "lại", "start": 1.21, "end": 1.4},
                    {"word": "vẫn", "start": 1.41, "end": 1.6},
                    {"word": "ra", "start": 1.61, "end": 1.8},
                    {"word": "bốn.", "start": 1.81, "end": 2.2},  # overruns beat end 1.5s + 0.35s
                ],
            )

            res = subprocess.run([sys.executable, VALIDATE, mp, "--script", sp, "--words", wp], capture_output=True, text=True)
            self.assertNotEqual(res.returncode, 0)
            out = res.stdout + res.stderr
            self.assertIn("gap", out.lower())
            self.assertIn("blood", out.lower())
            self.assertIn("phone", out.lower())
            self.assertIn("pose", out.lower())
            self.assertIn("timing drift", out.lower())
            self.assertIn("timing overrun", out.lower())

    def test_validate_manifest_supports_repeated_dialogue_motif_with_monotonic_words_cursor(self):
        with tempfile.TemporaryDirectory() as td:
            mp = os.path.join(td, "repeat.json")
            sp = os.path.join(td, "SCRIPT.md")
            wp = os.path.join(td, "words.json")
            m = make_sample_manifest()
            m["beats"][0]["spokenLine"]["text"] = "Đếm lại đi."
            m["beats"][1]["spokenLine"]["text"] = "Đếm lại đi."
            write_json(mp, m)
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write("Đếm lại đi.\nĐếm lại đi.\n")
            write_json(
                wp,
                [
                    {"word": "Đếm", "start": 0.10, "end": 0.40},
                    {"word": "lại", "start": 0.41, "end": 0.70},
                    {"word": "đi.", "start": 0.71, "end": 1.10},
                    {"word": "Đếm", "start": 1.60, "end": 1.95},
                    {"word": "lại", "start": 1.96, "end": 2.30},
                    {"word": "đi.", "start": 2.31, "end": 2.75},
                ],
            )
            res = subprocess.run([sys.executable, VALIDATE, mp, "--script", sp, "--words", wp], capture_output=True, text=True)
            self.assertEqual(res.returncode, 0, msg=res.stdout + res.stderr)

    def test_extract_shots_exports_whipPan_balanced_parens_and_pov_motions_into_planned(self):
        with tempfile.TemporaryDirectory() as td:
            story_ts = os.path.join(td, "story.ts")
            shots_json = os.path.join(td, "shots.json")
            with open(story_ts, "w", encoding="utf-8") as fp:
                fp.write(
                    """
export const FPS = 30;
export const DEMO_FRAMES = 120;
export const TOTAL = DEMO_FRAMES;
export const SHOTS = [
  { id: 1, a: 0, b: 60, light: "warmLamp", scale: "POV" },
  { id: 2, a: 60, b: TOTAL, light: "coldMoon", scale: "POV_TURN" },
];
export const WHIP_PANS = [
  { f0: 52, dur: 7, fromLook: [0, 1, -2], toLook: [2, 1, 0] },
] as const;
export const POV_MOTIONS: [number, number][] = [[59, 69]];
export const CAMS = {
  1: [{ f: 0, s: (f: number) => whipPan(getEye(0, 1), { f0: 18, dur: 6, fromLook: [0,1,-2], toLook: [2,1,0] }, f) }],
  2: [{ f: 60, s: () => ({ pos: [0, 1.1, 2], look: [2, 1, 0] }) }],
};
"""
                )
            res = subprocess.run([sys.executable, EXTRACT, story_ts, shots_json], capture_output=True, text=True)
            self.assertEqual(res.returncode, 0, msg=res.stdout + res.stderr)
            data = read_json(shots_json)
            planned = data["planned"]
            self.assertTrue(any(a <= 52 and b >= 59 for a, b in planned), f"WHIP_PANS [52,59] missing from planned={planned}")
            self.assertTrue(any(a <= 18 and b >= 24 for a, b in planned), f"inline whipPan [18,24] missing from planned={planned}")
            self.assertTrue(any(a <= 59 and b >= 69 for a, b in planned), f"POV_MOTIONS [59,69] missing from planned={planned}")

    def test_v3_valid_lights_synced_in_horror_story_and_validate_continuity(self):
        for p in (HORROR_STORY, HORROR_STORY_COMP, VALIDATE_CONT):
            with open(p, encoding="utf-8") as fp:
                txt = fp.read()
            self.assertIn("warmLamp", txt, msg=f"{p} missing warmLamp")
            self.assertIn("coldMoon", txt, msg=f"{p} missing coldMoon")
            self.assertIn("fluorescent", txt, msg=f"{p} missing fluorescent")
            self.assertIn("duskFog", txt, msg=f"{p} missing duskFog")
            self.assertIn("flashlight", txt, msg=f"{p} missing flashlight")
            self.assertNotIn('"blood"', txt, msg=f"{p} must not retain banned v2 blood light")


def res_err(r):
    return r.stderr or ""


if __name__ == "__main__":
    unittest.main()
