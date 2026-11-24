import filecmp
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
import wave

import numpy as np

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRIPTS_DIR = os.path.join(REPO_ROOT, "templates", "scripts")
AUDIO_DIR = os.path.join(REPO_ROOT, "templates", "audio")

for p in (SCRIPTS_DIR, AUDIO_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

import gen_horror_voice as ghv  # noqa: E402
import align_manifest as am  # noqa: E402
import horror_instruments as hi  # noqa: E402
import mix_base as mb  # noqa: E402
import dsp  # noqa: E402


SAMPLE_EXPRESSIVE_SCRIPT = """# Demo Expressive Horror Script
[NARRATOR | mood=calm_omen]
Đêm canh linh cữu lúc 01:06 ngày 22/11, cả ngôi nhà tối om.
[PAUSE 0.30s]
[NARRATOR | mood=whisper]
Nhưng rồi... ngọn đèn dầu bỗng tắt phụt.
[DEAD SILENCE 0.75s]
[SPEAKER: BÓNG NGƯỜI | voice=vi-VN-NamMinhNeural | mood=ghost_entity | fx=ghost]
Mở cửa ra... cháu ơi.
[NARRATOR | mood=panic]
Cánh cửa gỗ rung bần bật ngay trước mặt tôi!
[NARRATOR | mood=cold_twist]
Nhưng phía sau cánh cửa... chẳng có ai cả.
"""


def make_synthetic_speech_fn(base_freq=185.0):
    """Offline deterministic voice synthesizer mocking edge-tts with constant RMS so mood gains are cleanly verifiable."""
    def _synth(item, sr, idx):
        tokens = [t for t in item["text"].split() if t]
        dur = max(0.45, 0.24 * len(tokens))
        n = int(round(dur * sr))
        t = np.arange(n, dtype=np.float64) / float(sr)
        f0 = base_freq + (idx % 5) * 14.0
        sig = (
            0.60 * np.sin(2.0 * np.pi * f0 * t)
            + 0.25 * np.sin(2.0 * np.pi * (2.0 * f0) * t)
            + 0.12 * np.sin(2.0 * np.pi * (3.0 * f0) * t)
        )
        # Gentle fade in/out so there are no edge clicks
        fade = min(int(0.015 * sr), max(1, n // 8))
        sig[:fade] *= np.linspace(0.0, 1.0, fade)
        sig[-fade:] *= np.linspace(1.0, 0.0, fade)
        words = ghv.estimate_syllable_words(item["text"], dur, 0.0, item["speaker"], item["mood"])
        return sig, words

    return _synth


def rms_db(samples: np.ndarray) -> float:
    val = float(np.sqrt(np.mean(np.square(samples)) + 1e-18))
    return 20.0 * np.log10(max(val, 1e-9))


class TestPhase2Pipeline(unittest.TestCase):
    def test_vi_pronunciation_normalizer(self):
        self.assertIn("một giờ sáu phút", ghv.normalize_vi_for_tts("Lúc 01:06 đêm"))
        self.assertIn("hai mươi hai giờ mười phút", ghv.normalize_vi_for_tts("22:10 rồi"))
        self.assertIn("ngày hai mươi hai tháng mười một", ghv.normalize_vi_for_tts("Hôm 22/11"))
        self.assertIn("ngày hai mươi hai tháng mười một năm 1998", ghv.normalize_vi_for_tts("22/11/1998"))

    def test_parse_script_moods_speakers_ellipsis_and_dead_silence(self):
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(SAMPLE_EXPRESSIVE_SCRIPT)
            items = ghv.parse_script(sp, default_voice="vi-VN-NamMinhNeural", ellipsis_pause=0.42)

        kinds = [it["kind"] for it in items]
        self.assertIn("dead_silence", kinds)
        self.assertIn("pause", kinds)
        ds = [it for it in items if it["kind"] == "dead_silence"]
        self.assertEqual(len(ds), 1)
        self.assertAlmostEqual(ds[0]["dur"], 0.75, places=2)

        # Mid-sentence `...` should have inserted real 0.42s pauses
        ellipsis_pauses = [it for it in items if it["kind"] == "pause" and abs(it["dur"] - 0.42) < 1e-3]
        self.assertGreaterEqual(len(ellipsis_pauses), 3)

        # Ghost speaker directive preserved with fx=ghost and is_narrator=False
        ghost_lines = [it for it in items if it["kind"] == "speech" and it["speaker"] == "BÓNG NGƯỜI"]
        self.assertGreaterEqual(len(ghost_lines), 2)
        self.assertTrue(all(not it["is_narrator"] and it["fx"] == "ghost" and it["mood"] == "ghost_entity" for it in ghost_lines))

        # Narrator mood variety preserved
        narr_moods = {it["mood"] for it in items if it["kind"] == "speech" and it["is_narrator"]}
        self.assertTrue({"calm_omen", "whisper", "panic", "cold_twist"}.issubset(narr_moods))

    def test_vc_pack_roundtrip_dynamic_loudness_and_narrator_cue_sheet(self):
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(SAMPLE_EXPRESSIVE_SCRIPT)

            items = ghv.parse_script(sp)

            # Export narrator cue sheet
            cue_txt = os.path.join(td, "narrator_cue.txt")
            ghv.export_narrator_script(items, cue_txt)
            with open(cue_txt, encoding="utf-8") as fp:
                cue_content = fp.read()
            self.assertIn("N01 [calm_omen]", cue_content)
            self.assertIn("whisper", cue_content)
            self.assertIn("panic", cue_content)

            # Step 1: Export 1-file So-VITS-SVC Expressive VC-Pack
            pack_dir = os.path.join(td, "vc_pack")
            args1 = ghv.build_parser().parse_args(["--script", sp, "--export-vc-pack", pack_dir])
            guide_wav, mf_path = ghv.export_vc_pack(items, pack_dir, td, args1, synth_fn=make_synthetic_speech_fn())
            self.assertTrue(os.path.isfile(guide_wav))
            self.assertTrue(os.path.isfile(mf_path))

            # Helper scripts MUST pass -na (--no-auto-predict-f0) and NEVER -a!
            for helper in ("run_svc_win.bat", "run_svc_unix.sh"):
                with open(os.path.join(pack_dir, helper), encoding="utf-8") as fp:
                    txt = fp.read()
                self.assertIn(" -na ", txt, f"{helper} must use -na to preserve horror F0 pitch")
                self.assertNotIn(" -a ", txt, f"{helper} must not use -a")

            # Step 2 (Simulated So-VITS-SVC PC): transform guide WAV preserving exact sample count
            guide_arr = ghv.load_audio_mono(guide_wav, ghv.SR_VC)
            svc_sim = np.tanh(guide_arr * 1.15) * 0.88
            svc_out_wav = os.path.join(pack_dir, "narrator_svc_out.wav")
            ghv.write_wav_mono16(svc_out_wav, svc_sim, ghv.SR_VC)

            # Step 3: Exact 1:1 re-assembly + character dialogue + mood loudness + breaths
            out_dir = os.path.join(td, "voice_out")
            args3 = ghv.build_parser().parse_args([
                "--script", sp,
                "--vc-pack", pack_dir,
                "--narrator-vc-wav", svc_out_wav,
                "--out-dir", out_dir,
            ])
            final_wav, words_json, payload = ghv.assemble_voice(items, args3, td, synth_fn=make_synthetic_speech_fn(240.0))

            self.assertTrue(payload["engine"].startswith("horror-voice-v5"))
            self.assertEqual(payload["narrator_source"], "vc_pack_external")
            self.assertEqual(len(payload["dead_silences"]), 1)
            ds = payload["dead_silences"][0]
            self.assertAlmostEqual(ds["e"] - ds["s"], 0.75, places=2)

            # Verify 48 kHz mono 16-bit WAV format
            with wave.open(final_wav, "rb") as wf:
                self.assertEqual(wf.getnchannels(), 1)
                self.assertEqual(wf.getsampwidth(), 2)
                self.assertEqual(wf.getframerate(), 48000)

            # Verify display tokens (01:06) & speaker/mood metadata preserved in words.json
            words = payload["words"]
            self.assertTrue(any("01:06" in w["w"] for w in words))
            self.assertTrue(all("speaker" in w and "mood" in w for w in words))

            # Verify expressive dynamic loudness: panic line MUST be >= 5 dB louder than whisper line!
            wav_arr = ghv.load_audio_mono(final_wav, 48000)
            whisper_sents = [s for s in payload["sentences"] if s["mood"] == "whisper"]
            panic_sents = [s for s in payload["sentences"] if s["mood"] == "panic"]
            self.assertTrue(whisper_sents and panic_sents)

            w_seg = wav_arr[int(whisper_sents[0]["s"] * 48000) : int(whisper_sents[0]["e"] * 48000)]
            p_seg = wav_arr[int(panic_sents[0]["s"] * 48000) : int(panic_sents[0]["e"] * 48000)]
            diff_db = rms_db(p_seg) - rms_db(w_seg)
            self.assertGreaterEqual(diff_db, 5.0, f"Expected panic >= 5 dB louder than whisper, got {diff_db:.2f} dB")

    def test_narrator_dir_and_narrator_audio_vad_modes(self):
        short_script = (
            "[NARRATOR | mood=calm_omen]\n"
            "Đêm nay rất lạnh.\n"
            "[DEAD SILENCE 0.60s]\n"
            "[NARRATOR | mood=panic]\n"
            "Có tiếng gõ ngoài cửa!\n"
        )
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(short_script)
            items = ghv.parse_script(sp)

            # Mode A: --narrator-dir (N01.wav, N02.wav)
            ndir = os.path.join(td, "narr_clips")
            os.makedirs(ndir)
            t1 = np.arange(int(0.8 * ghv.SR_VC)) / float(ghv.SR_VC)
            clip1 = 0.25 * np.sin(2.0 * np.pi * 190.0 * t1)
            clip2 = 0.25 * np.sin(2.0 * np.pi * 240.0 * t1)
            ghv.write_wav_mono16(os.path.join(ndir, "N01.wav"), clip1, ghv.SR_VC)
            ghv.write_wav_mono16(os.path.join(ndir, "N02.wav"), clip2, ghv.SR_VC)

            out_dir_a = os.path.join(td, "out_dir_mode")
            args_a = ghv.build_parser().parse_args(["--script", sp, "--narrator-dir", ndir, "--out-dir", out_dir_a])
            wav_a, _, payload_a = ghv.assemble_voice(items, args_a, td)
            self.assertTrue(os.path.isfile(wav_a))
            self.assertEqual(payload_a["narrator_source"], "narrator_dir")
            self.assertEqual(len(payload_a["sentences"]), 2)

            # Mode B: --narrator-audio (single WAV split automatically via VAD)
            combined = np.concatenate([clip1, np.zeros(int(0.45 * ghv.SR_VC)), clip2])
            comb_wav = os.path.join(td, "narr_full.wav")
            ghv.write_wav_mono16(comb_wav, combined, ghv.SR_VC)
            out_dir_b = os.path.join(td, "out_vad_mode")
            args_b = ghv.build_parser().parse_args(["--script", sp, "--narrator-audio", comb_wav, "--out-dir", out_dir_b])
            wav_b, _, payload_b = ghv.assemble_voice(items, args_b, td)
            self.assertTrue(os.path.isfile(wav_b))
            self.assertEqual(payload_b["narrator_source"], "narrator_audio")
            self.assertEqual(len(payload_b["sentences"]), 2)

    def test_synth_breath_and_voice_fx_dsp(self):
        for kind in ("soft_inhale", "sharp_gasp", "shaky_exhale"):
            b = ghv.synth_breath(kind, ghv.SR_VC, seed=42)
            self.assertGreater(len(b), 1000)
            self.assertTrue(np.all(np.isfinite(b)))
            self.assertGreater(float(np.max(np.abs(b))), 0.05)

        t = np.arange(ghv.SR_VC) / float(ghv.SR_VC)
        src = 0.25 * np.sin(2.0 * np.pi * 220.0 * t)
        for fx, mood in (("dry", "calm_omen"), ("room", "tense"), ("phone", "tense"), ("ghost", "ghost_entity"), ("dry", "whisper"), ("dry", "cold_twist")):
            out = ghv.apply_voice_fx(src, ghv.SR_VC, fx=fx, mood=mood)
            self.assertTrue(np.all(np.isfinite(out)))
            self.assertGreater(float(np.max(np.abs(out))), 0.01)
            if fx == "ghost":
                # Ghost reverse-reverb pre-swell lengthens buffer
                self.assertGreater(len(out), len(src))

    def test_true_dead_silence_vacuum_in_master_mix(self):
        dur = 4.5
        n = dsp.ns(dur)
        t = np.arange(n, dtype=np.float64) / float(dsp.SR)
        # Continuous music drone + ambient SFX bed across entire duration
        music = dsp.st(0.18 * np.sin(2.0 * np.pi * 55.0 * t))
        sfx = dsp.st(0.12 * np.sin(2.0 * np.pi * 320.0 * t))
        # Voice speaking only outside [2.0s..2.75s]
        v_mono = np.zeros(n, dtype=np.float64)
        v_mono[: dsp.ns(1.9)] = 0.22 * np.sin(2.0 * np.pi * 210.0 * t[: dsp.ns(1.9)])
        v_mono[dsp.ns(2.8) :] = 0.22 * np.sin(2.0 * np.pi * 210.0 * t[dsp.ns(2.8) :])
        voice = dsp.st(v_mono)

        with tempfile.TemporaryDirectory() as td:
            wj = os.path.join(td, "words.json")
            with open(wj, "w", encoding="utf-8") as fp:
                json.dump({"words": [], "dead_silences": [{"s": 2.0, "e": 2.75}]}, fp)
            ds = mb.load_dead_silences(wj)

        self.assertEqual(len(ds), 1)
        final_mix, stems, stats = mb.master_mix(
            voice, music, sfx,
            target_lufs=-15.0, ceil_db=-1.2,
            dead_silences=ds, ds_floor_db=-48.0,
        )
        self.assertTrue(np.all(np.isfinite(final_mix)))

        # Measure combined music+sfx RMS inside core dead silence [2.08..2.67] vs outside [0.5..1.5]
        bed = stems["music"] + stems["sfx"]
        inside_db = rms_db(bed[:, dsp.ns(2.08) : dsp.ns(2.67)])
        outside_db = rms_db(bed[:, dsp.ns(0.50) : dsp.ns(1.50)])
        self.assertLessEqual(inside_db, -40.0, f"Dead silence bed must hit vacuum <= -40 dBFS, got {inside_db:.2f} dBFS")
        self.assertGreaterEqual(outside_db - inside_db, 38.0, f"Expected >= 38 dB drop in Dead Silence, got {outside_db - inside_db:.2f} dB")

    def test_v5_four_new_horror_sfx(self):
        r = dsp.rng(505)
        clips = [
            hi.vhs_static_burst(dur=0.45, vel=0.55, r=r),
            hi.flashlight_click_sputter(dur=0.60, vel=0.65, r=r, kind="off"),
            hi.flashlight_click_sputter(dur=0.60, vel=0.65, r=r, kind="on"),
            hi.neck_crack_wet(dur=0.55, vel=0.72, r=r),
            hi.fly_buzz_loop(dur=1.5, vel=0.22, r=r),
        ]
        for arr in clips:
            self.assertEqual(arr.ndim, 2)
            self.assertEqual(arr.shape[0], 2)
            self.assertGreater(arr.shape[1], 1000)
            self.assertTrue(np.all(np.isfinite(arr)))
            self.assertGreater(float(np.max(np.abs(arr))), 0.05)

    def test_align_manifest_locks_to_words_and_passes_validator(self):
        with tempfile.TemporaryDirectory() as td:
            script_path = os.path.join(td, "SCRIPT.md")
            with open(script_path, "w", encoding="utf-8") as fp:
                fp.write(
                    "[NARRATOR | mood=calm_omen]\nĐêm canh nhà tối om.\n"
                    "[DEAD SILENCE 0.60s]\n"
                    "[NARRATOR | mood=panic]\nCó người đứng sau cửa.\n"
                )
            words = [
                {"w": "Đêm", "s": 0.10, "e": 0.35},
                {"w": "canh", "s": 0.36, "e": 0.62},
                {"w": "nhà", "s": 0.63, "e": 0.90},
                {"w": "tối", "s": 0.91, "e": 1.15},
                {"w": "om.", "s": 1.16, "e": 1.45},
                {"w": "Có", "s": 2.25, "e": 2.45},
                {"w": "người", "s": 2.46, "e": 2.75},
                {"w": "đứng", "s": 2.76, "e": 3.05},
                {"w": "sau", "s": 3.06, "e": 3.30},
                {"w": "cửa.", "s": 3.31, "e": 3.65},
            ]
            words_path = os.path.join(td, "words.json")
            with open(words_path, "w", encoding="utf-8") as fp:
                json.dump({"fps": 30, "total_frames": 126, "words": words, "dead_silences": [{"s": 1.55, "e": 2.15}]}, fp)

            # Intentionally drifted manifest frames (bad a/b/totalFrames)
            manifest = {
                "projectId": "align-demo-v5",
                "title": "Align Demo",
                "fps": 30,
                "totalFrames": 90,
                "locations": [
                    {
                        "id": "locA",
                        "archetype": "oldBoardingRoom",
                        "dimensions": [4.2, 5.4, 3.0],
                        "ceilingType": "flatConcrete",
                        "materials": {"wall": "mottledPlaster", "floor": "vintagePatternTile", "ceiling": "concreteCeiling"},
                        "practicalLights": ["oilLamp"],
                        "heroProps": ["woodenDoor", "oilLamp", "rustedBolt"],
                        "signatureShadowBeat": "Moonlight strip blocked by two dark shadows",
                    }
                ],
                "castBlueprints": [
                    {
                        "id": "ghostDoor",
                        "role": "silhouette",
                        "storyDescription": "Bóng người mảnh khảnh đứng sau khe cửa tối",
                        "appearance": {"entity": {"silhouetteMode": True, "eyeGlow": True}},
                    }
                ],
                "beats": [
                    {
                        "beatId": "B1",
                        "shotId": "s1",
                        "a": 0,
                        "b": 30,
                        "peakFrame": 15,
                        "locationId": "locA",
                        "spokenLine": {"speaker": "NARRATOR", "text": "Đêm canh nhà tối om."},
                        "lightState": {"preset": "warmLamp", "lampsOn": ["oilLamp"], "blendTo": "coldMoon", "blendRange": [20, 29]},
                        "castStates": {},
                        "propStates": {},
                        "cameraIntent": "POV intro",
                    },
                    {
                        "beatId": "B2",
                        "shotId": "s2",
                        "a": 30,
                        "b": 90,
                        "peakFrame": 60,
                        "locationId": "locA",
                        "spokenLine": {"speaker": "NARRATOR", "text": "Có người đứng sau cửa."},
                        "lightState": {"preset": "coldMoon", "lampsOn": []},
                        "castStates": {"ghostDoor": {"visible": True, "pose": "doorwayPeek"}},
                        "propStates": {},
                        "cameraIntent": "Door reveal",
                    },
                ],
            }
            mf_path = os.path.join(td, "manifest.json")
            with open(mf_path, "w", encoding="utf-8") as fp:
                json.dump(manifest, fp, ensure_ascii=False, indent=2)

            # Run align_manifest.py --in-place
            r_align = subprocess.run(
                [sys.executable, os.path.join(SCRIPTS_DIR, "align_manifest.py"), mf_path, "--words", words_path, "--in-place"],
                capture_output=True, text=True,
            )
            self.assertEqual(r_align.returncode, 0, r_align.stdout + r_align.stderr)

            # Now validate_manifest.py MUST pass with zero timing errors!
            r_val = subprocess.run(
                [
                    sys.executable, os.path.join(SCRIPTS_DIR, "validate_manifest.py"), mf_path,
                    "--script", script_path,
                    "--words", words_path,
                ],
                capture_output=True, text=True,
            )
            self.assertEqual(r_val.returncode, 0, r_val.stdout + r_val.stderr)

    def test_sync_workspace_syncs_checks_and_preserves_user_stories(self):
        sync_py = os.path.join(SCRIPTS_DIR, "sync_workspace.py")
        with tempfile.TemporaryDirectory() as td:
            ws = os.path.join(td, "ws")
            # Initial sync
            r1 = subprocess.run([sys.executable, sync_py, "--target", ws, "--include-demo"], capture_output=True, text=True)
            self.assertEqual(r1.returncode, 0, r1.stdout + r1.stderr)

            # Create custom user story directory that MUST NEVER be touched
            user_story = os.path.join(ws, "src", "my-custom-story", "story.ts")
            os.makedirs(os.path.dirname(user_story), exist_ok=True)
            with open(user_story, "w", encoding="utf-8") as fp:
                fp.write("// user custom story\n")

            # Drift check should pass cleanly
            r2 = subprocess.run([sys.executable, sync_py, "--target", ws, "--include-demo", "--check"], capture_output=True, text=True)
            self.assertEqual(r2.returncode, 0, r2.stdout + r2.stderr)

            # Modify a synced file -> --check MUST detect drift (exit != 0)
            target_eng = os.path.join(ws, "src", "engine", "index.ts")
            with open(target_eng, "a", encoding="utf-8") as fp:
                fp.write("\n// drift\n")
            r3 = subprocess.run([sys.executable, sync_py, "--target", ws, "--include-demo", "--check"], capture_output=True, text=True)
            self.assertNotEqual(r3.returncode, 0)

            # Re-sync -> fixes drift while leaving user story untouched
            r4 = subprocess.run([sys.executable, sync_py, "--target", ws, "--include-demo"], capture_output=True, text=True)
            self.assertEqual(r4.returncode, 0, r4.stdout + r4.stderr)
            r5 = subprocess.run([sys.executable, sync_py, "--target", ws, "--include-demo", "--check"], capture_output=True, text=True)
            self.assertEqual(r5.returncode, 0, r5.stdout + r5.stderr)
            with open(user_story, encoding="utf-8") as fp:
                self.assertEqual(fp.read(), "// user custom story\n")

    def test_horror_story_v5_example_export_and_script_sync(self):
        t_story_py = os.path.join(SCRIPTS_DIR, "horror_story.py")
        c_story_py = os.path.join(REPO_ROOT, "companion-skills", "horror-story", "scripts", "horror_story.py")
        self.assertTrue(filecmp.cmp(t_story_py, c_story_py, shallow=False), "horror_story.py copies must stay identical")

        example_json = os.path.join(REPO_ROOT, "companion-skills", "horror-story", "examples", "ong-ke-story.json")
        r_val = subprocess.run([sys.executable, t_story_py, "validate", example_json, "--stage", "full"], capture_output=True, text=True)
        self.assertEqual(r_val.returncode, 0, r_val.stdout + r_val.stderr)

        with tempfile.TemporaryDirectory() as td:
            out_json = os.path.join(td, "OUTLINE.json")
            r_exp = subprocess.run(
                [sys.executable, t_story_py, "export-outline", example_json, "--aspect", "9:16", "--out", out_json],
                capture_output=True, text=True,
            )
            self.assertEqual(r_exp.returncode, 0, r_exp.stdout + r_exp.stderr)
            with open(out_json, encoding="utf-8") as fp:
                outline = json.load(fp)
            self.assertIn("locations", outline)
            self.assertIn("castAppearanceBriefs", outline)
            self.assertGreaterEqual(len(outline["castAppearanceBriefs"]), 2)
            self.assertTrue(all(c.get("appearanceBrief") for c in outline["castAppearanceBriefs"]))

    def test_documentation_hygiene_zero_legacy_v2_references(self):
        banned_re = re.compile(
            r'toon\.ts|cardshade|Pen\.grit|EraGroup|shared/toon|bodyBack|action:\s*"peer"|glance:\s*1|"blood"|Gothic Ink-Noir|Horror Engine v2'
        )
        doc_paths = [
            os.path.join(REPO_ROOT, "SKILL.md"),
            os.path.join(REPO_ROOT, "README.md"),
            os.path.join(REPO_ROOT, "templates", "project", "GEMINI.md"),
        ]
        for root_sub in ("companion-skills", "references"):
            for rdir, _, files in os.walk(os.path.join(REPO_ROOT, root_sub)):
                for fn in files:
                    if fn.endswith(".md"):
                        doc_paths.append(os.path.join(rdir, fn))

        hits = []
        for dp in sorted(set(doc_paths)):
            with open(dp, encoding="utf-8") as fp:
                txt = fp.read()
            for m in banned_re.finditer(txt):
                line_no = txt.count("\n", 0, m.start()) + 1
                hits.append(f"{os.path.relpath(dp, REPO_ROOT)}:{line_no}: {m.group(0)!r}")
        self.assertEqual(hits, [], "Found stale legacy v2 references in docs:\n" + "\n".join(hits))

    def test_v55_inline_director_tags_and_stutter_parser(self):
        script = (
            "[NARRATOR | mood=curious]\n"
            "Ơ... tiếng gì trong tủ gỗ vậy?\n"
            "[NARRATOR | mood=fear_tremble]\n"
            "[GASP] Tay tôi run quá [TREMBLE] nó đang mở cửa! [/TREMBLE]\n"
            "[NARRATOR | mood=stutter_panic]\n"
            "K-không... [STUTTER] cái gì ngoài đó vậy?! [FAST] Chạy ngay đi! [/FAST]\n"
            "[NARRATOR | mood=cold_twist]\n"
            "[SWALLOW] [SLOW] Nó đứng sau lưng tôi. [/SLOW] [BEAT]\n"
        )
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(script)
            items = ghv.parse_script(sp)

        cues = [it["cue"] for it in items if it["kind"] == "cue"]
        self.assertIn("gasp", cues)
        self.assertIn("swallow", cues)
        self.assertTrue(any(it["kind"] == "pause" and it.get("from_beat") for it in items))

        speech = [it for it in items if it["kind"] == "speech"]
        # Curious question must auto-set force_up
        cur_items = [it for it in speech if it["mood"] == "curious" and "?" in it["text"]]
        self.assertTrue(cur_items and cur_items[0]["force_up"])

        # Hyphen stutter `K-không` sends clean `"không"` to TTS while keeping `"K-không"` display & stutter_map!
        k_items = [it for it in speech if "K-không" in it["text"]]
        self.assertTrue(k_items)
        self.assertNotIn("K-", k_items[0]["tts_text"])
        self.assertIn("không", k_items[0]["tts_text"])
        self.assertIn(0, k_items[0]["stutter_map"])

        # Explicit `[STUTTER] cái gì` strips tag cleanly and marks word 0
        st_items = [it for it in speech if "cái gì" in it["text"]]
        self.assertTrue(st_items)
        self.assertNotIn("[STUTTER]", st_items[0]["text"])
        self.assertNotIn("[STUTTER]", st_items[0]["tts_text"])
        self.assertIn(0, st_items[0]["stutter_map"])

        # Inline [FAST], [SLOW], [TREMBLE] flags preserved
        self.assertTrue(any(it["inline_speed_mult"] > 1.2 for it in speech))
        self.assertTrue(any(it["inline_speed_mult"] < 0.8 for it in speech))
        self.assertTrue(any(it["force_tremble"] for it in speech))

    def test_v55_wide_tempo_spread_and_intra_sentence_pacing(self):
        line_text = "Cánh cửa gỗ cũ cuối hành lang đột ngột bật mở ngay trước mắt tôi."
        synth = make_synthetic_speech_fn(190.0)
        args = ghv.build_parser().parse_args(["--script", "dummy.md", "--acting", "cinematic"])
        it_slow = {
            "kind": "speech", "text": line_text, "tts_text": line_text,
            "speaker": "NARRATOR", "is_narrator": True, "voice": "v", "mood": "cold_twist",
            "pitch": None, "rate": None, "speed": None, "inline_speed_mult": 1.0,
            "force_tremble": False, "force_up": False, "stutter_map": {}, "fx": "dry",
        }
        it_fast = {**it_slow, "mood": "panic"}
        seg_slow, w_slow = ghv.synth_line_auto(it_slow, ghv.SR_VC, None, 0, args, synth_fn=synth)
        seg_fast, w_fast = ghv.synth_line_auto(it_fast, ghv.SR_VC, None, 1, args, synth_fn=synth)

        dur_slow = len(seg_slow) / float(ghv.SR_VC)
        dur_fast = len(seg_fast) / float(ghv.SR_VC)
        # Panic must be at least 38% shorter (much faster!) than cold_twist on identical text!
        self.assertLessEqual(dur_fast, dur_slow * 0.62, f"Expected wide tempo contrast: fast={dur_fast:.2f}s vs slow={dur_slow:.2f}s")
        self.assertEqual(len(w_slow), len(w_fast))

    def test_v55_true_whisper_vocoder_hf_air_and_envelope_preservation(self):
        sr = ghv.SR_VC
        t = np.arange(sr, dtype=np.float64) / float(sr)
        # Modulated voiced speech proxy (syllable envelope at 4 Hz, fundamental 160 Hz)
        syll_env = 0.5 + 0.5 * np.sin(2.0 * np.pi * 4.0 * t)
        voiced = (0.7 * np.sin(2.0 * np.pi * 160.0 * t) + 0.3 * np.sin(2.0 * np.pi * 480.0 * t)) * syll_env
        wh = ghv.apply_true_whisper(voiced, sr, mix=0.58)
        self.assertEqual(len(wh), len(voiced))
        self.assertTrue(np.all(np.isfinite(wh)))
        # High-frequency breathy air band (2500-7000 Hz) must increase dramatically compared to pure tonal voiced input!
        hf_in = float(np.sqrt(np.mean(ghv._bp(voiced, 2500.0, 7000.0, sr, 2) ** 2)))
        hf_out = float(np.sqrt(np.mean(ghv._bp(wh, 2500.0, 7000.0, sr, 2) ** 2)))
        self.assertGreater(hf_out, hf_in * 8.0 + 0.01)

    def test_v55_vocal_tremor_6hz_and_curious_pitch_ramp(self):
        sr = ghv.SR_VC
        t = np.arange(int(1.2 * sr), dtype=np.float64) / float(sr)
        src = 0.35 * np.sin(2.0 * np.pi * 210.0 * t)
        trem = ghv.apply_vocal_tremor(src, sr, rate_hz=6.2, fm_semi=0.45, am_depth=0.28, strength=1.0)
        self.assertEqual(len(trem), len(src))
        self.assertTrue(np.all(np.isfinite(trem)))
        # Envelope modulation energy around 5-8 Hz must be substantially higher than flat sine input
        env_in = ghv._lp(np.abs(src), 20.0, sr, 2)
        env_tr = ghv._lp(np.abs(trem), 20.0, sr, 2)
        self.assertGreater(float(np.std(env_tr[4000:-4000])), float(np.std(env_in[4000:-4000])) * 4.0)

        ramped = ghv.apply_pitch_ramp(src, sr, tail_sec=0.45, end_semi=2.4)
        self.assertEqual(len(ramped), len(src))
        self.assertTrue(np.all(np.isfinite(ramped)))
        self.assertGreater(float(np.max(np.abs(ramped))), 0.15)

    def test_v55_acoustic_syllable_stutter_and_word_timestamp_shift(self):
        sr = ghv.SR_VC
        t = np.arange(int(1.0 * sr), dtype=np.float64) / float(sr)
        seg = 0.30 * np.sin(2.0 * np.pi * 220.0 * t)
        words = [
            {"w": "K-không", "s": 0.05, "e": 0.45, "speaker": "NARRATOR", "mood": "stutter_panic"},
            {"w": "phải!", "s": 0.48, "e": 0.92, "speaker": "NARRATOR", "mood": "stutter_panic"},
        ]
        stut_seg, stut_words = ghv.apply_syllable_stutter(seg, words, {0: 2}, sr, acting_scale=1.0)
        added_s = (len(stut_seg) - len(seg)) / float(sr)
        self.assertGreater(added_s, 0.25)
        self.assertLess(added_s, 0.65)
        # Downstream word shifted accurately by +added_s
        self.assertAlmostEqual(stut_words[1]["s"] - words[1]["s"], added_s, places=2)
        self.assertLess(stut_words[0]["s"], stut_words[0]["e"])
        self.assertLess(stut_words[0]["e"], stut_words[1]["s"] + 0.06)

    def test_v55_gemini_tts_mock_and_automatic_edge_fallback(self):
        import base64
        from unittest import mock

        # Build mock Gemini REST response carrying 24kHz PCM16 sine wave
        pcm_t = np.arange(12000, dtype=np.float64) / 24000.0
        pcm_i16 = np.round(0.35 * np.sin(2.0 * np.pi * 200.0 * pcm_t) * 32767.0).astype("<i2").tobytes()
        mock_payload = json.dumps({
            "candidates": [{
                "content": {
                    "parts": [{
                        "inlineData": {
                            "mimeType": "audio/L16;rate=24000",
                            "data": base64.b64encode(pcm_i16).decode("ascii"),
                        }
                    }]
                }
            }]
        }).encode("utf-8")

        class _FakeResp:
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def read(self): return mock_payload

        item = {
            "kind": "speech", "text": "Ai ngoài đó vậy?", "tts_text": "Ai ngoài đó vậy?",
            "speaker": "NARRATOR", "is_narrator": True, "voice": "v", "mood": "curious",
            "acting": None, "pitch": None, "rate": None, "speed": None,
            "inline_speed_mult": 1.0, "force_tremble": False, "force_up": True, "stutter_map": {}, "fx": "dry",
        }
        with tempfile.TemporaryDirectory() as td:
            with mock.patch("urllib.request.urlopen", return_value=_FakeResp()):
                x, w = ghv.synth_gemini_chunk(item, ghv.SR_VC, td, 0, api_key="fake-key", cache_dir=td)
            self.assertGreater(len(x), 15000)
            self.assertEqual(len(w), 4)

            # Verify automatic fallback from failing Gemini -> edge chunk on cache miss when urlopen raises
            miss_cache = os.path.join(td, "miss_cache")
            args = ghv.build_parser().parse_args(["--script", "dummy.md", "--tts-engine", "gemini", "--gemini-api-key", "fake"])
            with mock.patch("urllib.request.urlopen", side_effect=RuntimeError("429 quota")), \
                 mock.patch.object(ghv, "synth_edge_chunk", return_value=(np.ones(8000) * 0.2, w)) as m_edge:
                x2, w2 = ghv.synth_line_auto(item, ghv.SR_VC, td, 0, args, cache_dir=miss_cache)
            m_edge.assert_called_once()
            self.assertEqual(len(x2), 8000)

    def test_v55_export_acting_pack_and_human_cues(self):
        for cue in ("soft_inhale", "short_inhale", "sharp_gasp", "tremble_gasp", "shaky_exhale", "whisper_breath", "swallow", "sigh"):
            arr = ghv.synth_human_cue(cue, ghv.SR_VC, seed=7)
            self.assertGreater(len(arr), 1000)
            self.assertTrue(np.all(np.isfinite(arr)))
            self.assertGreater(float(np.max(np.abs(arr))), 0.05)

        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(SAMPLE_EXPRESSIVE_SCRIPT)
            items = ghv.parse_script(sp)
            ap_json = ghv.export_acting_pack(items, os.path.join(td, "acting_pack"))
            with open(ap_json, encoding="utf-8") as fp:
                ap_data = json.load(fp)
            self.assertEqual(ap_data["version"], "v5.5-acting-pack")
            self.assertGreaterEqual(len(ap_data["lines"]), 5)
            self.assertTrue(all("ref_emotion_clip" in ln and "acting_prompt" in ln for ln in ap_data["lines"]))


if __name__ == "__main__":
    unittest.main()
