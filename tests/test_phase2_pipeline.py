import base64
import filecmp
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import wave

import numpy as np

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRIPTS_DIR = os.path.join(REPO_ROOT, "templates", "scripts")
AUDIO_DIR = os.path.join(REPO_ROOT, "templates", "audio")

for p in (SCRIPTS_DIR, AUDIO_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

import gen_horror_voice as ghv  # noqa: E402
import prepare_emotion_refs as per  # noqa: E402
import curate_emotion_candidates as cec  # noqa: E402
import sfx_manager as sm  # noqa: E402
import align_manifest as am  # noqa: E402
import horror_instruments as hi  # noqa: E402
import mix_base as mb  # noqa: E402
import dsp  # noqa: E402


SAMPLE_COHERENT_SCRIPT = """# Demo Studio-Clean Act-Level Horror Script (v6.0)
[NARRATOR | mood=calm_omen]
Đêm canh linh cữu lúc 01:06 ngày 22/11, cả ngôi nhà tối om.
Ngoài sân gió rít qua từng khe gỗ... bà nội dặn tuyệt đối không được mở cửa.
[PAUSE 0.35s]
[NARRATOR | mood=whisper]
Nhưng rồi, một tiếng cào rất khẽ vang lên từ bên trong tủ gỗ. [thở dài] Tôi nín thở lắng nghe.
[DEAD SILENCE 0.75s]
[SPEAKER: BÓNG NGƯỜI | voice=vi-VN-NamMinhNeural | mood=ghost_entity | fx=ghost]
Mở cửa ra... cháu ơi.
[NARRATOR | mood=panic]
Cánh cửa gỗ rung bần bật ngay trước mặt tôi!
[NARRATOR | mood=cold_twist]
Và khi tôi quay đầu lại, phía sau cánh cửa chẳng có ai cả.
"""


def make_synthetic_speech_fn(base_freq=185.0):
    """Offline clean voice synthesizer mocking neural TTS with uniform RMS."""
    def _synth(item, sr, idx):
        tokens = [t for t in item["text"].split() if t]
        dur = max(0.55, 0.25 * len(tokens))
        n = int(round(dur * sr))
        t = np.arange(n, dtype=np.float64) / float(sr)
        f0 = base_freq + (idx % 5) * 14.0
        sig = (
            0.60 * np.sin(2.0 * np.pi * f0 * t)
            + 0.25 * np.sin(2.0 * np.pi * (2.0 * f0) * t)
            + 0.12 * np.sin(2.0 * np.pi * (3.0 * f0) * t)
        )
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
        # VieNeu tags preserved only when keep_vieneu_tags=True
        self.assertIn("[thở dài]", ghv.normalize_vi_for_tts("Tôi sợ quá [thở dài]", keep_vieneu_tags=True))
        self.assertNotIn("[thở dài]", ghv.normalize_vi_for_tts("Tôi sợ quá [thở dài]", keep_vieneu_tags=False))

    def test_v6_act_level_coherent_grouping_no_fragmentation(self):
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(SAMPLE_COHERENT_SCRIPT)
            items = ghv.parse_script(sp)

        # Consecutive calm_omen lines MUST merge into ONE single coherent Act (NOT split on `...` or newlines!)
        speech = [it for it in items if it["kind"] == "speech"]
        self.assertEqual(len(speech), 5, f"Expected 5 coherent acts, got {len(speech)}")
        self.assertIn("01:06", speech[0]["text"])
        self.assertIn("bà nội dặn", speech[0]["text"])
        self.assertIn("[thở dài]", speech[1]["vieneu_text"])
        self.assertNotIn("[thở dài]", speech[1]["text"])

        # Explicit [DEAD SILENCE] and [PAUSE] still respected accurately
        ds = [it for it in items if it["kind"] == "dead_silence"]
        self.assertEqual(len(ds), 1)
        self.assertAlmostEqual(ds[0]["dur"], 0.75, places=2)

    def test_v6_zero_distortion_clean_voice_fx(self):
        sr = ghv.SR_FINAL
        t = np.arange(sr, dtype=np.float64) / float(sr)
        pure = 0.25 * np.sin(2.0 * np.pi * 220.0 * t)
        # Dry narration in ANY mood (including whisper/fear) MUST NOT inject artificial broadband static noise!
        for mood in ("calm_omen", "curious", "whisper", "fear", "panic", "cold_twist"):
            out = ghv.apply_voice_fx(pure, sr, fx="dry", mood=mood)
            self.assertTrue(np.all(np.isfinite(out)))
            hf_noise = float(np.sqrt(np.mean(ghv._bp(out, 3000.0, 9000.0, sr, 2) ** 2)))
            self.assertLess(hf_noise, 0.002, f"Mood '{mood}' leaked unwanted high-frequency static/distortion ({hf_noise:.5f})")

        # Character spatial FX still work cleanly
        for fx in ("room", "phone", "ghost"):
            out = ghv.apply_voice_fx(pure, sr, fx=fx, mood="ghost_entity")
            self.assertTrue(np.all(np.isfinite(out)))
            self.assertGreater(float(np.max(np.abs(out))), 0.02)
            if fx == "ghost":
                self.assertGreater(len(out), len(pure))

    def test_v6_vieneu_backend_mock_and_emotion_refs_routing(self):
        with tempfile.TemporaryDirectory() as td:
            refs_dir = os.path.join(td, "refs")
            os.makedirs(refs_dir)
            ref_fear = os.path.join(refs_dir, "fear.wav")
            ghv.write_wav_mono16(ref_fear, 0.2 * np.sin(2.0 * np.pi * 180.0 * np.arange(4800) / 48000.0), 48000)

            args = ghv.build_parser().parse_args([
                "--script", "dummy.md", "--tts-engine", "vieneu", "--emotion-refs", refs_dir,
            ])
            item = {
                "kind": "speech",
                "text": "Có ai ở ngoài cửa không?",
                "vieneu_text": "Có ai ở ngoài cửa không? [thở dài]",
                "tts_text": "Có ai ở ngoài cửa không?",
                "speaker": "NARRATOR",
                "is_narrator": True,
                "voice": "v",
                "mood": "fear",
                "ref_audio": None,
                "fx": "dry",
            }
            fake_tts = mock.MagicMock()
            fake_tts.sample_rate = 48000
            fake_tts.infer.return_value = 0.25 * np.sin(2.0 * np.pi * 200.0 * np.arange(48000) / 48000.0)

            with mock.patch.object(ghv, "_get_vieneu", return_value=fake_tts):
                samples, words = ghv.synth_vieneu_chunk(item, ghv.SR_FINAL, args, cache_dir=os.path.join(td, "cache"))

            fake_tts.infer.assert_called_once()
            call_kw = fake_tts.infer.call_args.kwargs
            self.assertEqual(call_kw["ref_audio"], ref_fear)
            self.assertIn("[thở dài]", call_kw["text"])
            self.assertAlmostEqual(call_kw["silence_p"], ghv.MOOD_PROFILES["fear"]["vn_silence_p"], places=2)
            self.assertAlmostEqual(call_kw["temperature"], ghv.MOOD_PROFILES["fear"]["vn_temp"], places=2)
            self.assertGreater(len(samples), 30000)
            self.assertEqual(len(words), 6)

    def test_v61_prepare_emotion_refs_cut_split_auto_and_check(self):
        with tempfile.TemporaryDirectory() as td:
            # Build synthetic 6-clip 1-take recording (each 3.2s speech separated by 1.0s silence)
            sr = 48000
            parts = []
            for idx in range(6):
                t = np.arange(int(3.2 * sr), dtype=np.float64) / float(sr)
                parts.append(0.28 * np.sin(2.0 * np.pi * (160.0 + idx * 25.0) * t))
                if idx < 5:
                    parts.append(np.zeros(int(1.0 * sr), dtype=np.float64))
            src_wav = os.path.join(td, "one_take.wav")
            ghv.write_wav_mono16(src_wav, np.concatenate(parts), sr)

            # 1. Test `split-auto`
            out_auto = os.path.join(td, "refs_auto")
            per.main(["split-auto", "--src", src_wav, "--out-dir", out_auto])
            for slug, _, _ in per.EMOTION_SLOTS:
                p = os.path.join(out_auto, f"{slug}.wav")
                self.assertTrue(os.path.isfile(p), f"Missing auto-split ref {slug}.wav")
                x, s_r = per.read_wav_mono(p)
                self.assertEqual(s_r, 48000)
                self.assertGreaterEqual(len(x) / float(s_r), 2.8)

            # 2. Test `cut` with MM:SS slices
            out_cut = os.path.join(td, "refs_cut")
            per.main(["cut", "--src", src_wav, "--slice", "calm=00:00-00:03.2", "--slice", "fear=00:12.6-00:15.8", "--out-dir", out_cut])
            self.assertTrue(os.path.isfile(os.path.join(out_cut, "calm.wav")))
            self.assertTrue(os.path.isfile(os.path.join(out_cut, "fear.wav")))

            # 3. Test `check` exits cleanly on full bank
            per.main(["check", "--dir", out_auto])

    def test_v61_clean_tempo_contrast_and_human_guide_vc_pack(self):
        sr = 48000
        t = np.arange(int(2.0 * sr), dtype=np.float64) / float(sr)
        base = 0.25 * np.sin(2.0 * np.pi * 200.0 * t)
        slow = ghv.apply_clean_tempo(base, sr, 0.82)
        fast = ghv.apply_clean_tempo(base, sr, 1.08)
        self.assertGreater(len(slow), len(base) * 1.15)
        self.assertLess(len(fast), len(base) * 0.96)
        # Zero broadband distortion introduced by clean rubberband tempo trim
        self.assertLess(float(np.sqrt(np.mean(ghv._bp(slow, 3000.0, 9000.0, sr, 2) ** 2))), 0.004)

        # Test `--human-guide` Voice-to-Voice Directing -> 1-file So-VITS-SVC VC-Pack
        short_script = (
            "[NARRATOR | mood=calm_omen]\nĐêm nay gió rất lớn.\n"
            "[DEAD SILENCE 0.60s]\n"
            "[NARRATOR | mood=panic]\nCó người đứng sau cửa!\n"
        )
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(short_script)
            h_wav = os.path.join(td, "human_take.wav")
            clip = 0.25 * np.sin(2.0 * np.pi * 195.0 * np.arange(int(1.0 * sr)) / float(sr))
            ghv.write_wav_mono16(h_wav, np.concatenate([clip, np.zeros(int(0.6 * sr)), clip]), sr)

            items = ghv.parse_script(sp)
            pack_dir = os.path.join(td, "vc_human")
            args = ghv.build_parser().parse_args(["--script", sp, "--human-guide", h_wav, "--export-vc-pack", pack_dir])
            g_wav, mf_p = ghv.export_vc_pack(items, pack_dir, td, args)
            self.assertTrue(os.path.isfile(g_wav))
            self.assertTrue(os.path.isfile(mf_p))

            out_dir = os.path.join(td, "voice_human")
            args2 = ghv.build_parser().parse_args(["--script", sp, "--human-guide", h_wav, "--out-dir", out_dir, "--no-vc"])
            _, _, payload = ghv.assemble_voice(items, args2, td)
            self.assertEqual(payload["narrator_source"], "human_voice_guide")
            self.assertEqual(len(payload["dead_silences"]), 1)

    def test_v6_gpu_voice_pack_indextts2_and_import_acts_roundtrip(self):
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(SAMPLE_COHERENT_SCRIPT)
            items = ghv.parse_script(sp)

            pack_dir = os.path.join(td, "gpu_voice_pack")
            args_exp = ghv.build_parser().parse_args(["--script", sp, "--export-gpu-voice-pack", pack_dir])
            acts_json = ghv.export_gpu_voice_pack(items, pack_dir, args_exp)
            self.assertTrue(os.path.isfile(acts_json))
            self.assertTrue(os.path.isfile(os.path.join(pack_dir, "run_indextts2_vi.py")))
            self.assertTrue(os.path.isfile(os.path.join(pack_dir, "run_f5tts_vi.py")))

            with open(acts_json, encoding="utf-8") as fp:
                data = json.load(fp)
            self.assertEqual(len(data["acts"]), 5)
            # Every act carries a valid 8-D IndexTTS-2 emotion vector
            self.assertTrue(all(len(a["indextts2_emo_vector"]) == 8 for a in data["acts"]))

            # Simulate GPU PC rendering act_01.wav..act_05.wav and importing cleanly back
            rendered_dir = os.path.join(pack_dir, "rendered_acts")
            os.makedirs(rendered_dir)
            for a in data["acts"]:
                t = np.arange(int(1.0 * 48000)) / 48000.0
                ghv.write_wav_mono16(os.path.join(rendered_dir, a["file"]), 0.25 * np.sin(2.0 * np.pi * 210.0 * t), 48000)

            out_dir = os.path.join(td, "voice_out")
            args_imp = ghv.build_parser().parse_args(["--script", sp, "--import-acts", rendered_dir, "--out-dir", out_dir])
            final_wav, _, payload = ghv.assemble_voice(items, args_imp, td)
            self.assertEqual(payload["engine"], "horror-voice-v6")
            self.assertEqual(payload["narrator_source"], "gpu_acts_imported")
            self.assertEqual(len(payload["dead_silences"]), 1)
            self.assertEqual(len(payload["sentences"]), 5)
            with wave.open(final_wav, "rb") as wf:
                self.assertEqual(wf.getframerate(), 48000)
                self.assertEqual(wf.getnchannels(), 1)

    def test_vc_pack_roundtrip_and_narrator_cue_sheet(self):
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(SAMPLE_COHERENT_SCRIPT)
            items = ghv.parse_script(sp)

            cue_txt = os.path.join(td, "narrator_cue.txt")
            ghv.export_narrator_script(items, cue_txt)
            with open(cue_txt, encoding="utf-8") as fp:
                cue_content = fp.read()
            self.assertIn("N01 [calm_omen]", cue_content)
            self.assertIn("whisper", cue_content)
            self.assertIn("panic", cue_content)

            pack_dir = os.path.join(td, "vc_pack")
            args1 = ghv.build_parser().parse_args(["--script", sp, "--export-vc-pack", pack_dir])
            guide_wav, mf_path = ghv.export_vc_pack(items, pack_dir, td, args1, synth_fn=make_synthetic_speech_fn())
            self.assertTrue(os.path.isfile(guide_wav))
            self.assertTrue(os.path.isfile(mf_path))
            for helper in ("run_svc_win.bat", "run_svc_unix.sh"):
                with open(os.path.join(pack_dir, helper), encoding="utf-8") as fp:
                    txt = fp.read()
                self.assertIn(" -na ", txt)
                self.assertNotIn(" -a ", txt)

            guide_arr = ghv.load_audio_mono(guide_wav, ghv.SR_VC)
            svc_out_wav = os.path.join(pack_dir, "narrator_svc_out.wav")
            ghv.write_wav_mono16(svc_out_wav, guide_arr * 0.92, ghv.SR_VC)

            out_dir = os.path.join(td, "voice_out")
            args3 = ghv.build_parser().parse_args([
                "--script", sp, "--vc-pack", pack_dir, "--narrator-vc-wav", svc_out_wav, "--out-dir", out_dir,
            ])
            final_wav, _, payload = ghv.assemble_voice(items, args3, td, synth_fn=make_synthetic_speech_fn(240.0))
            self.assertEqual(payload["narrator_source"], "vc_pack_external")
            self.assertEqual(len(payload["dead_silences"]), 1)
            self.assertTrue(any("01:06" in w["w"] for w in payload["words"]))

            # Clean loudness contrast preserved without distortion (panic > whisper by >= 4.5 dB)
            wav_arr = ghv.load_audio_mono(final_wav, 48000)
            wh_s = [s for s in payload["sentences"] if s["mood"] == "whisper"][0]
            pa_s = [s for s in payload["sentences"] if s["mood"] == "panic"][0]
            diff_db = rms_db(wav_arr[int(pa_s["s"] * 48000) : int(pa_s["e"] * 48000)]) - rms_db(wav_arr[int(wh_s["s"] * 48000) : int(wh_s["e"] * 48000)])
            self.assertGreaterEqual(diff_db, 4.5)

    def test_narrator_dir_and_narrator_audio_vad_modes(self):
        short_script = (
            "[NARRATOR | mood=calm_omen]\nĐêm nay rất lạnh.\n"
            "[DEAD SILENCE 0.60s]\n"
            "[NARRATOR | mood=panic]\nCó tiếng gõ ngoài cửa!\n"
        )
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(short_script)
            items = ghv.parse_script(sp)

            ndir = os.path.join(td, "narr_clips")
            os.makedirs(ndir)
            t1 = np.arange(int(0.8 * 48000)) / 48000.0
            clip1 = 0.25 * np.sin(2.0 * np.pi * 190.0 * t1)
            clip2 = 0.25 * np.sin(2.0 * np.pi * 240.0 * t1)
            ghv.write_wav_mono16(os.path.join(ndir, "N01.wav"), clip1, 48000)
            ghv.write_wav_mono16(os.path.join(ndir, "N02.wav"), clip2, 48000)

            args_a = ghv.build_parser().parse_args(["--script", sp, "--narrator-dir", ndir, "--out-dir", os.path.join(td, "out_a")])
            _, _, pa = ghv.assemble_voice(items, args_a, td)
            self.assertEqual(pa["narrator_source"], "narrator_dir")
            self.assertEqual(len(pa["sentences"]), 2)

            comb = np.concatenate([clip1, np.zeros(int(0.45 * 48000)), clip2])
            comb_wav = os.path.join(td, "narr_full.wav")
            ghv.write_wav_mono16(comb_wav, comb, 48000)
            args_b = ghv.build_parser().parse_args(["--script", sp, "--narrator-audio", comb_wav, "--out-dir", os.path.join(td, "out_b")])
            _, _, pb = ghv.assemble_voice(items, args_b, td)
            self.assertEqual(pb["narrator_source"], "narrator_audio")
            self.assertEqual(len(pb["sentences"]), 2)

    def test_v6_sfx_manager_import_export_and_load_sfx_asset(self):
        with tempfile.TemporaryDirectory() as td:
            src_dir = os.path.join(td, "raw_sfx")
            lib_dir = os.path.join(td, "sfx_library")
            os.makedirs(src_dir)

            # Create sample mono 44.1kHz WAV to test automatic 48kHz stereo normalization
            t = np.arange(22050, dtype=np.float64) / 44100.0
            ghv.write_wav_mono16(os.path.join(src_dir, "Wooden Door Creak.wav"), 0.35 * np.sin(2.0 * np.pi * 310.0 * t), 44100)

            sm.main(["import-local", "--src", src_dir, "--library", lib_dir, "--category", "foley"])
            mf = sm.load_manifest(lib_dir)
            self.assertIn("wooden_door_creak", mf["assets"])

            # Load normalized real asset via mix_base.load_sfx_asset with looping to 2.0s
            arr = mb.load_sfx_asset("wooden_door_creak", library_dir=lib_dir, dur_sec=2.0, loop=True, pan_pos=-0.3)
            self.assertIsNotNone(arr)
            self.assertEqual(arr.shape, (2, dsp.ns(2.0)))
            self.assertTrue(np.all(np.isfinite(arr)))
            self.assertGreater(float(np.max(np.abs(arr))), 0.1)

            # Missing asset cleanly returns None
            self.assertIsNone(mb.load_sfx_asset("nonexistent_sfx_xyz", library_dir=lib_dir))

            # Export GPU Neural SFX pack (TangoFlux + MMAudio)
            sfx_pack = os.path.join(td, "gpu_sfx_pack")
            sm.main(["export-sfx-pack", "--out-dir", sfx_pack, "--video", "demo.mp4"])
            self.assertTrue(os.path.isfile(os.path.join(sfx_pack, "sfx_prompts.json")))
            self.assertTrue(os.path.isfile(os.path.join(sfx_pack, "run_tangoflux_sfx.py")))
            self.assertTrue(os.path.isfile(os.path.join(sfx_pack, "run_mmaudio_video.py")))

    def test_true_dead_silence_vacuum_in_master_mix(self):
        dur = 4.5
        n = dsp.ns(dur)
        t = np.arange(n, dtype=np.float64) / float(dsp.SR)
        music = dsp.st(0.18 * np.sin(2.0 * np.pi * 55.0 * t))
        sfx = dsp.st(0.12 * np.sin(2.0 * np.pi * 320.0 * t))
        v_mono = np.zeros(n, dtype=np.float64)
        v_mono[: dsp.ns(1.9)] = 0.22 * np.sin(2.0 * np.pi * 210.0 * t[: dsp.ns(1.9)])
        v_mono[dsp.ns(2.8) :] = 0.22 * np.sin(2.0 * np.pi * 210.0 * t[dsp.ns(2.8) :])
        voice = dsp.st(v_mono)

        with tempfile.TemporaryDirectory() as td:
            wj = os.path.join(td, "words.json")
            with open(wj, "w", encoding="utf-8") as fp:
                json.dump({"words": [], "dead_silences": [{"s": 2.0, "e": 2.75}]}, fp)
            ds = mb.load_dead_silences(wj)

        final_mix, stems, _ = mb.master_mix(voice, music, sfx, target_lufs=-15.0, ceil_db=-1.2, dead_silences=ds, ds_floor_db=-48.0)
        self.assertTrue(np.all(np.isfinite(final_mix)))
        bed = stems["music"] + stems["sfx"]
        inside_db = rms_db(bed[:, dsp.ns(2.08) : dsp.ns(2.67)])
        outside_db = rms_db(bed[:, dsp.ns(0.50) : dsp.ns(1.50)])
        self.assertLessEqual(inside_db, -40.0)
        self.assertGreaterEqual(outside_db - inside_db, 38.0)

    def test_v5_four_new_horror_sfx(self):
        r = dsp.rng(505)
        for arr in (
            hi.vhs_static_burst(dur=0.45, vel=0.55, r=r),
            hi.flashlight_click_sputter(dur=0.60, vel=0.65, r=r, kind="off"),
            hi.flashlight_click_sputter(dur=0.60, vel=0.65, r=r, kind="on"),
            hi.neck_crack_wet(dur=0.55, vel=0.72, r=r),
            hi.fly_buzz_loop(dur=1.5, vel=0.22, r=r),
        ):
            self.assertEqual(arr.shape[0], 2)
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

            manifest = {
                "projectId": "align-demo-v6",
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

            r_align = subprocess.run([sys.executable, os.path.join(SCRIPTS_DIR, "align_manifest.py"), mf_path, "--words", words_path, "--in-place"], capture_output=True, text=True)
            self.assertEqual(r_align.returncode, 0, r_align.stdout + r_align.stderr)
            r_val = subprocess.run([sys.executable, os.path.join(SCRIPTS_DIR, "validate_manifest.py"), mf_path, "--script", script_path, "--words", words_path], capture_output=True, text=True)
            self.assertEqual(r_val.returncode, 0, r_val.stdout + r_val.stderr)

    def test_sync_workspace_syncs_checks_and_preserves_user_stories(self):
        sync_py = os.path.join(SCRIPTS_DIR, "sync_workspace.py")
        with tempfile.TemporaryDirectory() as td:
            ws = os.path.join(td, "ws")
            r1 = subprocess.run([sys.executable, sync_py, "--target", ws, "--include-demo"], capture_output=True, text=True)
            self.assertEqual(r1.returncode, 0, r1.stdout + r1.stderr)
            user_story = os.path.join(ws, "src", "my-custom-story", "story.ts")
            os.makedirs(os.path.dirname(user_story), exist_ok=True)
            with open(user_story, "w", encoding="utf-8") as fp:
                fp.write("// user custom story\n")
            self.assertEqual(subprocess.run([sys.executable, sync_py, "--target", ws, "--include-demo", "--check"], capture_output=True).returncode, 0)
            with open(os.path.join(ws, "src", "engine", "index.ts"), "a", encoding="utf-8") as fp:
                fp.write("\n// drift\n")
            self.assertNotEqual(subprocess.run([sys.executable, sync_py, "--target", ws, "--include-demo", "--check"], capture_output=True).returncode, 0)
            self.assertEqual(subprocess.run([sys.executable, sync_py, "--target", ws, "--include-demo"], capture_output=True).returncode, 0)
            self.assertEqual(subprocess.run([sys.executable, sync_py, "--target", ws, "--include-demo", "--check"], capture_output=True).returncode, 0)
            with open(user_story, encoding="utf-8") as fp:
                self.assertEqual(fp.read(), "// user custom story\n")

    def test_horror_story_v5_example_export_and_script_sync(self):
        t_story_py = os.path.join(SCRIPTS_DIR, "horror_story.py")
        c_story_py = os.path.join(REPO_ROOT, "companion-skills", "horror-story", "scripts", "horror_story.py")
        self.assertTrue(filecmp.cmp(t_story_py, c_story_py, shallow=False))
        example_json = os.path.join(REPO_ROOT, "companion-skills", "horror-story", "examples", "ong-ke-story.json")
        r_val = subprocess.run([sys.executable, t_story_py, "validate", example_json, "--stage", "full"], capture_output=True, text=True)
        self.assertEqual(r_val.returncode, 0, r_val.stdout + r_val.stderr)

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
        self.assertEqual(hits, [], "Found stale legacy v2 references:\n" + "\n".join(hits))

    def test_v62_curate_emotion_candidates_scoring_and_apply_gate(self):
        sr = per.SR_REF
        # 1. Acoustic quality gate: clean 5.0s speech passes; noisy/clipped/short fail
        t_clean = np.arange(int(5.0 * sr), dtype=np.float64) / sr
        env = np.where((t_clean % 1.0) < 0.72, 1.0, 0.005)
        clean_sig = env * (0.28 * np.sin(2.0 * np.pi * 190.0 * t_clean))
        m_clean = cec.measure_audio_metrics(clean_sig, sr, text="Đêm hôm đó trời mưa rất to ngoài sân nhà")
        ok, sc, reason = cec.score_candidate(m_clean, "calm", {"lang": "vi", "gender": "male", "dialect": "northern dialect"})
        self.assertTrue(ok, reason)
        self.assertGreater(sc, 10.0)

        # Too short (<2.6s) rejected
        short_sig = clean_sig[: int(1.4 * sr)]
        ok_s, _, _ = cec.score_candidate(cec.measure_audio_metrics(short_sig, sr), "calm", {"lang": "vi"})
        self.assertFalse(ok_s)

        # Heavy constant BGM / flat noise (low SNR) rejected
        rng = np.random.default_rng(7)
        bgm_sig = 0.25 * rng.normal(0.0, 1.0, len(t_clean))
        ok_n, _, _ = cec.score_candidate(cec.measure_audio_metrics(bgm_sig, sr), "fear", {"lang": "vi"})
        self.assertFalse(ok_n)

        # Clipped signal rejected
        clipped_sig = np.clip(clean_sig * 12.0, -1.0, 1.0)
        ok_c, _, _ = cec.score_candidate(cec.measure_audio_metrics(clipped_sig, sr), "panic", {"lang": "vi"})
        self.assertFalse(ok_c)

        # 2. Staging audition catalog + explicit apply gate (NEVER touches emotion_refs until apply!)
        with tempfile.TemporaryDirectory() as td:
            aud_dir = os.path.join(td, "emotion_audition")
            refs_dir = os.path.join(td, "emotion_refs")
            os.makedirs(os.path.join(aud_dir, "raw_candidates"), exist_ok=True)
            selected = {}
            for idx, mood in enumerate(cec.MOOD_SPEC):
                selected[mood] = []
                for slot, lang in (("A", "vi"), ("B", "en")):
                    rel = os.path.join("raw_candidates", f"{mood}_{slot}.wav")
                    abs_p = os.path.join(aud_dir, rel)
                    per.write_wav_mono16(abs_p, clean_sig, sr)
                    selected[mood].append({
                        "slot": slot,
                        "mood": mood,
                        "dataset": "doof-ferb/LSVSC" if lang == "vi" else "ylacombe/expresso",
                        "license": "test-open",
                        "split": "validation",
                        "row_idx": idx * 10 + (0 if slot == "A" else 1),
                        "lang": lang,
                        "emotion": mood,
                        "gender": "male",
                        "text": "test sample",
                        "raw_wav": rel,
                        "raw_wav_abs": abs_p,
                        "metrics": m_clean,
                        "score": 18.5,
                    })

            cec.render_vieneu_previews(selected, aud_dir, synth_fn=lambda txt, ref, sp, tmp: clean_sig[: int(4.0 * sr)])
            mf_path, cat_path = cec.write_audition_catalog(selected, aud_dir)
            self.assertTrue(os.path.isfile(mf_path))
            self.assertTrue(os.path.isfile(cat_path))
            self.assertTrue(os.path.isfile(os.path.join(aud_dir, "audition_reel.wav")))
            self.assertFalse(os.path.exists(refs_dir))  # Staging NEVER modifies emotion_refs!

            picks = cec.parse_picks(["calm=A", "curious=A", "whisper=B", "fear=A", "panic=A", "dread=A"])
            applied = cec.apply_approved_picks(aud_dir, refs_dir, picks)
            self.assertEqual(len(applied), 6)
            for mood in cec.MOOD_SPEC:
                self.assertTrue(os.path.isfile(os.path.join(refs_dir, f"{mood}.wav")))


if __name__ == "__main__":
    unittest.main()
