import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import numpy as np
from PIL import Image

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRIPTS_DIR = os.path.join(REPO_ROOT, "templates", "scripts")
AUDIO_DIR = os.path.join(REPO_ROOT, "templates", "audio")
for p in (SCRIPTS_DIR, AUDIO_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

import align_manifest as am  # noqa: E402
import constitution  # noqa: E402
import dsp  # noqa: E402
import gen_cast_assets as gca  # noqa: E402
import gen_horror_voice as ghv  # noqa: E402
import gen_jumpscare_clip as gjc  # noqa: E402
import horror_instruments as hi  # noqa: E402
import mix_cues as mc  # noqa: E402
import sfx_manager as sm  # noqa: E402


class TestV15OptionAUpgrade(unittest.TestCase):
    def test_constitution_v15_option_a_schema(self):
        const = constitution.load_constitution()
        self.assertEqual(const["version"], "15.0.0")
        self.assertEqual(const["rendering"]["defaultCharacterMode"], "sprite2d")
        self.assertLessEqual(const["rendering"]["lowVramDpr"], 0.5)
        self.assertEqual(const["rendering"]["defaultConcurrency"], 1)
        self.assertTrue(const["rendering"]["singleWebglContext"])
        self.assertEqual(const["soundscape"]["minJumpscaresPerPart"], 1)
        self.assertEqual(const["soundscape"]["jumpscareTruePeakDb"], -1.0)
        self.assertTrue(const["soundscape"]["preferRealSfxOnly"])
        self.assertEqual(const["entityScareTiers"]["minPrimaryEntityTier"], 4)
        self.assertEqual(const["speech"]["cleanTempoDefault"], 1.0)
        self.assertTrue(const["speech"]["defaultDisableTempoPitchDsp"])

    def test_gen_cast_assets_offline_cutout_normal_map_and_prompt_tier(self):
        with tempfile.TemporaryDirectory() as td:
            proj_dir = os.path.join(td, "src", "demo-elevator-v15")
            os.makedirs(proj_dir, exist_ok=True)
            manifest = {
                "projectId": "demo-elevator-v15",
                "title": "Thang Máy Tầng B2",
                "totalFrames": 300,
                "aspect": "9:16",
                "characterMode": "sprite2d",
                "locations": [],
                "castBlueprints": [
                    {
                        "id": "C01",
                        "role": "human",
                        "storyDescription": "Shipper đêm 25 tuổi mặc áo khoác gió xám sờn, vẻ mặt cảnh giác",
                    },
                    {
                        "id": "C02",
                        "role": "entity",
                        "scareTier": 6,
                        "scareTraits": ["elongated_neck", "pinpoint_eyes", "twisted_joints"],
                        "storyDescription": "Bóng người gầy bất thường bám sát góc gương thang máy, cổ kéo dài nghiêng gãy",
                    },
                ],
                "beats": [],
            }
            man_p = os.path.join(proj_dir, "manifest.json")
            with open(man_p, "w", encoding="utf-8") as fp:
                json.dump(manifest, fp, ensure_ascii=False, indent=2)

            prompt_ent = gca.build_cast_prompt(manifest["castBlueprints"][1], "entity_scare")
            self.assertIn("photorealistic", prompt_ent.lower())
            self.assertIn("Tier 6", prompt_ent)
            self.assertIn("#00FF00", prompt_ent)

            # Test chroma removal + tangent-space normal map generation on a synthetic green-screen figure
            rgb = np.zeros((256, 160, 3), dtype=np.uint8)
            rgb[:, :] = [0, 255, 0]  # pure #00FF00 green screen
            rgb[40:230, 50:110] = [125, 110, 102]  # realistic neutral subject
            rgba = gca.remove_background_rgba(Image.fromarray(rgb, mode="RGB"))
            arr_a = np.asarray(rgba)[..., 3]
            self.assertEqual(int(arr_a[0, 0]), 0, "Green screen corner must become transparent")
            self.assertGreater(int(arr_a[arr_a.shape[0] // 2, arr_a.shape[1] // 2]), 200, "Subject center must remain opaque")

            nrm = gca.generate_normal_map_from_rgba(rgba)
            nrm_arr = np.asarray(nrm, dtype=np.float32)
            self.assertEqual(nrm_arr.shape[:2], arr_a.shape)
            # Tangent-space normals must point out toward +Z (blue channel > 128 on subject)
            self.assertGreater(float(np.mean(nrm_arr[..., 2])), 160.0)

            # Run full offline mock pipeline with --update-manifest
            cast_out = os.path.join(proj_dir, "assets", "cast")
            res = gca.generate_cast_for_manifest(man_p, out_dir=cast_out, mock_offline=True, update_manifest=True)
            self.assertIn("C01", res["characters"])
            self.assertIn("C02", res["characters"])
            with open(man_p, encoding="utf-8") as fp:
                updated = json.load(fp)
            c2 = updated["castBlueprints"][1]
            self.assertIn("spriteAssets", c2)
            self.assertTrue(c2["spriteAssets"]["calm"].startswith("assets/cast/"))
            c2_norm = res["characters"]["C02"]["files"]["calm"]["normal"]
            self.assertTrue(c2_norm.endswith("_normal.png"))
            self.assertTrue(os.path.isfile(os.path.join(proj_dir, c2["spriteAssets"]["calm"])))
            self.assertTrue(os.path.isfile(os.path.join(cast_out, c2_norm)))

    def test_gen_jumpscare_clip_local_first_frame_compositor(self):
        with tempfile.TemporaryDirectory() as td:
            proj_dir = os.path.join(td, "src", "demo-js")
            cast_dir = os.path.join(proj_dir, "assets", "cast")
            os.makedirs(cast_dir, exist_ok=True)

            # Create anchor frame & entity sprite PNG
            anchor_p = os.path.join(td, "anchor.png")
            ent_p = os.path.join(cast_dir, "C02_entity_scare.png")
            Image.fromarray(np.full((640, 360, 3), 24, dtype=np.uint8), mode="RGB").save(anchor_p)
            ent_rgba = np.zeros((240, 160, 4), dtype=np.uint8)
            ent_rgba[20:220, 30:130] = [190, 185, 180, 255]
            Image.fromarray(ent_rgba, mode="RGBA").save(ent_p)

            out_mp4 = os.path.join(proj_dir, "assets", "jumpscare_js1.mp4")
            gjc.render_local_first_frame_jumpscare(
                anchor_p, out_mp4, duration_sec=2.0, fps=30, width=360, height=640,
                transition_style="first_frame_seamless", entity_png_path=ent_p,
            )
            self.assertTrue(os.path.isfile(out_mp4))
            self.assertGreater(os.path.getsize(out_mp4), 5000)

    def test_validate_manifest_v15_entity_tier_2d_antirepeat_and_jumpscare_av_sync(self):
        val_script = os.path.join(SCRIPTS_DIR, "validate_manifest.py")
        with tempfile.TemporaryDirectory() as td:
            reg_p = os.path.join(td, "LOCATION_REGISTRY.json")

            def _base_manifest(pid: str, loc_arch: str, sprite_rel: str, tier: int, sig: str, js_clips: list):
                return {
                    "projectId": pid,
                    "title": f"Test {pid}",
                    "totalFrames": 240,
                    "aspect": "9:16",
                    "characterMode": "sprite2d",
                    "locations": [
                        {
                            "id": "S01",
                            "archetype": loc_arch,
                            "dimensions": [3.0, 3.2, 2.7],
                            "ceilingType": "flatConcrete",
                            "materials": {"wall": "paintedConcrete", "floor": "concreteFloor", "ceiling": "concreteCeiling"},
                            "practicalLights": ["fluorescentTube"],
                            "heroProps": ["panel", "mirror", "alarmButton"],
                            "signatureShadowBeat": "Flickering tube reflection",
                            "anchors": {"POV_START": [0, 0, 1.0], "CORNER": [0.6, 0, -0.8]},
                        }
                    ],
                    "castBlueprints": [
                        {
                            "id": "C02",
                            "role": "entity",
                            "scareTier": tier,
                            "scareTraits": ["elongated_neck", "pinpoint_eyes"],
                            "storyDescription": f"Unique apparition for {pid} clinging near mirror",
                            "spriteAssets": {
                                "calm": sprite_rel,
                                "promptSignature": sig,
                            },
                        }
                    ],
                    "beats": [
                        {
                            "beatId": "B1",
                            "shotId": 1,
                            "a": 0,
                            "b": 240,
                            "peakFrame": 120,
                            "locationId": "S01",
                            "spokenLine": {"speaker": "NARRATOR", "text": "Đèn thang máy chớp tắt."},
                            "lightState": {"preset": "fluorescent", "lampsOn": ["fluorescentTube"]},
                            "castStates": {"C02": {"visible": True, "anchor": "CORNER", "pose": "loomingStill"}},
                            "propStates": {},
                            "cameraIntent": "Elevator mirror reveal",
                        }
                    ],
                    "jumpscareClips": js_clips,
                }

            cues_p = os.path.join(td, "cues.json")
            with open(cues_p, "w", encoding="utf-8") as fp:
                json.dump({"beds": [], "events": [{"id": "js1_audio", "jumpscare": "metal_dread", "at": 5.0}]}, fp)

            # 1. Valid Tier 6 + synced Jumpscare at f150 (5.00s) -> PASS & register in registry
            m1_p = os.path.join(td, "m1.json")
            m1 = _base_manifest(
                "elevator-alpha", "freightElevatorAlpha", "assets/cast/C02_calm.png", 6, "sig-alpha-unique-001",
                [{"id": "js1", "src": "assets/jumpscare_js1.mp4", "a": 150, "b": 225, "anchorFrame": 149, "transitionStyle": "first_frame_seamless", "audioCueId": "js1_audio"}],
            )
            with open(m1_p, "w", encoding="utf-8") as fp:
                json.dump(m1, fp, ensure_ascii=False)
            r1 = subprocess.run([sys.executable, val_script, m1_p, "--cues", cues_p, "--registry", reg_p, "--update-registry"], capture_output=True, text=True)
            self.assertEqual(r1.returncode, 0, r1.stdout + r1.stderr)

            # 2. Mild Tier 2 entity + missing jumpscare -> FAIL with ENTITY_SCARE_TIER_ERROR & MISSING_JUMPSCARE_ERROR
            m_bad_tier = _base_manifest("elevator-mild", "subBasementMild", "assets/cast/C02_mild.png", 2, "sig-mild-002", [])
            m_bad_p = os.path.join(td, "m_bad_tier.json")
            with open(m_bad_p, "w", encoding="utf-8") as fp:
                json.dump(m_bad_tier, fp, ensure_ascii=False)
            r2 = subprocess.run([sys.executable, val_script, m_bad_p, "--cues", cues_p], capture_output=True, text=True)
            self.assertNotEqual(r2.returncode, 0)
            self.assertIn("ENTITY_SCARE_TIER_ERROR", r2.stdout)
            self.assertIn("MISSING_JUMPSCARE_ERROR", r2.stdout)

            # 3. Unrelated project reusing sprite path / promptSignature -> FAIL with ANTI_REPEAT_ENTITY_ERROR
            m_clone = _base_manifest(
                "hospital-beta", "hospitalWardBeta", "src/elevator-alpha/assets/cast/C02_calm.png", 6, "sig-alpha-unique-001",
                [{"id": "js1", "src": "assets/jumpscare_js1.mp4", "a": 150, "b": 225, "anchorFrame": 149, "transitionStyle": "silence_hard_cut", "audioCueId": "js1_audio"}],
            )
            m_clone_p = os.path.join(td, "m_clone.json")
            with open(m_clone_p, "w", encoding="utf-8") as fp:
                json.dump(m_clone, fp, ensure_ascii=False)
            r3 = subprocess.run([sys.executable, val_script, m_clone_p, "--cues", cues_p, "--registry", reg_p], capture_output=True, text=True)
            self.assertNotEqual(r3.returncode, 0)
            self.assertIn("ANTI_REPEAT_ENTITY_ERROR", r3.stdout)

            # 4. Jumpscare A/V drift > 0.15s -> FAIL with JUMPSCARE_AV_SYNC_ERROR
            m_drift = _base_manifest(
                "alley-gamma", "alleyNightGamma", "assets/cast/C02_gamma.png", 5, "sig-gamma-003",
                [{"id": "js1", "src": "assets/jumpscare_js1.mp4", "a": 120, "b": 195, "anchorFrame": 119, "transitionStyle": "whip_pan_turn", "audioCueId": "js1_audio"}],
            )
            m_drift_p = os.path.join(td, "m_drift.json")
            with open(m_drift_p, "w", encoding="utf-8") as fp:
                json.dump(m_drift, fp, ensure_ascii=False)
            r4 = subprocess.run([sys.executable, val_script, m_drift_p, "--cues", cues_p], capture_output=True, text=True)
            self.assertNotEqual(r4.returncode, 0)
            self.assertIn("JUMPSCARE_AV_SYNC_ERROR", r4.stdout)

    def test_align_manifest_action_trigger_and_jumpscare_phrase(self):
        words = [
            {"w": "Cửa", "s": 0.2, "e": 0.5, "speaker": "NARRATOR"},
            {"w": "thang", "s": 0.52, "e": 0.85, "speaker": "NARRATOR"},
            {"w": "máy", "s": 0.88, "e": 1.15, "speaker": "NARRATOR"},
            {"w": "khựng", "s": 1.50, "e": 1.85, "speaker": "NARRATOR"},
            {"w": "lại", "s": 1.88, "e": 2.15, "speaker": "NARRATOR"},
            {"w": "đột", "s": 3.00, "e": 3.25, "speaker": "NARRATOR"},
            {"w": "ngột!", "s": 3.28, "e": 3.65, "speaker": "NARRATOR"},
        ]
        manifest = {
            "projectId": "align-v15",
            "title": "Align v15",
            "totalFrames": 180,
            "locations": [],
            "beats": [
                {
                    "beatId": "B1",
                    "shotId": 1,
                    "a": 0,
                    "b": 180,
                    "peakFrame": 90,
                    "locationId": "S01",
                    "spokenLine": {"text": "Cửa thang máy khựng lại đột ngột!"},
                    "lightState": {"preset": "fluorescent", "lampsOn": []},
                    "castStates": {
                        "C01": {"visible": True, "actionTriggerPhrase": "khựng lại", "triggerExpr": "shock"},
                    },
                    "propStates": {},
                    "cameraIntent": "Snap reaction on trigger phrase",
                }
            ],
            "jumpscareClips": [
                {"id": "js1", "src": "assets/jumpscare_js1.mp4", "triggerPhrase": "đột ngột", "durationSec": 2.0, "a": 0, "b": 60, "anchorFrame": 0}
            ],
        }
        aligned, _ = am.align_manifest_data(manifest, words, fps=30.0, target_total_frames=180)
        self.assertEqual(aligned["beats"][0]["castStates"]["C01"]["actionTriggerFrame"], int(round(1.50 * 30)))
        js = aligned["jumpscareClips"][0]
        self.assertEqual(js["a"], int(round(3.00 * 30)))
        self.assertEqual(js["anchorFrame"], int(round(3.00 * 30)) - 1)
        self.assertEqual(js["b"], js["a"] + 60)

    def test_gen_horror_voice_v15_clean_1x_no_clause_split_import_voice_and_rms(self):
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(
                    "[NARRATOR | mood=dread]\n"
                    "Cửa thang máy vừa đóng lại [PACE=0.78 | PITCH=-1.5] thì đèn trên trần vụt tắt.\n"
                )
            # v15.0 default MUST NOT split contiguous sentence on [PACE]/[PITCH]
            items = ghv.parse_script(sp)
            speech_items = [it for it in items if it["kind"] == "speech"]
            self.assertEqual(len(speech_items), 1)
            self.assertIn("vụt tắt", speech_items[0]["text"])
            self.assertIsNone(speech_items[0]["clause_pace"])
            self.assertIsNone(speech_items[0]["clause_pitch_st"])

            # Verify _align_ref_f0_to_anchor is disabled by default
            ref_p = os.path.join(td, "dummy_ref.wav")
            t = np.arange(48000, dtype=np.float64) / 48000.0
            ghv.write_wav_mono16(ref_p, 0.25 * np.sin(2 * np.pi * 165.0 * t), 48000)
            out_ref, delta_st, is_tmp = ghv._align_ref_f0_to_anchor(ref_p, 110.0, -1.5, td)
            self.assertEqual(out_ref, ref_p)
            self.assertEqual(delta_st, 0.0)
            self.assertFalse(is_tmp)

            # Verify --import-voice preserves exact 1.0x duration (0% tempo stretch) + emits rms_envelope_30fps
            take_p = os.path.join(td, "human_clean.wav")
            dur_in = 3.0
            t3 = np.arange(int(dur_in * 48000), dtype=np.float64) / 48000.0
            sig = np.zeros_like(t3)
            sig[int(0.3 * 48000) : int(1.2 * 48000)] = 0.28 * np.sin(2 * np.pi * 175.0 * t3[int(0.3 * 48000) : int(1.2 * 48000)])
            sig[int(1.8 * 48000) : int(2.7 * 48000)] = 0.24 * np.sin(2 * np.pi * 190.0 * t3[int(1.8 * 48000) : int(2.7 * 48000)])
            ghv.write_wav_mono16(take_p, sig, 48000)

            out_dir = os.path.join(td, "voice_imp")
            args = ghv.build_parser().parse_args([
                "--script", sp, "--import-voice", take_p, "--word-aligner", "acoustic", "--out-dir", out_dir,
            ])
            final_wav, words_json, payload = ghv.assemble_voice(items, args, td)
            self.assertEqual(payload["version"], "15.0.0")
            self.assertEqual(payload["narrator_source"], "imported_voice_clean")
            self.assertFalse(payload["dsp_tempo_pitch_enabled"])
            self.assertAlmostEqual(payload["dur"], dur_in, delta=0.02)
            env30 = payload.get("rms_envelope_30fps") or []
            self.assertEqual(len(env30), 90)
            # Silent middle [1.35..1.65s -> f45] must have low RMS; voiced [0.5..1.0s -> f22] must have high RMS!
            self.assertLess(env30[45], 0.05)
            self.assertGreater(env30[22], 0.5)

    def test_sfx_auto_fetch_and_mix_cues_real_sfx_first_and_ceil_minus_1db(self):
        with tempfile.TemporaryDirectory() as td:
            lib = os.path.join(td, "sfx_library")
            os.makedirs(lib, exist_ok=True)
            cues_p = os.path.join(td, "cues.json")
            voice_p = os.path.join(td, "voice.wav")
            words_p = os.path.join(td, "words.json")

            sr = dsp.SR
            dur = 6.0
            t = np.arange(dsp.ns(dur)) / sr
            v = 0.14 * np.sin(2 * np.pi * 160.0 * t)
            v[dsp.ns(3.2) : dsp.ns(4.2)] = 0.0
            dsp.write_wav(voice_p, dsp.st(v))
            with open(words_p, "w", encoding="utf-8") as fp:
                json.dump({"dur": dur, "words": [{"w": "Cửa", "s": 0.2, "e": 0.8}], "sentences": [{"sent": 1, "s": 0.2, "e": 3.0, "mood": "tense"}], "silence_drops": [{"s": 3.2, "e": 4.0}]}, fp)

            cues = {
                "voice": voice_p,
                "words": words_p,
                "library_dir": lib,
                "skip_history": True,
                "beds": [{"sound": "elevator_hum_test", "role": "near", "search_query": "elevator hum interior", "target_rms_dbfs": -34.0}],
                "events": [
                    {"id": "js1", "jumpscare": "metal_dread", "sound": "elevator_crash_screech", "at": 4.0, "target_peak_dbfs": -1.0}
                ],
            }
            with open(cues_p, "w", encoding="utf-8") as fp:
                json.dump(cues, fp)

            # Offline mock Openverse search & download for `auto_fetch_for_script`
            def fake_get(_url):
                return {
                    "results": [
                        {"id": "ov-101", "title": "Elevator Hum", "creator": "TestCC0", "source": "freesound", "license": "cc0", "duration": 8500, "url": "https://example.test/hum.wav", "attribution": "CC0 Test 1"},
                        {"id": "ov-102", "title": "Elevator Screech", "creator": "TestCC0", "source": "freesound", "license": "cc0", "duration": 4200, "url": "https://example.test/screech.wav", "attribution": "CC0 Test 2"},
                    ]
                }

            def fake_dl(_url, dst):
                r = dsp.rng(77)
                arr = horror_arr = 0.45 * dsp.colored(dsp.ns(2.0), r, slope=0.3)
                dsp.write_wav(dst, dsp.st(horror_arr))

            res_af = sm.auto_fetch_for_script(cues_p, lib, http_get_fn=fake_get, download_fn=fake_dl)
            self.assertEqual(set(res_af["fetched"]), {"elevator_hum_test", "elevator_crash_screech"})
            self.assertEqual(res_af["failed"], [])

            # Mix with real-SFX-first -> PASS with -1.0 dBTP ceiling!
            out_wav = os.path.join(td, "mix.wav")
            res_mix = mc.render_cues_mix(cues_p, out_wav, library_dir=lib, strict=True)
            self.assertEqual(res_mix["verdict"], "PASS")
            self.assertEqual(res_mix["clips"], 0)
            self.assertLessEqual(res_mix["stats"]["TP"], -0.85)
            self.assertEqual(len(res_mix["jumpscares"]), 1)

            # Verify procedural `synth:` without allow_synth fails with SYNTH_SFX_FORBIDDEN under --strict!
            bad_synth = json.loads(json.dumps(cues))
            bad_synth["events"].append({"id": "bad_syn", "synth": "riser", "at": 1.2, "dur_s": 0.8})
            bad_sp = os.path.join(td, "bad_synth.json")
            with open(bad_sp, "w", encoding="utf-8") as fp:
                json.dump(bad_synth, fp)
            with self.assertRaises(RuntimeError) as ctx_s:
                mc.render_cues_mix(bad_sp, os.path.join(td, "bad_s.wav"), library_dir=lib, strict=True)
            self.assertIn("SYNTH_SFX_FORBIDDEN", str(ctx_s.exception))

    def test_gen_cast_assets_rig_meta_canvas_alignment_and_import_raw_dir(self):
        with tempfile.TemporaryDirectory() as td:
            proj_dir = os.path.join(td, "src", "demo-import-v151")
            raw_dir = os.path.join(td, "raw_imports")
            os.makedirs(proj_dir, exist_ok=True)
            os.makedirs(raw_dir, exist_ok=True)

            bp = {
                "id": "C01",
                "role": "human",
                "storyDescription": "Shipper mặc áo khoác xám đứng trong thang máy",
            }
            manifest = {
                "projectId": "demo-import-v151",
                "title": "Import Raw Test",
                "totalFrames": 180,
                "aspect": "9:16",
                "characterMode": "sprite2d",
                "locations": [],
                "castBlueprints": [bp],
                "beats": [],
            }
            man_p = os.path.join(proj_dir, "manifest.json")
            with open(man_p, "w", encoding="utf-8") as fp:
                json.dump(manifest, fp, ensure_ascii=False, indent=2)

            # Save differently-sized raw green-screen images simulating Antigravity image-generator outputs
            gca.generate_mock_offline_sprite(bp, "calm", size=(384, 512)).save(os.path.join(raw_dir, "c01_calm_001.jpg"))
            gca.generate_mock_offline_sprite(bp, "fear", size=(420, 560)).save(os.path.join(raw_dir, "C01_fear.png"))
            gca.generate_mock_offline_sprite(bp, "shock", size=(360, 480)).save(os.path.join(raw_dir, "c01_shock_v2.jpg"))

            cast_out = os.path.join(proj_dir, "assets", "cast")
            res = gca.generate_cast_for_manifest(
                man_p, out_dir=cast_out, import_raw_dir=raw_dir, update_manifest=True
            )
            self.assertIn("C01", res["characters"])
            rig_meta = res["characters"]["C01"]["rigMeta"]
            self.assertGreater(rig_meta["neckV"], rig_meta["shoulderV"])
            self.assertGreater(rig_meta["shoulderV"], rig_meta["waistV"])
            self.assertGreater(rig_meta["mouthV"], rig_meta["neckV"])

            # All aligned expressions MUST share identical canvas dimensions for ghost-free shader crossfade!
            with Image.open(os.path.join(cast_out, "C01_calm.png")) as im_c, \
                 Image.open(os.path.join(cast_out, "C01_fear.png")) as im_f, \
                 Image.open(os.path.join(cast_out, "C01_shock.png")) as im_s:
                self.assertEqual(im_c.size, im_f.size)
                self.assertEqual(im_c.size, im_s.size)

            with open(man_p, encoding="utf-8") as fp:
                updated = json.load(fp)
            sa = updated["castBlueprints"][0]["spriteAssets"]
            self.assertIn("rigMeta", sa)
            self.assertEqual(sa["fear"], "assets/cast/C01_fear.png")
            self.assertEqual(sa["shock"], "assets/cast/C01_shock.png")

    def test_v152_acting_cues_align_infer_and_validate(self):
        import horror_story as hs

        # 1. Story-driven Vietnamese inference picks diverse, context-matched gestures for humans & entities!
        cues_human = hs.infer_acting_cues_from_text(
            "Tôi lắng nghe tiếng gõ ngoài cửa, bỗng rùng mình lạnh gáy rồi giật bắn người lùi lại!", role="human"
        )
        g_human = [c["gesture"] for c in cues_human]
        self.assertIn("tiltListen", g_human)
        self.assertIn("shiver", g_human)
        self.assertIn("flinch", g_human)

        cues_sigh = hs.infer_acting_cues_from_text("Ông lão thở dài mệt mỏi rồi lắc đầu không thể tin.", role="human")
        self.assertEqual([c["gesture"] for c in cues_sigh], ["sighDrop", "headShake"])

        cues_ent = hs.infer_acting_cues_from_text("Con ma đứng im phăng phắc, đột ngột ngoẹo cổ rồi cười ngoác tiến sát.", role="entity")
        g_ent = [c["gesture"] for c in cues_ent]
        self.assertIn("breathHold", g_ent)
        self.assertIn("neckCrack", g_ent)
        self.assertIn("jawStretch", g_ent)

        # 2. align_manifest.py locks `actingCues[].onPhrase` -> exact `atFrame` inside the beat window
        words = [
            {"w": "Tôi", "s": 0.2, "e": 0.4, "speaker": "NARRATOR"},
            {"w": "lắng", "s": 0.5, "e": 0.75, "speaker": "NARRATOR"},
            {"w": "nghe", "s": 0.76, "e": 1.0, "speaker": "NARRATOR"},
            {"w": "bỗng", "s": 1.3, "e": 1.5, "speaker": "NARRATOR"},
            {"w": "lạnh", "s": 1.6, "e": 1.9, "speaker": "NARRATOR"},
            {"w": "gáy", "s": 1.92, "e": 2.2, "speaker": "NARRATOR"},
            {"w": "rồi", "s": 2.3, "e": 2.5, "speaker": "NARRATOR"},
            {"w": "khựng", "s": 2.8, "e": 3.1, "speaker": "NARRATOR"},
            {"w": "lại!", "s": 3.12, "e": 3.4, "speaker": "NARRATOR"},
        ]
        mf = {
            "projectId": "acting-cues-v152",
            "title": "Acting Cues v15.2",
            "totalFrames": 150,
            "locations": [
                {
                    "id": "S01",
                    "archetype": "corridorV152",
                    "dimensions": [3.0, 4.0, 2.8],
                    "ceilingType": "flatConcrete",
                    "materials": {"wall": "paintedConcrete", "floor": "concreteFloor", "ceiling": "concreteCeiling"},
                    "practicalLights": ["fluorescentTube"],
                    "heroProps": ["door", "mirror", "switch"],
                    "signatureShadowBeat": "Flicker",
                    "anchors": {"SPOT": [0, 0, -1]},
                }
            ],
            "castBlueprints": [{"id": "C01", "role": "human", "storyDescription": "Worker"}],
            "beats": [
                {
                    "beatId": "B1",
                    "shotId": 1,
                    "a": 0,
                    "b": 150,
                    "peakFrame": 75,
                    "locationId": "S01",
                    "spokenLine": {"text": "Tôi lắng nghe bỗng lạnh gáy rồi khựng lại!"},
                    "lightState": {"preset": "fluorescent", "lampsOn": ["fluorescentTube"]},
                    "castStates": {
                        "C01": {
                            "visible": True,
                            "anchor": "SPOT",
                            "pose": "standIdle",
                            "actingCues": [
                                {"gesture": "tiltListen", "onPhrase": "lắng nghe", "side": "left"},
                                {"gesture": "shiver", "onPhrase": "lạnh gáy", "exprTo": "fear"},
                                {"gesture": "flinch", "onPhrase": "khựng lại", "offsetFrames": -2, "exprTo": "shock"},
                            ],
                        }
                    },
                    "propStates": {},
                    "cameraIntent": "Multi-cue phrase lock",
                }
            ],
            "jumpscareClips": [{"id": "js1", "src": "assets/jumpscare_js1.mp4", "a": 100, "b": 148, "anchorFrame": 99, "transitionStyle": "first_frame_seamless"}],
        }
        aligned, _ = am.align_manifest_data(mf, words, fps=30.0, target_total_frames=150)
        cues_out = aligned["beats"][0]["castStates"]["C01"]["actingCues"]
        self.assertEqual(cues_out[0]["atFrame"], int(round(0.5 * 30)))
        self.assertEqual(cues_out[1]["atFrame"], int(round(1.6 * 30)))
        self.assertEqual(cues_out[2]["atFrame"], int(round(2.8 * 30)) - 2)

        # 3. validate_manifest.py accepts valid cues and rejects invalid gesture or empty customDeform with ACTING_CUE_ERROR
        val_script = os.path.join(SCRIPTS_DIR, "validate_manifest.py")
        with tempfile.TemporaryDirectory() as td:
            good_p = os.path.join(td, "good.json")
            with open(good_p, "w", encoding="utf-8") as fp:
                json.dump(aligned, fp, ensure_ascii=False)
            rg = subprocess.run([sys.executable, val_script, good_p], capture_output=True, text=True)
            self.assertEqual(rg.returncode, 0, rg.stdout + rg.stderr)

            bad = json.loads(json.dumps(aligned))
            bad["beats"][0]["castStates"]["C01"]["actingCues"].append({"gesture": "backflip360"})
            bad["beats"][0]["castStates"]["C01"]["actingCues"].append({"gesture": "custom"})
            bad_p = os.path.join(td, "bad.json")
            with open(bad_p, "w", encoding="utf-8") as fp:
                json.dump(bad, fp, ensure_ascii=False)
            rb = subprocess.run([sys.executable, val_script, bad_p], capture_output=True, text=True)
            self.assertNotEqual(rb.returncode, 0)
            self.assertIn("ACTING_CUE_ERROR", rb.stdout)

    def test_v153_vieneu_default_priority_ref_audio_and_no_auto_gemini(self):
        with tempfile.TemporaryDirectory() as td:
            # 1. Default --tts-engine MUST be `vieneu` (free 1.0x local, never auto-burning Gemini Free Tier)
            args_def = ghv.build_parser().parse_args(["--script", "dummy.md"])
            self.assertEqual(args_def.tts_engine, "vieneu")

            # 2. Even when GEMINI_API_KEY is present, `--tts-engine auto` MUST choose VieNeu -> Edge, NEVER Gemini!
            item = {
                "kind": "speech",
                "text": "Đêm về thấy đôi dép úp ngược trước cửa.",
                "vieneu_text": "Đêm về thấy đôi dép úp ngược trước cửa.",
                "tts_text": "Đêm về thấy đôi dép úp ngược trước cửa.",
                "speaker": "NARRATOR",
                "is_narrator": True,
                "mood": "calm_omen",
                "fx": "dry",
                "ref_audio": None,
            }
            args_auto = ghv.build_parser().parse_args([
                "--script", "dummy.md", "--tts-engine", "auto", "--gemini-api-key", "fake-key-should-not-auto-fire",
            ])
            fake_out = (np.zeros(24000, dtype=np.float64), [{"w": "Đêm", "s": 0.0, "e": 0.3}])
            with mock.patch.object(ghv, "_has_vieneu", return_value=True), \
                 mock.patch.object(ghv, "synth_vieneu_chunk", return_value=fake_out) as m_vn, \
                 mock.patch.object(ghv, "synth_gemini_chunk") as m_gem:
                ghv.synth_line_auto(item, 48000, td, 0, args_auto)
            m_vn.assert_called_once()
            m_gem.assert_not_called()

            # 3. Explicit `--ref-audio` (5-8s clean storytelling sample) MUST beat auto `emotion_refs/` and pass straight to VieNeu at 1.0x!
            emo_dir = os.path.join(td, "emotion_refs")
            os.makedirs(emo_dir, exist_ok=True)
            emo_calm = os.path.join(emo_dir, "calm.wav")
            my_ref = os.path.join(td, "my_storyteller_6s.wav")
            t = np.arange(24000, dtype=np.float64) / 48000.0
            ghv.write_wav_mono16(emo_calm, 0.2 * np.sin(2 * np.pi * 150 * t), 48000)
            ghv.write_wav_mono16(my_ref, 0.2 * np.sin(2 * np.pi * 125 * t), 48000)

            args_ref = ghv.build_parser().parse_args([
                "--script", "dummy.md", "--tts-engine", "vieneu", "--emotion-refs", emo_dir, "--ref-audio", my_ref,
            ])
            self.assertEqual(ghv.resolve_emotion_ref(item, args_ref), my_ref)

            fake_tts = mock.MagicMock()
            fake_tts.sample_rate = 48000
            fake_tts.infer.return_value = 0.2 * np.sin(2 * np.pi * 130 * np.arange(48000) / 48000.0)
            with mock.patch.object(ghv, "_get_vieneu", return_value=fake_tts), \
                 mock.patch.object(ghv, "apply_clean_tempo") as m_tempo:
                ghv.synth_vieneu_chunk(item, 48000, args_ref, cache_dir=os.path.join(td, "cache"), tmp_dir=td)
            fake_tts.infer.assert_called_once()
            self.assertEqual(fake_tts.infer.call_args.kwargs.get("ref_audio"), my_ref)
            m_tempo.assert_not_called()

    def test_v153_story_constitution_optional_motif_occlusion_and_sample_script(self):
        import horror_story as hs

        const = constitution.load_constitution()
        self.assertEqual(const["speech"]["defaultTtsEngine"], "vieneu")
        self.assertAlmostEqual(const["speech"]["wordsPerSecondTarget"], 2.35, places=2)
        self.assertAlmostEqual(const["speech"]["spokenWordsPerSecondMin"], 2.25, places=2)
        self.assertAlmostEqual(const["speech"]["spokenWordsPerSecondTarget"], 2.75, places=2)
        self.assertAlmostEqual(const["speech"]["spokenWordsPerSecondMax"], 3.25, places=2)
        self.assertFalse(const["soundscape"]["requireAcousticMotif"])
        self.assertFalse(const["soundscape"]["requireOcclusionTrigger"])
        self.assertEqual(const["soundscape"]["silenceDropFloorDb"], -48.0)
        self.assertEqual(const["soundscape"]["scoreDuckDbDefault"], -8.5)
        self.assertGreaterEqual(len(const["retentionAndVoiceStyle"]["storyArchetypes"]), 5)

        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "story.json")
            ns = hs.argparse.Namespace(
                title="Đôi Dép Úp Trước Bậu Cửa", format="micro", parts=1, total_sec=70, mode="auto",
                aspect="9:16", pov="first_person_survivor", genre="folklore", adapt_mode="original", out=sp,
            )
            hs.cmd_seed(ns)
            doc = hs.read_json(sp)
            self.assertAlmostEqual(doc["params"]["wordsPerSecond"], 2.35, places=2)
            self.assertEqual(doc["narrativeStyle"]["gritLevel"], "clean_folklore")
            self.assertEqual(doc["soundscapeDesign"]["motifs"], [])
            self.assertNotIn("occlusionTrigger", doc["soundscapeDesign"]["farBed"])
            self.assertEqual(doc["soundscapeDesign"]["audioDirection"], "folklore_atmospheric")
            self.assertNotIn("scoreArc", doc["soundscapeDesign"])

        # Verify new v15 sample script hygiene (Step 1 + Step 2, 0 [PACE|PITCH], 0 forced profanity, fresh story)
        sample_p = os.path.join(REPO_ROOT, "examples", "script_v15_sample.md")
        self.assertTrue(os.path.isfile(sample_p), "Missing examples/script_v15_sample.md")
        with open(sample_p, encoding="utf-8") as fp:
            s_body = fp.read()
        self.assertIn("BƯỚC 1", s_body)
        self.assertIn("BƯỚC 2", s_body)
        self.assertIn("[SILENCE_DROP", s_body)
        self.assertIn("[thở dài]", s_body)
        self.assertNotIn("[PACE=", s_body)
        self.assertNotIn("PITCH=", s_body)
        self.assertNotIn("Mẹ kiếp", s_body)
        self.assertNotIn("Bỏ mẹ rồi", s_body)
        self.assertNotIn("Máy Nội Bộ 204", s_body)

    def test_v153_3act_score_ducking_hush_48db_and_3beat_jumpscare(self):
        with tempfile.TemporaryDirectory() as td:
            audio_root = os.path.join(td, "audio")
            lib_dir = os.path.join(audio_root, "sfx_library")
            cur_dir = os.path.join(audio_root, "sfx_curated")
            for sub in ("dark_drone", "sad_piano", "stinger", "ambience"):
                os.makedirs(os.path.join(cur_dir, sub), exist_ok=True)
            os.makedirs(lib_dir, exist_ok=True)

            sr = dsp.SR
            dur = 12.0
            t2 = np.arange(dsp.ns(3.0)) / sr
            # Curated WAV fixtures across the 4 curated folders
            dsp.write_wav(os.path.join(cur_dir, "sad_piano", "sad_piano_minimal.wav"), dsp.st(0.22 * np.sin(2 * np.pi * 261.6 * t2)))
            dsp.write_wav(os.path.join(cur_dir, "dark_drone", "dark_drone_pressure.wav"), dsp.st(0.26 * np.sin(2 * np.pi * 65.4 * t2)))
            dsp.write_wav(os.path.join(cur_dir, "dark_drone", "cold_sub_drone_tail.wav"), dsp.st(0.24 * np.sin(2 * np.pi * 55.0 * t2)))
            dsp.write_wav(os.path.join(cur_dir, "ambience", "night_rain_indoor.wav"), dsp.st(0.16 * dsp.colored(dsp.ns(3.0), dsp.rng(11), slope=0.4)))
            t_st = np.arange(dsp.ns(1.5)) / sr
            st_sig = 0.65 * np.exp(-2.8 * t_st) * (np.sin(2 * np.pi * 2400.0 * t_st) + 0.5 * np.sin(2 * np.pi * 62.0 * t_st))
            dsp.write_wav(os.path.join(cur_dir, "stinger", "violin_screech_stinger.wav"), dsp.st(st_sig))
            dsp.write_wav(os.path.join(cur_dir, "stinger", "cinematic_boom.wav"), dsp.st(0.70 * np.exp(-3.2 * t_st) * np.sin(2 * np.pi * 48.0 * t_st)))

            # Build clean voice with spoken spans [0.2..2.4s], gap [2.4..4.4s], spoken [4.4..6.4s], silence_drop [6.8..7.8s], twist [9.2..11.0s]
            voice_p = os.path.join(td, "voice.wav")
            words_p = os.path.join(td, "words.json")
            t_all = np.arange(dsp.ns(dur)) / sr
            v = np.zeros_like(t_all)
            for s0, e0 in ((0.2, 2.4), (4.4, 6.4), (9.2, 11.0)):
                a0, b0 = dsp.ns(s0), dsp.ns(e0)
                v[a0:b0] = 0.16 * np.sin(2 * np.pi * 165.0 * t_all[a0:b0])
            dsp.write_wav(voice_p, dsp.st(v))
            with open(words_p, "w", encoding="utf-8") as fp:
                json.dump({
                    "dur": dur,
                    "words": [
                        {"w": "Hook", "s": 0.2, "e": 2.4},
                        {"w": "Căng", "s": 4.4, "e": 6.4},
                        {"w": "Twist", "s": 9.2, "e": 11.0},
                    ],
                    "sentences": [{"sent": 1, "s": 0.2, "e": 2.4, "mood": "calm_omen"}],
                    "silence_drops": [{"s": 6.8, "e": 7.8}],
                }, fp)

            cues = {
                "voice": voice_p,
                "words": words_p,
                "library_dir": lib_dir,
                "curated_dir": cur_dir,
                "skip_history": True,
                "beds": [{"sound": "night_rain_indoor", "role": "far", "target_rms_dbfs": -34.0}],
                "music_arc": {
                    "act1": {"sound": "sad_piano_minimal", "target_rms_dbfs": -26.0},
                    "act2": {"sound": "dark_drone_pressure", "target_rms_dbfs": -24.0},
                    "aftermath": {"sound": "cold_sub_drone_tail", "target_rms_dbfs": -27.0},
                    "duck_db": -8.5,
                    "crossfade_s": 1.2,
                    "silence_drop_floor_db": -48.0,
                },
                "events": [
                    {
                        "id": "js_climax",
                        "jumpscare": "cinema_stab",
                        "sound": "violin_screech_stinger",
                        "sub_sound": "cinematic_boom",
                        "pre_swell_sound": "dark_drone_pressure",
                        "pre_swell_s": 1.2,
                        "at_silence_drop": 0,
                        "edge": "end",
                        "target_peak_dbfs": -1.0,
                    }
                ],
            }
            cues_p = os.path.join(td, "cues.json")
            with open(cues_p, "w", encoding="utf-8") as fp:
                json.dump(cues, fp)

            out_wav = os.path.join(td, "out", "mix.wav")
            res = mc.render_cues_mix(cues_p, out_wav, library_dir=lib_dir, strict=True)
            self.assertEqual(res["verdict"], "PASS")
            self.assertEqual(res["clips"], 0)
            self.assertLessEqual(res["stats"]["TP"], -0.85)
            self.assertEqual(len(res["score_beds"]), 3)
            self.assertAlmostEqual(res["music_duck_db"], -8.5, places=1)
            self.assertAlmostEqual(res["silence_drop_floor_db"], -48.0, places=1)
            self.assertTrue(res["silence_drops"][0]["bed_drop_db"] >= 25.0)

            # Verify automatic vocal ducking on rendered music stem (spoken [0.6..2.0s] vs open gap [2.9..3.9s])
            m_stem, _ = dsp.read_wav(os.path.join(td, "out", "audio", "stem_music.wav"))
            rms_spoken = mc.rms_db(m_stem[:, dsp.ns(0.6) : dsp.ns(2.0)])
            rms_gap = mc.rms_db(m_stem[:, dsp.ns(2.9) : dsp.ns(3.9)])
            self.assertLess(rms_spoken, rms_gap - 5.0, f"Expected smooth -7..-10 dB ducking: spoken={rms_spoken:.1f}, gap={rms_gap:.1f}")

            # Verify procedural `synth:` on music_arc still triggers SYNTH_SFX_FORBIDDEN under --strict
            bad_ma = json.loads(json.dumps(cues))
            bad_ma["music_arc"]["act2"] = {"synth": "sub_drone"}
            bad_p = os.path.join(td, "bad_ma.json")
            with open(bad_p, "w", encoding="utf-8") as fp:
                json.dump(bad_ma, fp)
            with self.assertRaises(RuntimeError) as ctx:
                mc.render_cues_mix(bad_p, os.path.join(td, "out_bad", "mix.wav"), library_dir=lib_dir, strict=True)
            self.assertIn("SYNTH_SFX_FORBIDDEN", str(ctx.exception))

    def test_v153_curated_sfx_priority_and_openverse_quality_filter(self):
        with tempfile.TemporaryDirectory() as td:
            audio_root = os.path.join(td, "audio")
            lib_dir = os.path.join(audio_root, "sfx_library")
            cur_dir = os.path.join(audio_root, "sfx_curated")
            for sub in ("dark_drone", "sad_piano", "stinger", "ambience"):
                os.makedirs(os.path.join(cur_dir, sub), exist_ok=True)
            os.makedirs(lib_dir, exist_ok=True)

            sr = dsp.SR
            t2 = np.arange(dsp.ns(2.0)) / sr
            dsp.write_wav(os.path.join(cur_dir, "dark_drone", "my_favorite_drone.wav"), dsp.st(0.25 * np.sin(2 * np.pi * 60.0 * t2)))
            dsp.write_wav(os.path.join(cur_dir, "stinger", "my_violin_stinger.wav"), dsp.st(0.45 * np.sin(2 * np.pi * 1800.0 * t2)))

            # 1. Unit-test `validate_sfx_audio_quality` directly on 4 cases
            p_short = os.path.join(td, "short.wav")
            p_clip = os.path.join(td, "clip.wav")
            p_silent = os.path.join(td, "silent.wav")
            p_clean = os.path.join(td, "clean.wav")
            dsp.write_wav(p_short, dsp.st(0.25 * np.sin(2 * np.pi * 120.0 * np.arange(dsp.ns(0.25)) / sr)))
            dsp.write_wav(p_clip, dsp.st(np.ones(dsp.ns(1.0), dtype=np.float64)))
            dsp.write_wav(p_silent, dsp.st(1e-4 * np.sin(2 * np.pi * 120.0 * np.arange(dsp.ns(1.0)) / sr)))
            dsp.write_wav(p_clean, dsp.st(0.30 * dsp.colored(dsp.ns(1.5), dsp.rng(55), slope=0.3)))

            ok_s, r_s, _ = sm.validate_sfx_audio_quality(p_short, category="dark_drone")
            self.assertFalse(ok_s)
            self.assertIn("too_short", r_s)

            ok_c, r_c, _ = sm.validate_sfx_audio_quality(p_clip, category="foley")
            self.assertFalse(ok_c)
            self.assertIn("heavily_clipped", r_c)

            ok_z, r_z, _ = sm.validate_sfx_audio_quality(p_silent, category="ambience")
            self.assertFalse(ok_z)
            self.assertIn("near_silent", r_z)

            ok_g, _, _ = sm.validate_sfx_audio_quality(p_clean, category="dark_drone")
            self.assertTrue(ok_g)

            # 2. End-to-end `auto_fetch_for_script`: curated assets MUST NOT hit Openverse; story foley filters bad Openverse hits!
            p_tiny_foley = os.path.join(td, "tiny_foley.wav")
            dsp.write_wav(p_tiny_foley, dsp.st(0.25 * np.sin(2 * np.pi * 220.0 * np.arange(dsp.ns(0.08)) / sr)))
            cues_p = os.path.join(td, "cues.json")
            with open(cues_p, "w", encoding="utf-8") as fp:
                json.dump({
                    "music_arc": {"act2": {"sound": "dark_drone_pressure"}},
                    "events": [
                        {"id": "f1", "sound": "wooden_knock_foley", "at": 1.0},
                        {"id": "js1", "jumpscare": "cinema_stab", "sound": "violin_screech_stinger", "at": 3.0},
                    ],
                }, fp)

            searched_queries = []

            def fake_get(url):
                searched_queries.append(url)
                return {
                    "results": [
                        {"id": "bad-short", "title": "Too Short", "creator": "T", "source": "freesound", "license": "cc0", "duration": 2000, "url": "https://ex.test/short.wav"},
                        {"id": "bad-clip", "title": "Clipped", "creator": "T", "source": "freesound", "license": "cc0", "duration": 2000, "url": "https://ex.test/clip.wav"},
                        {"id": "bad-silent", "title": "Silent", "creator": "T", "source": "freesound", "license": "cc0", "duration": 2000, "url": "https://ex.test/silent.wav"},
                        {"id": "good-clean", "title": "Clean Knock", "creator": "T", "source": "freesound", "license": "cc0", "duration": 2000, "url": "https://ex.test/clean.wav"},
                    ]
                }

            def fake_dl(url, dst):
                src_map = {
                    "https://ex.test/short.wav": p_tiny_foley,
                    "https://ex.test/clip.wav": p_clip,
                    "https://ex.test/silent.wav": p_silent,
                    "https://ex.test/clean.wav": p_clean,
                }
                import shutil
                shutil.copy2(src_map[url], dst)

            res_af = sm.auto_fetch_for_script(cues_p, lib_dir, curated_dir=cur_dir, http_get_fn=fake_get, download_fn=fake_dl)
            self.assertEqual(set(res_af["curated"]), {"dark_drone_pressure", "violin_screech_stinger"})
            self.assertEqual(res_af["fetched"], ["wooden_knock_foley"])
            self.assertEqual(res_af["failed"], [])
            # Openverse must ONLY have been queried for the non-curated story foley!
            self.assertEqual(len(searched_queries), 1)
            mf_out = sm.load_manifest(lib_dir)["assets"]
            self.assertEqual(mf_out["wooden_knock_foley"]["openverse_id"], "good-clean")
            self.assertTrue(mf_out["dark_drone_pressure"]["source"].startswith("curated:"))

    def test_v154_liveportrait_backend_import_and_analog_horror_fallback(self):
        # 1. Verify `gen_jumpscare_clip.py` completely removed legacy `Image.blend` ghosting!
        with open(os.path.join(SCRIPTS_DIR, "gen_jumpscare_clip.py"), encoding="utf-8") as fp_gjc:
            gjc_src = fp_gjc.read()
        self.assertNotIn("Image.blend", gjc_src, "Legacy Image.blend ghosting must be completely removed!")

        with tempfile.TemporaryDirectory() as td:
            proj_dir = os.path.join(td, "src", "demo-lp-v154")
            cast_dir = os.path.join(proj_dir, "assets", "cast")
            lp_dir = os.path.join(td, "LivePortrait")
            lp_drv_ex = os.path.join(lp_dir, "assets", "examples", "driving")
            motions_dir = os.path.join(td, "assets", "liveportrait_motions")
            for d in (cast_dir, lp_drv_ex, motions_dir):
                os.makedirs(d, exist_ok=True)

            # Fake official KlingAIResearch/LivePortrait checkout + motion templates
            with open(os.path.join(lp_dir, "inference.py"), "w", encoding="utf-8") as fp:
                fp.write("# mock LivePortrait inference.py\n")
            with open(os.path.join(lp_drv_ex, "d0.pkl"), "wb") as fp:
                fp.write(b"mock_ex_pkl")
            with open(os.path.join(motions_dir, "neck_snap_stare.pkl"), "wb") as fp:
                fp.write(b"mock_neck_snap_pkl")

            # Anchor frame (cool dark blue room) + entity scare cutout (high contrast pale figure)
            anchor_p = os.path.join(td, "anchor.png")
            ent_p = os.path.join(cast_dir, "C02_entity_scare.png")
            Image.fromarray(np.full((640, 360, 3), [22, 28, 38], dtype=np.uint8), mode="RGB").save(anchor_p)
            ent_rgba = np.zeros((320, 200, 4), dtype=np.uint8)
            ent_rgba[24:296, 40:160] = [210, 200, 195, 255]
            ent_rgba[60:80, 75:95] = [12, 12, 14, 255]   # hollow eye left
            ent_rgba[60:80, 110:130] = [12, 12, 14, 255]  # hollow eye right
            Image.fromarray(ent_rgba, mode="RGBA").save(ent_p)

            manifest = {
                "projectId": "demo-lp-v154",
                "title": "LivePortrait Jumpscare Test",
                "totalFrames": 300,
                "aspect": "9:16",
                "characterMode": "sprite2d",
                "locations": [],
                "castBlueprints": [
                    {
                        "id": "C02",
                        "role": "entity",
                        "scareTier": 6,
                        "storyDescription": "Tall uncanny apparition tilting its neck sharply",
                        "spriteAssets": {"entity_scare": "assets/cast/C02_entity_scare.png"},
                    }
                ],
                "beats": [],
                "jumpscareClips": [
                    {
                        "id": "js1",
                        "src": "assets/jumpscare_js1.mp4",
                        "a": 150,
                        "b": 204,  # 1.80s
                        "anchorFrame": 149,
                        "transitionStyle": "whip_pan_turn",
                        "entityId": "C02",
                    }
                ],
            }
            man_p = os.path.join(proj_dir, "manifest.json")
            with open(man_p, "w", encoding="utf-8") as fp:
                json.dump(manifest, fp, ensure_ascii=False, indent=2)

            # Helper to synthesize tiny real MP4s via ffmpeg for mock LivePortrait output & --import-jumpscare
            def _make_solid_mp4(dst_mp4: str, color_hex: str, dur_s: float = 2.0):
                subprocess.run(
                    [
                        "ffmpeg", "-y", "-v", "error",
                        "-f", "lavfi", "-i", f"color=c={color_hex}:s=360x640:r=30:d={dur_s:.2f}",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", dst_mp4,
                    ],
                    check=True,
                )

            def _probe_video(mp4_p: str) -> dict:
                out = subprocess.check_output(
                    ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,r_frame_rate", "-of", "json", mp4_p],
                    text=True,
                )
                return json.loads(out)

            # 2. Test LivePortrait backend (mock subprocess.run ONLY on inference.py; run REAL ffmpeg post-FX!)
            captured_lp_cmds = []
            real_subproc_run = subprocess.run

            def fake_run(cmd, *a, **kw):
                if isinstance(cmd, (list, tuple)) and len(cmd) >= 2 and str(cmd[1]).endswith("inference.py"):
                    captured_lp_cmds.append(list(cmd))
                    out_idx = cmd.index("-o") + 1
                    lp_out = cmd[out_idx]
                    os.makedirs(lp_out, exist_ok=True)
                    primary_mp4 = os.path.join(lp_out, "lp_source--neck_snap_stare.mp4")
                    concat_mp4 = os.path.join(lp_out, "lp_source--neck_snap_stare_concat.mp4")
                    _make_solid_mp4(primary_mp4, "0xCC2222", dur_s=2.2)
                    # Make *_concat.mp4 deliberately larger & newer so a buggy selector would pick it!
                    _make_solid_mp4(concat_mp4, "0x11DD11", dur_s=3.5)
                    return subprocess.CompletedProcess(cmd, 0)
                return real_subproc_run(cmd, *a, **kw)

            with mock.patch.object(gjc.subprocess, "run", side_effect=fake_run):
                res_lp = gjc.generate_jumpscare_clips(
                    man_p,
                    anchor_override=anchor_p,
                    backend="auto",
                    liveportrait_dir=lp_dir,
                    liveportrait_python="/opt/conda/envs/liveportrait/bin/python",
                    motions_dir=motions_dir,
                    lp_fp32=True,
                    overwrite=True,
                )
            self.assertEqual(len(captured_lp_cmds), 1)
            lp_cmd = captured_lp_cmds[0]
            self.assertEqual(lp_cmd[0], "/opt/conda/envs/liveportrait/bin/python")
            self.assertIn("--no_flag_use_half_precision", lp_cmd)
            self.assertNotIn("--flag_do_torch_compile", lp_cmd)
            self.assertTrue(lp_cmd[lp_cmd.index("-d") + 1].endswith("neck_snap_stare.pkl"))
            self.assertEqual(res_lp[0]["backend"], "liveportrait:neck_snap_stare.pkl")

            lp_mp4 = res_lp[0]["mp4"]
            self.assertTrue(os.path.isfile(lp_mp4))
            info_lp = _probe_video(lp_mp4)
            dur_lp = float(info_lp["format"]["duration"])
            self.assertGreaterEqual(dur_lp, 1.15)
            self.assertLessEqual(dur_lp, 2.25)
            self.assertFalse(any(s.get("codec_type") == "audio" for s in info_lp["streams"]))

            # Verify post-processed frame came from RED primary video (NOT GREEN *_concat.mp4!)
            mid_raw = subprocess.check_output(
                [
                    "ffmpeg", "-v", "error", "-ss", "0.50", "-i", lp_mp4,
                    "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
                ]
            )
            mid_arr = np.frombuffer(mid_raw, dtype=np.uint8).reshape((1920, 1080, 3))
            self.assertGreater(float(mid_arr[..., 0].mean()), float(mid_arr[..., 1].mean()) + 40.0, "Must use primary LivePortrait MP4, NOT *_concat.mp4!")

            # Verify fallback driving discovery into `LivePortrait/assets/examples/driving/` when motions_dir is empty
            empty_m = os.path.join(td, "empty_motions")
            os.makedirs(empty_m, exist_ok=True)
            ex_drv = gjc.select_liveportrait_driving_motion(5, "first_frame_seamless", empty_m, lp_dir)
            self.assertTrue(ex_drv.endswith("d0.pkl"))

            # 3. Test `--import-jumpscare <file.mp4>`
            ext_clip = os.path.join(td, "external_scare.mp4")
            _make_solid_mp4(ext_clip, "0x445588", dur_s=2.4)
            res_imp = gjc.generate_jumpscare_clips(man_p, import_jumpscare=ext_clip, overwrite=True)
            self.assertEqual(res_imp[0]["backend"], "imported_jumpscare")
            self.assertTrue(os.path.isfile(res_imp[0]["mp4"]))
            info_imp = _probe_video(res_imp[0]["mp4"])
            self.assertFalse(any(s.get("codec_type") == "audio" for s in info_imp["streams"]))

            # 4. Test new Analog Horror Hard-Cut local fallback (tight 0.7-1.1s, blackout flash -> RGB-split peak -> hard cut black!)
            out_local = os.path.join(td, "analog_local.mp4")
            gjc.render_local_first_frame_jumpscare(
                anchor_p, out_local, duration_sec=2.0, fps=30, width=360, height=640,
                transition_style="silence_hard_cut", entity_png_path=ent_p,
            )
            info_loc = _probe_video(out_local)
            dur_loc = float(info_loc["format"]["duration"])
            self.assertGreaterEqual(dur_loc, 0.68)
            self.assertLessEqual(dur_loc, 1.15, f"Analog Horror fallback must clamp tightly to 0.7-1.1s, got {dur_loc:.2f}s")

            raw_all = subprocess.check_output(
                ["ffmpeg", "-v", "error", "-i", out_local, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
            )
            n_f = len(raw_all) // (640 * 360 * 3)
            frames = np.frombuffer(raw_all[: n_f * 640 * 360 * 3], dtype=np.uint8).reshape((n_f, 640, 360, 3))
            # Frame 0 = anchor frame (non-black blue room)
            self.assertGreater(float(frames[0].mean()), 15.0)
            # Frames 1 & 2 = 2-frame Blackout Flash
            self.assertLess(float(frames[1].mean()), 2.0, "Frame 1 must be Blackout Flash")
            self.assertLess(float(frames[2].mean()), 2.0, "Frame 2 must be Blackout Flash")
            # Frame 3 = Hard Cut into high-contrast bright flash close-up with strong RGB Chromatic Split
            self.assertGreater(float(frames[3].mean()), 20.0, "Frame 3 must hard-cut into close-up face flash")
            rgb_split = float(np.mean(np.abs(frames[4, :, :, 0].astype(np.float32) - frames[4, :, :, 2].astype(np.float32))))
            self.assertGreater(rgb_split, 1.5, "Expected measurable RGB chromatic aberration split on hard-cut close-up")
            # Final frame = Hard Cut to Black
            self.assertLess(float(frames[-1].mean()), 2.0, "Final frame must Hard Cut to Black")

    def test_v155_flexible_audio_direction_curated_rotation_and_4gb_vram(self):
        # 1. Verify constitution v15.5 flexible audio rules
        const = constitution.load_constitution()
        sc = const["soundscape"]
        self.assertFalse(sc["requireScoreBeds"])
        self.assertEqual(sc["validAudioDirections"], ["raw_diegetic", "folklore_atmospheric", "cinematic_score"])
        for st in ("practical_impact", "mic_emf_glitch", "entity_breath_shriek", "cinema_stab", "entity_shriek", "metal_dread", "vhs_psx_glitch"):
            self.assertIn(st, sc["validJumpscareAudioStyles"])

        with tempfile.TemporaryDirectory() as td:
            audio_root = os.path.join(td, "audio")
            lib_dir = os.path.join(audio_root, "sfx_library")
            cur_dir = os.path.join(audio_root, "sfx_curated")
            for sub in ("dark_drone", "sad_piano", "stinger", "ambience"):
                os.makedirs(os.path.join(cur_dir, sub), exist_ok=True)
            os.makedirs(lib_dir, exist_ok=True)

            sr = dsp.SR
            dur = 10.0
            t2 = np.arange(dsp.ns(2.5)) / sr
            t_hit = np.arange(dsp.ns(1.2)) / sr

            # Create fixtures: room_tone + practical door slam + emf glitch + entity shriek + 2 curated drone variants
            dsp.write_wav(os.path.join(lib_dir, "room_tone_dark.wav"), dsp.st(0.14 * dsp.colored(dsp.ns(3.0), dsp.rng(7), slope=0.35)))
            slam_sig = 0.72 * np.exp(-3.8 * t_hit) * (np.sin(2 * np.pi * 88.0 * t_hit) + 0.45 * dsp.colored(len(t_hit), dsp.rng(8), slope=0.1))
            dsp.write_wav(os.path.join(lib_dir, "heavy_door_slam.wav"), dsp.st(slam_sig))
            dsp.write_wav(os.path.join(lib_dir, "emf_glitch_buzz.wav"), dsp.st(0.55 * np.exp(-2.5 * t_hit) * np.sin(2 * np.pi * 2100.0 * t_hit)))
            dsp.write_wav(os.path.join(lib_dir, "jumpscare_entity_shriek_ov.wav"), dsp.st(0.60 * np.exp(-2.2 * t_hit) * np.sin(2 * np.pi * 1750.0 * t_hit)))
            dsp.write_wav(os.path.join(cur_dir, "dark_drone", "drone_a.wav"), dsp.st(0.24 * np.sin(2 * np.pi * 58.0 * t2)))
            dsp.write_wav(os.path.join(cur_dir, "dark_drone", "drone_b.wav"), dsp.st(0.24 * np.sin(2 * np.pi * 72.0 * t2)))

            voice_p = os.path.join(td, "voice.wav")
            words_p = os.path.join(td, "words.json")
            t_all = np.arange(dsp.ns(dur)) / sr
            v = np.zeros_like(t_all)
            for s0, e0 in ((0.2, 4.2), (7.6, 9.4)):
                v[dsp.ns(s0) : dsp.ns(e0)] = 0.16 * np.sin(2 * np.pi * 160.0 * t_all[dsp.ns(s0) : dsp.ns(e0)])
            dsp.write_wav(voice_p, dsp.st(v))
            with open(words_p, "w", encoding="utf-8") as fp:
                json.dump({
                    "dur": dur,
                    "words": [{"w": "Cửa", "s": 0.2, "e": 4.2}, {"w": "Hết", "s": 7.6, "e": 9.4}],
                    "sentences": [{"sent": 1, "s": 0.2, "e": 4.2, "mood": "calm_omen"}],
                    "silence_drops": [{"s": 5.2, "e": 6.1}],
                }, fp)

            # 2. `raw_diegetic` (0% score + `practical_impact`) MUST PASS with score_beds == []
            cues_raw = {
                "audioDirection": "raw_diegetic",
                "voice": voice_p,
                "words": words_p,
                "library_dir": lib_dir,
                "curated_dir": cur_dir,
                "skip_history": True,
                "beds": [{"sound": "room_tone_dark", "role": "near", "target_rms_dbfs": -34.0}],
                "events": [
                    {
                        "id": "js_slam",
                        "jumpscare": "practical_impact",
                        "sound": "heavy_door_slam",
                        "at_silence_drop": 0,
                        "edge": "end",
                        "target_peak_dbfs": -1.0,
                    }
                ],
            }
            cues_raw_p = os.path.join(td, "cues_raw.json")
            with open(cues_raw_p, "w", encoding="utf-8") as fp:
                json.dump(cues_raw, fp)
            res_raw = mc.render_cues_mix(cues_raw_p, os.path.join(td, "out_raw", "mix.wav"), library_dir=lib_dir, strict=True)
            self.assertEqual(res_raw["verdict"], "PASS")
            self.assertEqual(res_raw["audio_direction"], "raw_diegetic")
            self.assertEqual(res_raw["score_beds"], [])
            self.assertEqual(res_raw["jumpscares"][0]["style"], "practical_impact")

            # Adding music_arc under `raw_diegetic` MUST FAIL with RAW_DIEGETIC_SCORE_FORBIDDEN!
            bad_raw = json.loads(json.dumps(cues_raw))
            bad_raw["music_arc"] = {"act1": {"sound": "dark_drone_pressure"}}
            bad_raw_p = os.path.join(td, "bad_raw.json")
            with open(bad_raw_p, "w", encoding="utf-8") as fp:
                json.dump(bad_raw, fp)
            with self.assertRaises(RuntimeError) as ctx_rd:
                mc.render_cues_mix(bad_raw_p, os.path.join(td, "out_bad_rd", "mix.wav"), library_dir=lib_dir, strict=True)
            self.assertIn("RAW_DIEGETIC_SCORE_FORBIDDEN", str(ctx_rd.exception))

            # 3. `folklore_atmospheric` (`entity_breath_shriek`) & `cinematic_score` (`mic_emf_glitch`) work cleanly
            for adir, jstyle, jsnd in (
                ("folklore_atmospheric", "entity_breath_shriek", "jumpscare_entity_shriek_ov"),
                ("cinematic_score", "mic_emf_glitch", "emf_glitch_buzz"),
            ):
                c_doc = json.loads(json.dumps(cues_raw))
                c_doc["audioDirection"] = adir
                c_doc["events"][0]["jumpscare"] = jstyle
                c_doc["events"][0]["sound"] = jsnd
                cp = os.path.join(td, f"cues_{adir}.json")
                with open(cp, "w", encoding="utf-8") as fp:
                    json.dump(c_doc, fp)
                r_ok = mc.render_cues_mix(cp, os.path.join(td, f"out_{adir}", "mix.wav"), library_dir=lib_dir, strict=True)
                self.assertEqual(r_ok["verdict"], "PASS")
                self.assertEqual(r_ok["audio_direction"], adir)
                self.assertEqual(r_ok["jumpscares"][0]["style"], jstyle)

            # 4. Curated SFX `history.jsonl` anti-repeat rotation between `drone_a.wav` and `drone_b.wav`
            p1, g1 = sm.find_curated_sfx("dark_drone_pressure", category="dark_drone", curated_dir=cur_dir, lib_dir=lib_dir, exclude_ids=set())
            self.assertEqual(g1, "dark_drone")
            self.assertEqual(os.path.basename(p1), "drone_a.wav")
            sm.append_history(lib_dir, "proj_prev", [f"curated:{g1}:{os.path.basename(p1)}"])
            excl_hist = sm.load_recent_history(lib_dir)
            p2, g2 = sm.find_curated_sfx("dark_drone_pressure", category="dark_drone", curated_dir=cur_dir, lib_dir=lib_dir, exclude_ids=excl_hist)
            self.assertEqual(g2, "dark_drone")
            self.assertEqual(os.path.basename(p2), "drone_b.wav", "history.jsonl rotation must pick fresh curated variant!")

            # 5. GTX 960M 4GB VRAM default LivePortrait source frame size = 512x640
            src_in = os.path.join(td, "src_anchor.png")
            src_out = os.path.join(td, "src_lp.png")
            Image.fromarray(np.full((1920, 1080, 3), 40, dtype=np.uint8), mode="RGB").save(src_in)
            gjc.prepare_liveportrait_source_image(src_in, None, src_out)
            with Image.open(src_out) as im_lp:
                self.assertEqual(im_lp.size, (512, 640))


if __name__ == "__main__":
    unittest.main()
