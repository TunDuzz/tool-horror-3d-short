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


if __name__ == "__main__":
    unittest.main()
