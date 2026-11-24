import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  type CharacterBlueprint,
  RetroPsxEffect,
  addBloodHandprintDecal3D,
  addCornerLurker3D,
  addHauntedPortrait3D,
  addIchorPoolDecal3D,
  addOtherworldGrimeDecal3D,
  addSwarmingFlies3D,
  addTalismanPaper3D,
  createCharacterFromBlueprint,
  hudFromManifest,
  jacobsLadderTwitch,
  torchMalfunction,
} from "../templates/engine/index.ts";

test("createCharacterFromBlueprint builds strictly opt-in story-driven appearances without leaking horror traits", () => {
  const humanBp: CharacterBlueprint = {
    id: "villager",
    role: "human",
    storyDescription: "Người nông dân bình thường mặc áo nâu",
    appearance: {
      hairStyle: "shortParted",
      garment: "shirt",
      uncannyRealism: true,
    },
  };
  const h = createCharacterFromBlueprint(humanBp);
  assert.equal(h.group.getObjectByName("mattedLongHair"), undefined);
  assert.equal(h.group.getObjectByName("suturesAndWounds"), undefined);
  assert.equal(h.sockets.leftExtraArm, undefined);
  assert.equal(h.sockets.jaw, undefined);
  h.dispose();

  const folkGhostBp: CharacterBlueprint = {
    id: "folkGhost",
    role: "entity",
    storyDescription: "Ma nữ tóc dài che nửa mặt, áo liệm tối",
    appearance: {
      garment: "shroud",
      entity: {
        steppedFps: 8,
        headTwitch: 0.8,
        bodyHorror: {
          skullHollows: true,
          mattedLongHair: true,
          jawDrop3D: 0.9,
          crookedTeeth: true,
        },
      },
    },
  };
  const fg = createCharacterFromBlueprint(folkGhostBp);
  assert.ok(fg.group.getObjectByName("mattedLongHair"), "mattedLongHair must build when opted in");
  assert.equal(fg.group.getObjectByName("suturesAndWounds"), undefined, "sutures must remain OFF when not opted in");
  assert.equal(fg.sockets.leftExtraArm, undefined, "extraArms must remain OFF when not opted in");
  fg.dispose();

  const wardBp: CharacterBlueprint = {
    id: "wardAbom",
    role: "entity",
    storyDescription: "Thực thể khoa cũ đầu trọc khâu chỉ đen, 4 tay",
    appearance: {
      hairStyle: "bald",
      garment: "hospitalGown",
      entity: {
        bodyHorror: {
          skullHollows: true,
          suturesAndWounds: true,
          exposedRibs: true,
          extraArms: 2,
          clawHands: true,
          tatteredCloth: true,
        },
      },
    },
  };
  const wa = createCharacterFromBlueprint(wardBp);
  assert.equal(wa.group.getObjectByName("mattedLongHair"), undefined, "mattedLongHair must stay OFF on bald surgical entity");
  assert.ok(wa.group.getObjectByName("suturesAndWounds"), "suturesAndWounds must build when opted in");
  assert.ok(wa.sockets.leftExtraArm && wa.sockets.rightExtraArm, "extraArms must build when opted in");

  // Verify all 3 new v5.0 poses evaluate cleanly without NaN
  for (const pose of ["doorwayPeek", "backbendCrab", "lungeCloseUp"] as const) {
    wa.setPose(pose, 42, { headTwitch: 0.85 });
    assert.ok(Number.isFinite(wa.sockets.spine.rotation.x));
    assert.ok(Number.isFinite(wa.sockets.head.rotation.z));
  }
  wa.dispose();
});

test("jacobsLadderTwitch and torchMalfunction are deterministic and advance blink stages cleanly", () => {
  const a1 = jacobsLadderTwitch(14, 13, 0.9);
  const a2 = jacobsLadderTwitch(14, 13, 0.9);
  assert.deepEqual(a1, a2);
  assert.deepEqual(jacobsLadderTwitch(14, 13, 0), { rx: 0, ry: 0, rz: 0 });

  const blackouts: Array<[number, number]> = [
    [186, 190],
    [207, 211],
  ];
  assert.equal(torchMalfunction(170, blackouts).stage, 0);
  assert.equal(torchMalfunction(170, blackouts).isDark, false);
  assert.equal(torchMalfunction(188, blackouts).isDark, true);
  assert.ok(torchMalfunction(188, blackouts).power < 0.05);
  assert.equal(torchMalfunction(198, blackouts).stage, 1);
  assert.equal(torchMalfunction(209, blackouts).isDark, true);
  assert.equal(torchMalfunction(220, blackouts).stage, 2);
});

test("Opt-in Folk/Viscera dressing kit, CornerLurker3D, SwarmingFlies3D, RetroPsxEffect.dreadLevel, and camcorder HUD", () => {
  const root = new THREE.Group();
  const hand = addBloodHandprintDecal3D(root, [0, 1, 0]);
  const pool = addIchorPoolDecal3D(root, [0, 0, 0]);
  const tal = addTalismanPaper3D(root, [0, 1.5, 0]);
  const grime = addOtherworldGrimeDecal3D(root, [0, 1, -1]);
  const portrait = addHauntedPortrait3D(root, [0, 1.6, -2]);
  const flies = addSwarmingFlies3D(root, [0, 1.2, 0], { count: 6 });
  const lurker = addCornerLurker3D(root, [1, 1.5, -1], 0);

  assert.equal(hand.name, "BloodHandprintDecal3D");
  assert.equal(pool.name, "IchorPoolDecal3D");
  assert.equal(tal.name, "TalismanPaper3D");
  assert.equal(grime.name, "OtherworldGrimeDecal3D");
  portrait.setHaunt(0.85, 0.4);
  flies.update(37);
  assert.equal(flies.group.children.length, 6);
  lurker.setPeek(0, 10);
  assert.equal(lurker.group.visible, false);
  lurker.setPeek(0.8, 12);
  assert.equal(lurker.group.visible, true);
  portrait.dispose();

  const fx = new RetroPsxEffect();
  fx.dreadLevel = 0.75;
  assert.equal(fx.dreadLevel, 0.75);
  fx.dreadLevel = 5;
  assert.equal(fx.dreadLevel, 1);

  const hud = hudFromManifest({
    projectId: "cam-test",
    title: "Test",
    totalFrames: 60,
    aspect: "9:16",
    locations: [],
    beats: [],
    camcorder: { enabled: true, label: "VHS · SP", startClock: "01:06:00" },
  });
  assert.equal(hud.camcorder?.enabled, true);
  assert.equal(hud.camcorder?.label, "VHS · SP");
});
