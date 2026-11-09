# Plan: give the clone the original's lean, sparse opening

## Context

Playing the 1990 Amiga original in the emulator showed that its opening is a slow land grab. Most of the map belongs to no one. Exiles start alone, with no men and no reputation. Settled land is nearly worthless.

The clone opens on a crowded map:
- Gao Qiu holds 35 prefectures;
- 6 rebel kings and 4 squires hold most of the rest;
- each Good Fellow starts with followers, 15–20 men, 30–60 popularity and 50 gold.

You chose to move the clone toward the original in all four scenarios. You also asked for these changes:
- Flee costs Body and lets you choose who follows;
- the original's scenario 1 roster;
- a capable Gao Qiu;
- the original's Hire Men price.

The setup screens stay as they are.

The README says every placement and number in the clone is its own design. So the clone copies the original's *shape*: a small imperial core, a few bandit lords, empty land and lean exiles. The prefectures and numbers come from the clone's own map, not from the original's data tables.

## Changes

### 1. Sparse map in all four scenarios (`js/data/scenarios.js`, `js/engine/setup.js`)

**One shared imperial core** (clone map ids):

| Prefecture | Court officials placed there |
|---|---|
| 24 Kaifeng | Gao Qiu, Wen Huanzhang, Dang Shiying, Dang Shixiong, Qiu Yue, Zhou Ang |
| 28 Luoyang | Cai Jing, Wang Huan |
| 25 Jingzhao | Tong Guan, Yang Jian |
| 15 Daming | Liang Shijie, Han Cun |
| 38 Yangzhou | Murong Yanda |
| 40 Jiankang | Huang Wenbing |
| 41 Suzhou | Gao Lian |
| 45 Hangzhou | He Tao, Yang Wen |
| 43 Jingnan | Cai Jiu, Zhang Shuye |

- These nine are the capital plus the rich cities. They are defined once as `EMPIRE` (the list of prefectures) and `COURT` (where each named official sits), and all four scenarios share them.
- Gao Qiu still grows stronger in later scenarios through the existing `imperialBoost`.

**Setup** (`setup.js` ~lines 158–250):
- Generic governors and officers fill only empire prefectures.
- Every other prefecture that no Good Fellow, boss or local holds stays unowned.
- The per-scenario `empty` list goes away.

**Bosses and locals per scenario.** The `locals` squires are removed in every scenario.

| Scenario | Bosses | Owned at start | Empty |
|---|---|---|---|
| S1 | Wang Lun at 19 (with Du Qian, Song Wan, Zhu Gui); Zhu Wu at 26 (with Chen Da, Yang Chun); Tian Hu at 5 | 12 | 37 |
| S2–S4 | Tian Hu 5, Wang Qing 36, Fang La 47 (Zhu Chaofeng and Zeng Nong dropped) | 15–18 | 31–34 |

The Good Fellows in scenarios 2–4 keep their current holdings.

**Wild land is poor.** At the end of setup, every unowned prefecture is reset to wild values:

| Value | Wild setting |
|---|---|
| Gold | 0–30 |
| Food | 0–60 |
| Metal | 0 |
| Fur | 0–10 |
| Arms, Skill | 0 |
| Support | 10–30 |
| Flood, Land, Wealth | roughly halved, 10–35 |
| Castles | 1–2 |

- Rate, shipyard and smithy stay as they are.
- Support below 40 means no taxes until the player wins the people over. Settling already lowers Support by 8 (`war.js` apply).
- January processing already skips unowned land (`econ.js:116`).

### 2. Lean exiles (`setup.js` ~lines 166–187, scenario data)

**Every exile leader starts with:**
- 0 men;
- a purse of 10 gold (replacing 50);
- no `bandits` field.

**Scenario 1 Good Fellows also start with:**
- popularity 0, through a scenario-level `pop: 0` override on the hero's `popEarned`;
- no followers.

Their former followers become free townsfolk at story places, so they can be recruited. A new scenario field `townsfolk: { key: prefId }` places a named hero there instead of at a random prefecture:
- Lu Zhishen's friends at 17;
- Chai Jin at 4;
- Chao Gai, Wu Yong, Gongsun Sheng, Liu Tang and Bai Sheng at 20.

The exiles in scenarios 2–4 (Song Jiang, Li Kui) keep their listed companions, but with 0 men.

"Gather bandits" stays as the clone's way for an exile to raise men. This leaves a real choice: settle at once with nothing, or gather first.

### 3. Scenario 1 roster (`scenarios.js` S1)

| Hero | Hides in | Owner of that prefecture |
|---|---|---|
| Lu Zhishen | 17 Qingzhou | nobody |
| Shi Jin | 26 Huazhou | bandit Zhu Wu |
| Lin Chong | 24 Kaifeng | Gao Qiu |
| Yang Zhi | 15 Daming | the empire |
| Wu Song | 7 Enzhou | nobody |

- Chao Gai is not playable in scenario 1. He is a townsperson in Jizhou.
- Lin Chong cannot Settle Kaifeng without the Edict (`World.attackBlock`), so he has to flee first, as in the original.
- Wu Song already has a Good Fellow colour (`heroes.js:196`).
- The title screen lists `sc.goodFellows` keys, so it needs no change.
- Update the S1 comment: hideouts are no longer all unruled.

### 4. Imperial AI does not settle wild land (`js/engine/ai.js` warPlan)

Add `if (f.kind === 'imperial' && !tf) return;` to the neighbour loop.

Without it, empty land has a defense of only 8 (`world.js` defenseValue). Imperial governors would fill the map within a few years. The original's Gao Qiu keeps the same core in every scenario. Bosses and Good Fellows may still settle wild land.

### 5. Flee costs 10 Body and the leader picks who follows

**Engine** (`js/engine/actions.js` wander):
- New signature: `wander(s, fid, toId, ids)`.
- It needs 10 Body (`A.needBody`) and takes 10 from the leader.
- The leader always goes. `ids` lists the other members who follow; the default is everyone.
- Members left behind are freed with `A.release` and stay in the old prefecture as townsfolk.
- The 0–2 loyalty drop for followers stays.

**Flow** (`js/engine/flows.js` exileTurn, `xmove`):
- After picking the prefecture, if the band has other members, ask `io.pickChars('Who comes along?', others, { min: 0, max: others.length })`.

**Screen** (`js/ui/screen.js` pickChars):
- The picker currently forces `min || 1`. Honour an explicit `min: 0` so nobody has to follow.

**AI and harnesses:**
- `ai.js` decideExile and `tests/strategy.js` call `A.wander` with the default (everyone follows). They already handle a failed action.
- `tools/autoplay.js` exilePlan Flee steps need a step that confirms the follower picker.

### 6. Gao Qiu as a capable minister (`js/data/heroes.js:161`)

Change his fixed Int / Mercy / Courage from 6 / 8 / 35 to about 74 / 66 / 77. His other stats stay as they are.

Accepted side effect: with Mercy above 60, the empire releases prisoners instead of jailing them (`war.js` aiPrisoners). Loyalty compatibility for imperial officers also changes.

### 7. Hire Men price (`actions.js:389`)

Change `p.rate / 25 * 4` to `p.rate / 25 * 3.5`, which is Rate × 0.14. At Rate 49 that is 6.9 gold per man.

### 8. README

Update these parts:
- the Scenario 1 line, which says every hideout is unruled;
- the Exile bullet: Flee now costs 10 Body and you choose who follows;
- the Gao Qiu's empire bullet: a small core that does not expand into wild land;
- a short note on lean starts and poor wild land.

## Tests (`tests/engine.test.js`)

**Rewrite** the "every prefecture ruled but the empty ones" test:
- owned prefectures = the empire ∪ Good Fellow holdings ∪ bosses;
- every other prefecture is unowned;
- every owned prefecture has a valid ruler.

**Repoint** the tests that attack 9 Laizhou from 17 Qingzhou in S2: battles, fire, and "defenders hold". Laizhou is now wild, so they will attack 21 Yizhou (Yang Zhi), a defended neighbour. Repoint the January-tax test to an empire prefecture.

**New tests:**
- Scenario 1: 37 unowned prefectures, and the empire holds exactly the 9 core prefectures in every scenario.
- Scenario 1 exiles: 0 men and popularity 0.
- Scenario 1 roster: Lin Chong is in Kaifeng and blocked from settling it; Wu Song is playable; Chao Gai is a townsperson in Jizhou.
- Wild land: gold ≤ 30, Arms 0, Support < 40.
- Flee:
  - costs 10 Body;
  - fails below 10 Body;
  - members left behind become free townsfolk in the old prefecture.
- An imperial warPlan never targets an unowned prefecture.
- `hireCost` at Rate 49 is 6.9.

## Verification

1. **Baseline first** (before any edit). Run these and save the output to the scratchpad:
   - `node tests/balance.js 10`
   - `node tests/strategy.js 10` (in the background if slow)
2. **Unit tests:** `node --test tests/engine.test.js` must pass, including "computer-only games run to the end".
3. **Balance after the change:** rerun both runners and compare.
   - Acceptable: every scenario still finishes, and the scripted human still wins some scenario 1 games.
   - If AI Good Fellows stall on poor land (0 men, Good Fellow prefecture count flat), lower the AI hire threshold in `ai.js` decide. It currently needs `p.gold > 150`; the new rule would be enough gold for 6 men. Then rerun.
4. **In the browser:** `preview_start` with the "game" config, port 8614.
   - Start scenario 1 as Lin Chong and check:
     - the exile panel shows 0 men in Kaifeng;
     - Settle is refused for want of the Edict;
     - Flee costs 10 Body and the follower picker appears after a recruit;
     - a settled wild prefecture shows poor stocks;
     - Hire Men quotes about Rate × 0.14.
   - Take a screenshot.