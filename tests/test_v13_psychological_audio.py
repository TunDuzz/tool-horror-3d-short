import json
import os
import sys
import tempfile
import unittest
import numpy as np

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEMPLATES_SCRIPTS = os.path.join(REPO_ROOT, "templates", "scripts")
TEMPLATES_AUDIO = os.path.join(REPO_ROOT, "templates", "audio")
for p in (TEMPLATES_SCRIPTS, TEMPLATES_AUDIO):
    if p not in sys.path:
        sys.path.insert(0, p)

import constitution  # noqa: E402
import dsp  # noqa: E402
import gen_horror_voice  # noqa: E402
import horror_instruments  # noqa: E402
import horror_story  # noqa: E402
import mix_base  # noqa: E402
import mix_cues  # noqa: E402


class TestV13PsychologicalVoiceAndSoundscape(unittest.TestCase):
    def test_constitution_v13_soundscape_and_speech_rules(self):
        const = constitution.load_constitution()
        self.assertEqual(const["version"], "15.0.0")
        sp = const["speech"]
        self.assertLessEqual(sp["spokenWordsPerSecondMax"], 3.65)
        self.assertIn("[BEAT Xs]", sp["directives"])
        self.assertIn("[SILENCE_DROP Xs]", sp["directives"])

        sc = const["soundscape"]
        self.assertEqual(sc["minJumpscaresPerPart"], 1)
        self.assertEqual(sc["hardMaxJumpscaresShort"], 2)
        self.assertEqual(sc["maxBeds"], 2)
        self.assertEqual(sc["targetLufs"], -16.0)
        self.assertEqual(sc["jumpscareTruePeakDb"], -1.0)
        self.assertIn("close_ear", sc["validSpaceZones"])
        self.assertIn("adjacent_muffled", sc["validSpaceZones"])
        self.assertIn("steady_then_stop", sc["validMotifModes"])
        self.assertIn("approach", sc["validMotifModes"])

    def test_horror_story_gate25_subtext_motif_and_blueprint_v13(self):
        with tempfile.TemporaryDirectory() as td:
            story_p = os.path.join(td, "story.json")
            ns = horror_story.argparse.Namespace(
                title="Bến Đò Đêm Mưa",
                format="short",
                parts=3,
                total_sec=180,
                mode="auto",
                aspect="9:16",
                pov="first_person_survivor",
                genre="folklore",
                adapt_mode="original",
                out=story_p,
            )
            horror_story.cmd_seed(ns)
            doc = horror_story.read_json(story_p)
            self.assertEqual(doc["schemaVersion"], "3.2")
            self.assertIn("soundscapeDesign", doc)
            self.assertGreaterEqual(doc["params"]["thresholds"]["minJumpscaresTotal"], 1)
            self.assertGreaterEqual(doc["params"]["thresholds"]["maxJumpscaresTotal"], 2)

            # Populate minimal valid v3.2 story to test Gate 25 & Gate 26 compatibility
            doc["premise"]["core"] = "Người gác đò đêm cuối phát hiện sổ điểm danh ghi tên người đã khuất"
            doc["premise"]["entityRule"] = "Không trả lời tiếng gọi tên từ ngoài sông sau 1 giờ sáng"
            doc["premise"]["twistCore"] = "Tờ giấy giao ca chú Tư đưa vốn là biên bản vớt xác"
            doc["worldLore"]["era"] = "1999 miền Tây"
            doc["worldLore"]["settingDetail"] = "Bến phà cũ cô lập mùa nước nổi"
            doc["worldLore"]["backstory"] = "Vụ chìm phà đêm mưa năm trước"
            doc["entityProfile"]["name"] = "Khách Đò Cuối"
            doc["entityProfile"]["origin"] = "Hành khách mắc kẹt dưới khoang phà"
            doc["entityProfile"]["rules"] = [
                {"rule": "Đốt vé ướt", "trigger": "Giữ vé ướt quá 5 phút", "consequence": "Nước sông tràn vào quầy", "loophole": "Bỏ vào lò than"},
                {"rule": "Khóa cửa lúc 1h", "trigger": "Mở cửa khi chuông reo", "consequence": "Bị kéo xuống bến", "loophole": "Cài chốt sắt"},
            ]
            for c in doc["characters"]:
                c["name"] = "Nam" if c["id"] == "C01" else "Bóng Áo Mưa"
                c["arc"] = "Từ hoài nghi sang sững sờ nhận ra sự thật"
                c["appearanceBrief"] = "Thanh niên mặc áo sơ mi sờn lạnh run trong quầy gỗ"
                if c["id"] == "C01":
                    c["goal"] = "Trực hết đêm kiếm tiền viện phí"
                    c["trappedReason"] = "Nước lũ ngập đường độc đạo không thể về thị trấn"
                    c["flaw"] = "Tò mò mở sổ cũ"
            doc["characters"].append({
                "id": "C03",
                "name": "Chú Tư",
                "tier": "support",
                "roleType": "human",
                "role": "Người gác phà già miền Nam",
                "voiceProfile": "Nam lớn tuổi miền Nam, giọng trầm khàn dè chừng",
                "appearanceBrief": "Ông lão mặc áo mưa nilon bạc màu đứng ngoài hiên mưa",
                "arc": "Trao lại ca trực rồi vội vã rời bến",
                "from": ["Sáng tác mới"],
            })
            doc["scenes"][0]["name"] = "Quầy vé gỗ bến phà"
            doc["scenes"][0]["atmosphere"] = "Mùi bùn non tanh nồng và tiếng mưa gõ mái tôn"
            for a in doc["acts"]:
                a["goal"] = "Thiết lập ca trực"
                a["turningPoint"] = "Phát hiện dòng chữ ướt bùn"
            for cl in doc["clues"]:
                cl["plantedDetail"] = "Vết bùn khô hình bàn tay dưới mặt bàn"
                cl["recontextualization"] = "Chính người gác trước đã bị kéo từ dưới sàn lên"
            for b in doc["beats"]:
                b["setup"] = "Tiếng giọt nước rơi đều trên mặt sổ"
                b["payoff"] = "Giọt nước ngừng rơi ngay khi có tiếng thở sát gáy"
            doc["props"] = [
                {"id": "P_BOLT", "name": "Chốt cửa sắt", "sceneId": "S01", "initialState": "open", "states": ["open", "locked"], "function": "Ngăn người ngoài hiên", "beatIds": ["B01"]},
            ]
            for idx_p, p in enumerate(doc["parts"], 1):
                p["newInfoRevealed"] = f"Chi tiết bất thường số {idx_p}"
                p["hook"] = "Sổ trực đêm nay tự dưng ghi tên thằng đã chết" if idx_p == 1 else "Tiếng mưa rát trên mái tôn gỉ"
                if idx_p == 1:
                    p["coldHook"] = {
                        "hookArchetype": "paradox_prop",
                        "openingLine": "Sổ điểm danh phà đêm nay tự dưng hiện tên thằng vừa chết tuần trước.",
                        "openingSoundCue": "wet_wood_creak",
                    }
                p["suspense"] = "Tiếng gõ dừng lại ở nhịp thứ hai"
                p["characterIds"] = ["C01", "C02", "C03"]
                p["propIds"] = ["P_BOLT"]
                p["soundCues"] = ["water_drip_echo"]
                # First make synopsis violate anti-exposition rule!
                p["synopsis"] = "Tôi cảm thấy vô cùng kinh hãi vì bầu không khí thật rùng rợn như có ma quỷ."
                p["actionBeats"] = [
                    {
                        "beatId": f"P{idx_p}_AB1",
                        "sceneId": "S01",
                        "durationSec": float(p["target_sec"]) * 0.5,
                        "mood": "calm_omen",
                        "light": "warmLamp",
                        "camera": {"posLandmark": "POV_START", "lookLandmark": "HERO_PROP_SPOT"},
                        "actors": [{"id": "C01", "visible": True, "fromLandmark": "POV_START", "toLandmark": "POV_START", "pose": "standIdle"}],
                        "propChanges": [{"id": "P_BOLT", "fromState": "open" if idx_p == 1 else "locked", "toState": "locked", "triggerWord": "chốt"}],
                        "actionSummary": "Đứng trong quầy nghe tiếng dột",
                        "subtext": "Cố tự trấn an chỉ là gió lùa",
                        "sensoryDetails": {"sight": "Ánh đèn dầu vàng đục", "sound": "Nước nhỏ từng giọt đều đặn"},
                        "spokenBeat": {"speaker": "Chú Tư" if idx_p == 1 else "NARRATOR", "intent": "Dặn quy tắc ca đêm", "keyPhrase": "gài chặt chốt", "mood": "tense", "wordBudget": 65},
                    },
                    {
                        "beatId": f"P{idx_p}_AB2",
                        "sceneId": "S01",
                        "durationSec": float(p["target_sec"]) * 0.5,
                        "mood": "dread",
                        "light": "warmLamp",
                        "camera": {"posLandmark": "POV_START", "lookLandmark": "MAIN_DOOR"},
                        "actors": [{"id": "C01", "visible": True, "fromLandmark": "POV_START", "toLandmark": "POV_START", "pose": "peerForward"}],
                        "propChanges": [],
                        "actionSummary": "Nhìn ra cửa gỗ",
                        "subtext": "Nhận ra sự im lặng bất thường ngoài hiên",
                        "sensoryDetails": {"sight": "Khe cửa tối sẫm", "sound": "Tiếng mưa đục đi sau cánh cửa đóng"},
                        "spokenBeat": {"speaker": "NARRATOR", "intent": "Lắng nghe tiếng gõ", "keyPhrase": "im phăng phắc", "mood": "dread", "wordBudget": 65, "delivery": {"prox": "close_ear", "pace": "slow", "beatBeforeSec": 0.45}},
                        **({"jumpscareStyle": "cinema_stab"} if idx_p == 2 else {}),  # Missing jumpscareReason!
                    },
                ]

            doc["soundscapeDesign"]["motifs"] = []  # Missing motif -> Gate 25 must fail!
            gates_bad, failed_bad = horror_story.evaluate_gates(doc, stage="full", strict_story=True)
            g25_bad = next((g for g in gates_bad if "25." in g["title"]), None)
            self.assertIsNotNone(g25_bad)
            self.assertFalse(g25_bad["ok"])

            # Fix synopsis to sensory prose, provide justified jumpscareReason on each chapter (v15.0 >= 1/chapter), add motif with breakBeatId
            for p in doc["parts"]:
                p["synopsis"] = "Ngoài hiên mưa tạt lạnh qua khe ván, cuốn sổ trực nằm mở sẵn ở trang cuối nhòe bùn."
                ab_last = p["actionBeats"][-1]
                ab_last["jumpscareStyle"] = "cinema_stab"
                ab_last["jumpscareReason"] = "Bóng áo mưa đột ngột áp sát khe cửa đúng lúc giọt nước dột ngừng rơi"
            doc["soundscapeDesign"] = {
                "nearBed": {"sound": "room_tone_dark", "label": "Không gian gỗ ẩm trong quầy"},
                "farBed": {
                    "sound": "night_rain_indoor",
                    "label": "Mưa sông Hậu ngoài mái tôn",
                    "occlusionTrigger": {"atWord": "chốt", "lpHz": 580, "gainDeltaDb": -6.5},
                },
                "motifs": [
                    {
                        "id": "m_drip",
                        "sound": "water_drip_echo",
                        "intervalSec": 2.5,
                        "mode": "steady_then_stop",
                        "meaning": "Giọt nước dột từ mái hiên đếm nhịp thời gian",
                        "breakBeatId": "P1_AB2",
                    }
                ],
            }
            gates_ok, failed_ok = horror_story.evaluate_gates(doc, stage="full", strict_story=True)
            self.assertEqual(failed_ok, [], f"Unexpected gate failures: {failed_ok}")

            # Export blueprint and inspect v13 SCRIPT.skeleton.md & cues.draft.json
            horror_story.write_text(story_p, json.dumps(doc, ensure_ascii=False, indent=2))
            bp_dir = os.path.join(td, "bp")
            ns_bp = horror_story.argparse.Namespace(
                story=story_p, out=bp_dir, part=1, all_parts=True, project_id="ben-do", aspect="9:16", bed_sound="night_rain_indoor"
            )
            horror_story.cmd_export_blueprint(ns_bp)
            with open(os.path.join(bp_dir, "p01", "SCRIPT.skeleton.md"), encoding="utf-8") as fp_sk:
                sk_txt = fp_sk.read()
            with open(os.path.join(bp_dir, "p01", "cues.draft.json"), encoding="utf-8") as fp_cd:
                cues_d = json.load(fp_cd)
            self.assertIn("[BEAT 0.45s]", sk_txt)
            self.assertIn("voice=Thái Sơn", sk_txt)  # Elderly Southern male auto-cast distinct from narrator!
            self.assertEqual(cues_d["min_jumpscares"], 1)
            self.assertGreaterEqual(cues_d["max_jumpscares"], 2)
            self.assertEqual(len(cues_d["beds"]), 2)
            self.assertTrue(len(cues_d.get("motifs") or []) >= 1)
            self.assertFalse(any(ev.get("synth") == "reverse_suck" for ev in cues_d.get("events", [])))

    def test_voice_clause_prosody_silence_drop_and_auto_casting(self):
        with tempfile.TemporaryDirectory() as td:
            sp = os.path.join(td, "SCRIPT.md")
            with open(sp, "w", encoding="utf-8") as fp:
                fp.write(
                    "[VISUAL 2.2s]\n"
                    "[NARRATOR | mood=calm_omen]\n"
                    "Đêm cuối mùa nước nổi, mưa rơi đều ngoài hiên gỗ.\n"
                    "[SPEAKER: CHÚ TƯ | mood=tense | profile=elder_male_south | fx=adjacent_muffled]\n"
                    "Đừng mở cửa sau một giờ sáng nghe con!\n"
                    "[SILENCE_DROP 1.15s]\n"
                    "[NARRATOR | mood=whisper | prox=close]\n"
                    "Tiếng dột ngoài mái tôn bỗng im bặt... [BEAT 0.45s] [PACE=0.82 | PITCH=-1.0] chỉ còn tiếng thở ngay sát sau gáy tôi.\n"
                )
            items = gen_horror_voice.parse_script(sp, enable_clause_dsp_split=True)
            speech_items = [it for it in items if it["kind"] == "speech"]
            self.assertTrue(any(it["kind"] == "silence_drop" for it in items))
            self.assertTrue(any(it["kind"] == "beat_pause" for it in items))

            # Verify automatic distinct VieNeu voice casting for Chú Tư vs Narrator
            chu_tu = next(it for it in speech_items if it["speaker"] == "CHÚ TƯ")
            nar_items = [it for it in speech_items if it["is_narrator"]]
            self.assertNotEqual(chu_tu.get("vieneu_voice"), nar_items[0].get("vieneu_voice"))
            # Verify final clause picked up explicit pace/pitch/prox overrides
            last_clause = nar_items[-1]
            self.assertEqual(last_clause.get("prox"), "close")
            self.assertAlmostEqual(float(last_clause.get("clause_pace")), 0.82, places=2)
            self.assertAlmostEqual(float(last_clause.get("clause_pitch_st")), -1.0, places=2)

            # Assemble voice using deterministic broadband synth_fn to verify dynamic level & spectral shaping
            def fake_synth(item, sr, idx):
                words_tok = item["text"].split()
                dur_s = max(0.45, len(words_tok) * 0.36)
                t = np.linspace(0, dur_s, int(dur_s * sr), endpoint=False)
                # Rich harmonics up to 5kHz so muffled LP vs close_ear air is measurable
                sig = sum((0.22 / k) * np.sin(2 * np.pi * 145.0 * k * t) for k in range(1, 28))
                w = gen_horror_voice.estimate_syllable_words(item["text"], dur_s, 0.0, item["speaker"], item["mood"])
                return sig, w

            out_vdir = os.path.join(td, "voice")
            args = gen_horror_voice.build_parser().parse_args(["--script", sp, "--out-dir", out_vdir, "--no-vc", "--word-aligner", "proportional"])
            wav_p, words_p, payload = gen_horror_voice.assemble_voice(items, args, td, synth_fn=fake_synth)
            self.assertEqual(len(payload.get("silence_drops") or []), 1)
            self.assertAlmostEqual(payload["silence_drops"][0]["e"] - payload["silence_drops"][0]["s"], 1.15, places=2)

            wav_x, sr = gen_horror_voice.read_wav_mono(wav_p)
            sents = payload["sentences"]
            tense_s = next(s for s in sents if s["speaker"] == "CHÚ TƯ")
            whisp_s = sents[-1]
            rms_tense = np.sqrt(np.mean(wav_x[int(tense_s["s"] * sr) : int(tense_s["e"] * sr)] ** 2))
            rms_whisp = np.sqrt(np.mean(wav_x[int(whisp_s["s"] * sr) : int(whisp_s["e"] * sr)] ** 2))
            # Whisper/close-ear must genuinely sit quieter than urgent tense warning (not flattened!)
            self.assertLess(rms_whisp, rms_tense * 0.72)

    def test_dsp_time_varying_lp_and_binaural_pan_trajectory(self):
        r = dsp.rng(42)
        dur = 2.0
        x = dsp.colored(dsp.ns(dur), r, slope=0.2)
        # Sweep cutoff from open 5000 Hz [0..0.8s] down to occluded 450 Hz [1.2..2.0s]
        y = dsp.time_varying_lp(x, [(0.0, 5000.0), (0.8, 5000.0), (1.2, 450.0), (2.0, 450.0)])
        self.assertEqual(y.shape, x.shape)
        self.assertFalse(np.any(np.isnan(y)))
        hi_first = np.sqrt(np.mean(dsp.hp(y[: dsp.ns(0.7)], 1800.0) ** 2))
        hi_last = np.sqrt(np.mean(dsp.hp(y[dsp.ns(1.3) :], 1800.0) ** 2))
        self.assertLess(hi_last, hi_first * 0.25)

        st_mov = dsp.pan_trajectory(x, [(0.0, -0.85), (2.0, 0.85)], itd_binaural=True)
        self.assertEqual(st_mov.shape, (2, dsp.ns(dur)))
        l_early = np.sqrt(np.mean(st_mov[0, : dsp.ns(0.4)] ** 2))
        r_early = np.sqrt(np.mean(st_mov[1, : dsp.ns(0.4)] ** 2))
        l_late = np.sqrt(np.mean(st_mov[0, dsp.ns(1.6) :] ** 2))
        r_late = np.sqrt(np.mean(st_mov[1, dsp.ns(1.6) :] ** 2))
        self.assertGreater(l_early, r_early * 1.8)
        self.assertGreater(r_late, l_late * 1.8)

    def test_mix_cues_v8_dual_beds_motifs_uncanny_hush_and_0_jumpscare_default(self):
        with tempfile.TemporaryDirectory() as td:
            lib_dir = os.path.join(td, "lib")
            os.makedirs(lib_dir, exist_ok=True)
            r = dsp.rng(99)
            # Create clean test SFX assets in temp library
            dsp.write_wav(os.path.join(lib_dir, "rain_ext.wav"), horror_instruments.ambience_night(dur=6.0, kind="rain", vel=0.35, r=r))
            dsp.write_wav(os.path.join(lib_dir, "room_near.wav"), horror_instruments.ambience_night(dur=6.0, kind="room_tone", vel=0.25, r=r))
            dsp.write_wav(os.path.join(lib_dir, "drip_one.wav"), horror_instruments.wet_drip([0.04], vel=0.5, r=r))
            dsp.write_wav(os.path.join(lib_dir, "bolt_hit.wav"), horror_instruments.door_slam_bolt(vel=0.75, r=r, bolt_delay=0.18))

            dur = 14.0
            voice_p = os.path.join(td, "voice.wav")
            words_p = os.path.join(td, "words.json")
            t = np.arange(dsp.ns(dur)) / dsp.SR
            v_mono = np.zeros_like(t)
            # Spoken spans [1.0..4.5s] and [10.5..13.2s], with uncanny silence_drop [8.0..9.8s]
            v_mono[dsp.ns(1.0) : dsp.ns(4.5)] = 0.12 * np.sin(2 * np.pi * 150.0 * t[dsp.ns(1.0) : dsp.ns(4.5)])
            v_mono[dsp.ns(10.5) : dsp.ns(13.2)] = 0.06 * np.sin(2 * np.pi * 138.0 * t[dsp.ns(10.5) : dsp.ns(13.2)])
            dsp.write_wav(voice_p, dsp.st(v_mono))

            wdata = {
                "dur": dur,
                "words": [
                    {"w": "gài", "s": 3.0, "e": 3.3, "speaker": "NARRATOR", "mood": "calm_omen"},
                    {"w": "chốt", "s": 3.35, "e": 3.75, "speaker": "NARRATOR", "mood": "calm_omen"},
                    {"w": "thở", "s": 11.2, "e": 11.6, "speaker": "NARRATOR", "mood": "whisper"},
                ],
                "sentences": [
                    {"sent": 1, "s": 1.0, "e": 4.5, "mood": "calm_omen"},
                    {"sent": 2, "s": 10.5, "e": 13.2, "mood": "whisper"},
                ],
                "dead_silences": [],
                "silence_drops": [{"s": 8.0, "e": 9.8}],
            }
            with open(words_p, "w", encoding="utf-8") as fp:
                json.dump(wdata, fp)

            cues = {
                "voice": voice_p,
                "words": words_p,
                "library_dir": lib_dir,
                "duration": dur,
                "beds": [
                    {
                        "sound": "rain_ext",
                        "role": "far",
                        "target_rms_dbfs": -30.0,
                        "lp_hz": 4200,
                        "automation": [
                            {"at_word": "chốt", "gain_delta_db": -6.5, "lp_hz": 580, "transition_s": 0.5}
                        ],
                        "label": "Mưa ngoài sông tự đục đi khi đóng chốt",
                    },
                    {
                        "sound": "room_near",
                        "role": "near",
                        "target_rms_dbfs": -36.0,
                        "label": "Không gian gỗ ẩm cận cảnh",
                    },
                ],
                "motifs": [
                    {
                        "id": "m_drip",
                        "sound": "drip_one",
                        "start": {"at": 0.8},
                        "end": {"at_silence_drop": 0, "edge": "start"},
                        "interval_s": 1.8,
                        "mode": "approach",
                        "space": "room",
                        "pan_from": -0.65,
                        "pan_to": -0.10,
                        "target_peak_dbfs": -14.0,
                        "label": "Giọt nước dột tiến dần lại gần rồi bặt tiếng ở silence_drop",
                    }
                ],
                "events": [
                    {
                        "id": "e_bolt",
                        "sound": "bolt_hit",
                        "at_word": "chốt",
                        "role": "tension",
                        "space": "room",
                        "pan": 0.25,
                        "label": "Cài chốt cửa gỗ",
                    },
                    {
                        "id": "e_breath_in_hush",
                        "synth": "breath_close_ear",
                        "allow_synth": True,
                        "at": 8.65,
                        "dur_s": 0.85,
                        "role": "subliminal",
                        "space": "close_ear",
                        "pan_from": 0.45,
                        "pan_to": 0.75,
                        "survive_hush": True,
                        "label": "Tiếng thở khẽ sát tai phải giữa khoảng lặng tâm lý",
                    },
                    {
                        "id": "js_climax",
                        "jumpscare": "cinema_stab",
                        "sound": "bolt_hit",
                        "at_silence_drop": 0,
                        "edge": "end",
                        "target_peak_dbfs": -1.0,
                        "label": "Cao trào sau khoảng lặng tâm lý",
                    },
                ],
            }
            cues_p = os.path.join(td, "cues.json")
            out_wav = os.path.join(td, "mix.wav")
            with open(cues_p, "w", encoding="utf-8") as fp:
                json.dump(cues, fp)

            res = mix_cues.render_cues_mix(cues_p, out_wav, library_dir=lib_dir, strict=True)
            self.assertEqual(res["verdict"], "PASS")
            self.assertEqual(res["clips"], 0)
            self.assertAlmostEqual(res["stats"]["I"], -16.0, delta=0.55)
            self.assertGreaterEqual(len(res.get("silence_drops") or []), 1)
            self.assertGreaterEqual(res["silence_drops"][0]["bed_drop_db"], 22.0)

            # v15.0: Verify default min_jumpscares = 1 blocks 0-jumpscare cues under --strict!
            zero_js = json.loads(json.dumps(cues))
            zero_js["events"] = [e for e in zero_js["events"] if not e.get("jumpscare")]
            zero_p = os.path.join(td, "zero_js.json")
            with open(zero_p, "w", encoding="utf-8") as fp:
                json.dump(zero_js, fp)
            with self.assertRaises(RuntimeError) as ctx_z:
                mix_cues.render_cues_mix(zero_p, os.path.join(td, "zero.wav"), library_dir=lib_dir, strict=True)
            self.assertIn("MISSING_JUMPSCARE_ERROR", str(ctx_z.exception))


if __name__ == "__main__":
    unittest.main()
