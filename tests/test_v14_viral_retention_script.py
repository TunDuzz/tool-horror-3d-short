import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
import numpy as np

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEMPLATES_SCRIPTS = os.path.join(REPO_ROOT, "templates", "scripts")
if TEMPLATES_SCRIPTS not in sys.path:
    sys.path.insert(0, TEMPLATES_SCRIPTS)

import constitution  # noqa: E402
import gen_horror_voice  # noqa: E402
import horror_story  # noqa: E402


def _make_valid_v32_short(title: str = "Máy Nội Bộ 204"):
    """Build a minimal valid v3.2 viral_short story.json for Gate 26 tests."""
    with tempfile.TemporaryDirectory() as td:
        out_p = os.path.join(td, "story.json")
        ns = horror_story.argparse.Namespace(
            title=title,
            format="micro",
            parts=1,
            total_sec=54,
            mode="auto",
            aspect="9:16",
            pov="first_person_survivor",
            genre="folklore",
            adapt_mode="original",
            pacing_profile="viral_short",
            dialect="north",
            grit_level="platform_safe_raw",
            out=out_p,
        )
        horror_story.cmd_seed(ns)
        doc = horror_story.read_json(out_p)

    doc["premise"]["core"] = "Máy bàn đã cắt dây vẫn đổ chuông lúc nửa đêm."
    doc["premise"]["entityRule"] = "Ai nhấc máy số 204 phải ở lại trực thế."
    doc["premise"]["twistCore"] = "Dây máy đã cắt đứt từ năm ngoái và phủ dày bụi."
    doc["worldLore"]["era"] = "Khu tập thể cũ Hà Nội"
    doc["worldLore"]["settingDetail"] = "Phòng trực chật hẹp bít cửa sắt"
    doc["worldLore"]["backstory"] = "Người trực phòng 204 mất tích đúng đêm gió rét"
    doc["entityProfile"]["name"] = "Người Gọi Số 204"
    doc["entityProfile"]["origin"] = "Tiếng kẹt trong đường dây nội bộ bỏ hoang"
    doc["entityProfile"]["rules"] = [
        {
            "rule": "Khóa chốt sắt trước 1 giờ",
            "trigger": "Nghe chuông bàn gỉ kêu",
            "consequence": "Tay nắm cửa bị xoay mạnh",
            "loophole": "Mặc xác nó không chạm ống nghe",
        },
        {
            "rule": "Đừng mở cửa phòng 204",
            "trigger": "Có giọng gọi ngoài hành lang",
            "consequence": "Mất dấu chìa khóa trực",
            "loophole": "Cầm chắc chùm chìa trong tay",
        },
    ]
    for c in doc["characters"]:
        c["name"] = "Tú" if c["id"] == "C01" else "Bóng Ngoài Cửa"
        c["arc"] = "Từ bực dọc ca trực sang chết lặng khi nhìn sợi dây đứt"
        c["appearanceBrief"] = "Bảo vệ trẻ mặc áo khoác sờn cũ"
        if c["id"] == "C01":
            c["goal"] = "Cố trực nốt đêm lấy tiền công"
            c["trappedReason"] = "Cửa cổng khu tập thể bị khóa xích ngoài"
            c["flaw"] = "Coi thường lời dặn người già"
    doc["characters"].append({
        "id": "C03",
        "name": "Bà Hạnh",
        "tier": "support",
        "roleType": "human",
        "role": "Người giao ca miền Bắc",
        "voiceProfile": "Nữ trung niên miền Bắc, gắt gọn dè chừng",
        "appearanceBrief": "Bà lao công quấn khăn len bạc màu",
        "arc": "Dặn vội rồi đi thẳng ra cổng",
        "from": ["Sáng tác mới"],
    })
    doc["scenes"][0]["name"] = "Phòng trực khu tập thể cũ"
    doc["scenes"][0]["atmosphere"] = "Mùi ẩm mốc và ánh đèn bàn vàng đục"
    for a in doc["acts"]:
        a["goal"] = "Giữ cửa đóng kín"
        a["turningPoint"] = "Chuông máy bàn cụt dây đổ dồn"
    for cl in doc["clues"]:
        cl["plantedDetail"] = "Đầu dây điện thoại dưới gầm bàn phủ bụi dày"
        cl["recontextualization"] = "Cái máy này vốn không nối nguồn từ lâu rồi"
    for b in doc["beats"]:
        b["setup"] = "Tiếng tíc tắc đồng hồ treo tường chậm dần"
        b["payoff"] = "Kim giây khựng đứng đúng lúc chuông tắt"
    doc["props"] = [
        {"id": "P_PHONE", "name": "Máy bàn cũ", "sceneId": "S01", "initialState": "idle", "states": ["idle", "ringing"], "function": "Đổ chuông dụ người nhấc", "beatIds": ["B01"]},
        {"id": "P_BOLT", "name": "Chốt cửa sắt", "sceneId": "S01", "initialState": "open", "states": ["open", "locked"], "function": "Chặn cửa hành lang", "beatIds": ["B01"]},
    ]
    doc["soundscapeDesign"] = {
        "nearBed": {"sound": "room_tone_dark", "label": "Không khí phòng trực chật"},
        "farBed": {
            "sound": "night_wind_draft",
            "label": "Gió bấc rít ngoài hành lang",
            "occlusionTrigger": {"atWord": "chốt", "lpHz": 580, "gainDeltaDb": -6.0},
        },
        "motifs": [
            {
                "id": "m_clock",
                "sound": "wall_clock_tick",
                "intervalSec": 2.0,
                "mode": "steady_then_stop",
                "meaning": "Kim giây khựng đứng ngay trước tiếng gọi",
                "breakBeatId": "P1_AB2",
            }
        ],
    }

    p = doc["parts"][0]
    p["newInfoRevealed"] = "Cái máy bàn bị cắt đứt dây từ lâu vẫn tự reo"
    p["hook"] = "Mẹ kiếp, cái máy bàn đứt dây góc phòng lại đổ chuông!"
    p["suspense"] = "Nắm đấm cửa vặn mạnh ngay sau tiếng kim đồng hồ khựng đứng"
    p["synopsis"] = "Vừa khép cửa lại, cái máy bàn góc phòng ré lên dù chẳng cắm dây điện."
    p["characterIds"] = ["C01", "C02", "C03"]
    p["propIds"] = ["P_PHONE", "P_BOLT"]
    p["soundCues"] = ["wall_clock_tick"]
    p["coldHook"] = {
        "hookArchetype": "paradox_prop",
        "openingLine": "Mẹ kiếp, cái máy bàn cắt đứt dây góc phòng lại ré chuông giữa đêm!",
        "openingSoundCue": "old_phone_ring",
    }
    p["actionBeats"] = [
        {
            "beatId": "P1_AB1",
            "sceneId": "S01",
            "durationSec": 12.0,
            "visualBeforeSec": 0.1,
            "audioCue": "old_phone_ring",
            "mood": "tense",
            "light": "warmLamp",
            "camera": {"posLandmark": "POV_START", "lookLandmark": "HERO_PROP_SPOT"},
            "actors": [{"id": "C01", "visible": True, "fromLandmark": "POV_START", "toLandmark": "POV_START", "pose": "standIdle"}],
            "propChanges": [{"id": "P_PHONE", "fromState": "idle", "toState": "ringing", "triggerWord": "chuông"}],
            "actionSummary": "Sững người nhìn máy bàn ré chuông",
            "subtext": "Tưởng bà Hạnh bày trò dọa lính mới",
            "sensoryDetails": {"sight": "Đèn bàn rung nhẹ", "sound": "Tiếng chuông sắt ré gắt"},
            "spokenBeat": {
                "speaker": "NARRATOR",
                "intent": "Đập thẳng biến cố nghịch lý ở 3 giây đầu",
                "keyPhrase": "Mẹ kiếp, cái máy bàn đứt dây lại ré chuông!",
                "mood": "tense",
                "wordBudget": 28,
            },
        },
        {
            "beatId": "P1_AB2",
            "sceneId": "S01",
            "durationSec": 14.0,
            "mood": "uneasy",
            "light": "warmLamp",
            "camera": {"posLandmark": "POV_START", "lookLandmark": "MAIN_DOOR"},
            "actors": [{"id": "C01", "visible": True, "fromLandmark": "POV_START", "toLandmark": "POV_START", "pose": "peerForward"}],
            "propChanges": [{"id": "P_BOLT", "fromState": "open", "toState": "locked", "triggerWord": "chốt"}],
            "actionSummary": "Gài chốt sắt theo lời bà Hạnh dặn",
            "subtext": "Bực mình nhưng vẫn làm theo cho chắc",
            "sensoryDetails": {"sight": "Chốt sắt gỉ sét", "sound": "Tiếng cạch kim loại khô khốc"},
            "spokenBeat": {
                "speaker": "Bà Hạnh",
                "intent": "Dặn thẳng luật không nhấc máy",
                "keyPhrase": "Khóa chết chốt sắt vào, mặc xác nó!",
                "mood": "tense",
                "wordBudget": 24,
            },
        },
        {
            "beatId": "P1_AB3",
            "sceneId": "S01",
            "durationSec": 14.0,
            "mood": "dread",
            "light": "warmLamp",
            "camera": {"posLandmark": "POV_START", "lookLandmark": "MAIN_DOOR"},
            "actors": [{"id": "C01", "visible": True, "fromLandmark": "POV_START", "toLandmark": "POV_START", "pose": "peerForward"}],
            "propChanges": [],
            "actionSummary": "Nghe nắm cửa rung lắc rồi im bặt",
            "subtext": "Chờ tiếng bước chân ngoài hành lang",
            "sensoryDetails": {"sight": "Bóng lướt qua khe cửa", "sound": "Kim đồng hồ khựng đứng"},
            "spokenBeat": {
                "speaker": "NARRATOR",
                "intent": "Tạo khoảng lặng trước khi cúi xuống bàn",
                "keyPhrase": "Ngoài kia bỗng im phăng phắc.",
                "mood": "whisper",
                "wordBudget": 24,
            },
        },
        {
            "beatId": "P1_AB4",
            "sceneId": "S01",
            "durationSec": 14.0,
            "mood": "cold_twist",
            "light": "warmLamp",
            "camera": {"posLandmark": "POV_START", "lookLandmark": "HERO_PROP_SPOT"},
            "actors": [{"id": "C01", "visible": True, "fromLandmark": "POV_START", "toLandmark": "POV_START", "pose": "leanDown"}],
            "propChanges": [],
            "actionSummary": "Soi sợi dây điện thoại cắt cụt bám bụi",
            "subtext": "Chết lặng khi nhận ra không hề có nguồn điện",
            "sensoryDetails": {"sight": "Đầu dây đồng đứt lìa đóng bụi", "sound": "Tiếng thở sát gáy"},
            "jumpscareStyle": "cinema_stab",
            "jumpscareReason": "Cú lật cận mặt thực thể sau gáy đúng lúc nhìn thấy đầu dây đồng bị cắt đứt",
            "spokenBeat": {
                "speaker": "NARRATOR",
                "intent": "Chốt cú twist bằng khẩu ngữ đời thật",
                "keyPhrase": "Bỏ mẹ rồi, sợi dây đã cắt đứt từ đời nào!",
                "mood": "cold_twist",
                "wordBudget": 26,
            },
        },
    ]
    return doc


class TestV14ViralRetentionAndVoiceTempo(unittest.TestCase):
    def test_constitution_v14_fields_and_camera_mode(self):
        const = constitution.load_constitution()
        self.assertEqual(const["version"], "15.0.0")
        self.assertIn("cold_hook", const["cameraGrammar"]["validCameraModes"])
        sp = const["speech"]
        self.assertEqual(sp["defaultTtsEngine"], "vieneu")
        self.assertAlmostEqual(sp["wordsPerSecondTarget"], 2.35, places=2)
        self.assertAlmostEqual(sp["spokenWordsPerSecondMin"], 2.25, places=2)
        self.assertAlmostEqual(sp["spokenWordsPerSecondTarget"], 2.75, places=2)
        self.assertAlmostEqual(sp["spokenWordsPerSecondMax"], 3.25, places=2)
        self.assertEqual(sp["cleanTempoDefault"], 1.0)
        self.assertTrue(sp["defaultDisableTempoPitchDsp"])

        rv = const["retentionAndVoiceStyle"]
        self.assertLessEqual(rv["maxFirstWordStartSec"], 0.45)
        self.assertIn("viral_short", rv["pacingProfiles"])
        self.assertIn("direct_taboo_question", rv["hookArchetypes"])
        self.assertIn("paradox_prop", rv["hookArchetypes"])
        self.assertEqual(rv["defaultGritLevel"], "clean_folklore")
        self.assertGreaterEqual(len(rv["storyArchetypes"]), 5)
        self.assertIn("clean_folklore", rv["gritLevels"])
        self.assertIn("platform_safe_raw", rv["gritLevels"])
        self.assertIn("south", rv["dialectRegions"])

    def test_gen_horror_voice_v14_faster_tempo_and_strict_hook(self):
        # Verify v15.0 clean 1.0x default (zero tempo/pitch DSP distortion) & tail_pad <= 0.20s
        self.assertEqual(gen_horror_voice.MOOD_PROFILES["calm_omen"]["clean_tempo"], 1.0)
        self.assertEqual(gen_horror_voice.MOOD_PROFILES["calm_omen"]["pitch_semi"], 0.0)
        self.assertLessEqual(gen_horror_voice.MOOD_PROFILES["calm_omen"]["tail_pad"], 0.20)
        self.assertEqual(gen_horror_voice.MOOD_PROFILES["tense"]["clean_tempo"], 1.0)

        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(
                    "[VISUAL 1.2s]\n"
                    "[NARRATOR | mood=tense]\n"
                    "Mẹ kiếp, cái máy bàn cắt đứt dây lại ré chuông lúc nửa đêm!\n"
                )
            items = gen_horror_voice.parse_script(sp)

            def fake_synth(item, sr, idx):
                toks = item["text"].split()
                dur_s = max(0.35, len(toks) * 0.30)
                t = np.linspace(0, dur_s, int(dur_s * sr), endpoint=False)
                sig = 0.18 * np.sin(2 * np.pi * 150.0 * t)
                w = gen_horror_voice.estimate_syllable_words(item["text"], dur_s, 0.0, item["speaker"], item["mood"])
                return sig, w

            args = gen_horror_voice.build_parser().parse_args([
                "--script", sp, "--out-dir", os.path.join(td, "v1"), "--no-vc", "--word-aligner", "proportional", "--strict-hook"
            ])
            buf = io.StringIO()
            with redirect_stdout(buf):
                _, _, payload = gen_horror_voice.assemble_voice(items, args, td, synth_fn=fake_synth)
            out_log = buf.getvalue()
            self.assertEqual(payload["version"], "15.0.0")
            self.assertIn("rms_envelope_30fps", payload)
            self.assertIn("[HOOK WARN]", out_log, f"Expected [HOOK WARN] for 1.2s opening dead air, got:\n{out_log}")

    def test_validate_manifest_cold_hook_and_strict_retention(self):
        words_ok = [
            {"w": "Cái", "s": 0.12, "e": 0.32, "speaker": "NARRATOR"},
            {"w": "máy", "s": 0.34, "e": 0.56, "speaker": "NARRATOR"},
            {"w": "reo.", "s": 0.58, "e": 0.85, "speaker": "NARRATOR"},
            {"w": "Phòng", "s": 1.10, "e": 1.38, "speaker": "NARRATOR"},
            {"w": "trực", "s": 1.40, "e": 1.70, "speaker": "NARRATOR"},
        ]
        words_late = [{"w": w["w"], "s": w["s"] + 2.5, "e": w["e"] + 2.5, "speaker": "NARRATOR"} for w in words_ok]

        base_manifest = {
            "projectId": "v14-hook-test",
            "title": "V14 Cold Hook Test",
            "totalFrames": 160,
            "aspect": "9:16",
            "locations": [
                {
                    "id": "S01",
                    "archetype": "guardBoothV14",
                    "dimensions": [4.5, 4.5, 3.0],
                    "ceilingType": "flatConcrete",
                    "materials": {"wall": "darkTimberTex", "floor": "concreteFloorTex", "ceiling": "corrugatedTinTex"},
                    "practicalLights": ["deskLamp"],
                    "heroProps": ["phone", "bolt", "wallClock"],
                    "signatureShadowBeat": "Cold lamp",
                    "anchors": {"DESK": [0, 0, 0]},
                }
            ],
            "castBlueprints": [{"id": "C01", "role": "human", "storyDescription": "Guard", "appearance": {"height": 1.72}}],
            "beats": [
                {
                    "beatId": "B1",
                    "shotId": 1,
                    "a": 0,
                    "b": 160,
                    "peakFrame": 80,
                    "locationId": "S01",
                    "spokenLine": {"speaker": "TÚ", "text": "Cái máy reo. Phòng trực"},
                    "lightState": {"preset": "warmLamp", "lampsOn": ["deskLamp"]},
                    "castStates": {"C01": {"visible": True, "anchor": "DESK", "pose": "standIdle", "speakingAs": "NARRATOR", "dialogueMode": "voiceOver"}},
                    "propStates": {},
                    "cameraIntent": "Cold hook into master",
                }
            ],
            "shots": [
                {"id": 1, "a": 0, "b": 70, "scale": "ECU", "light": "warmLamp", "cameraMode": "cold_hook", "axisSide": "pov_center"},
                {"id": 2, "a": 70, "b": 160, "scale": "WS", "light": "warmLamp", "cameraMode": "master", "axisSide": "pov_center"},
            ],
        }
        val_script = os.path.join(TEMPLATES_SCRIPTS, "validate_manifest.py")
        with tempfile.TemporaryDirectory() as td:
            mp = os.path.join(td, "manifest.json")
            wp_ok = os.path.join(td, "words_ok.json")
            wp_late = os.path.join(td, "words_late.json")
            with open(mp, "w", encoding="utf-8") as fp:
                json.dump(base_manifest, fp, ensure_ascii=False)
            with open(wp_ok, "w", encoding="utf-8") as fp:
                json.dump({"words": words_ok}, fp, ensure_ascii=False)
            with open(wp_late, "w", encoding="utf-8") as fp:
                json.dump({"words": words_late}, fp, ensure_ascii=False)

            res_pass = subprocess.run(
                [sys.executable, val_script, mp, "--words", wp_ok, "--strict-cinema", "--strict-retention"],
                capture_output=True, text=True,
            )
            self.assertEqual(res_pass.returncode, 0, res_pass.stdout + res_pass.stderr)

            # Dead air > 0.45s at start fails --strict-retention
            res_late = subprocess.run(
                [sys.executable, val_script, mp, "--words", wp_late, "--strict-retention"],
                capture_output=True, text=True,
            )
            self.assertNotEqual(res_late.returncode, 0)
            self.assertIn("RETENTION_DEAD_AIR_ERROR", res_late.stdout)

            # cold_hook NOT followed by master fails --strict-cinema!
            bad_cam = json.loads(json.dumps(base_manifest))
            bad_cam["shots"][1]["cameraMode"] = "pov"
            mp_bad = os.path.join(td, "manifest_bad.json")
            with open(mp_bad, "w", encoding="utf-8") as fp:
                json.dump(bad_cam, fp, ensure_ascii=False)
            res_nomaster = subprocess.run(
                [sys.executable, val_script, mp_bad, "--words", wp_ok, "--strict-cinema"],
                capture_output=True, text=True,
            )
            self.assertNotEqual(res_nomaster.returncode, 0)
            self.assertIn("MASTER_ESTABLISHING_ERROR", res_nomaster.stdout)

    def test_horror_story_gate26_and_v14_blueprint_open(self):
        doc_ok = _make_valid_v32_short()
        gates_ok, failed_ok = horror_story.evaluate_gates(doc_ok, stage="full", strict_story=True)
        self.assertEqual(len(gates_ok), 26)
        self.assertEqual(failed_ok, [], f"Expected 26/26 gates OK, got {failed_ok}")

        # Negative test 1: Boring chronological opener + literary AI slop
        doc_boring = json.loads(json.dumps(doc_ok))
        doc_boring["parts"][0]["coldHook"]["openingLine"] = "Đêm cuối năm 2003, trời mưa tầm tã khiến tôi cảm thấy một cảm giác lạnh lẽo bao trùm."
        _, f_boring = horror_story.evaluate_gates(doc_boring, stage="full", strict_story=True)
        self.assertIn("viral-hook-and-oral-authenticity", {g["id"] for g in f_boring})

        # Negative test 2: Platform-banned slur under platform_safe_raw
        doc_slur = json.loads(json.dumps(doc_ok))
        doc_slur["parts"][0]["actionBeats"][1]["spokenBeat"]["keyPhrase"] = "Cái đéo gì đang gõ cửa ngoài kia vậy!"
        _, f_slur = horror_story.evaluate_gates(doc_slur, stage="full", strict_story=True)
        self.assertIn("viral-hook-and-oral-authenticity", {g["id"] for g in f_slur})

        # Blueprint export for viral_short P1 must start with immediate Hook (no [VISUAL 2.60s] opener) & shot 1 = cold_hook
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "story.json")
            bp_dir = os.path.join(td, "bp")
            horror_story.write_text(sp, json.dumps(doc_ok, ensure_ascii=False, indent=2))
            horror_story.cmd_export_blueprint(horror_story.argparse.Namespace(
                story=sp, out=bp_dir, part=1, all_parts=False, project_id="may-204-test", aspect="9:16", bed_sound="night_wind_draft"
            ))
            with open(os.path.join(bp_dir, "SCRIPT.skeleton.md"), encoding="utf-8") as fp:
                sk = fp.read()
            with open(os.path.join(bp_dir, "manifest.draft.json"), encoding="utf-8") as fp:
                man = json.load(fp)
            self.assertNotIn("[VISUAL 2.60s]", sk)
            self.assertEqual(man["shots"][0]["cameraMode"], "cold_hook")
            self.assertEqual(man["shots"][1]["cameraMode"], "master")


if __name__ == "__main__":
    unittest.main()
