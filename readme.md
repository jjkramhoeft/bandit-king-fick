\# Bandit King of Ancient China



A recreation of the 1989 KOEI game (Japanese title: Suikoden: Tenmei no Chikai), re-released on Steam in 2017



\# In a browser version



## Play

Open `index.html` in a browser. Everything is plain HTML, CSS and JavaScript with no build step, so it also runs straight from the folder.

If your browser blocks local files, serve the folder instead. This small server turns off caching, so edits always show up:

```bash
python tools/serve.py 8613
```

Then open http://localhost:8613.

## How the game works

You are one of the Good Fellows, outlaw heroes of the *Water Margin*. Gather heroes, build up prefectures and destroy the corrupt Minister of War, Gao Qiu, in Kaifeng (prefecture 24) before the Northern Barbarians invade in January 1127.

- **Four scenarios** (1101, 1103, 1104, 1105) with 4–7 playable Good Fellows. As in the original, every Good Fellow starts Scenario 1 in exile, hiding in a prefecture nobody rules yet. Up to seven people can take turns at one screen, or choose 0 players to watch the computer play.
- **Three difficulties.** Easy shrinks the imperial garrisons, raises your taxes and makes rivals warier of attacking you; Hard does the opposite and allows only seven sworn brothers instead of nine.
- **Monthly turns.** Each prefecture gets one command per month, in random order. You command your home prefecture and those ruled by sworn brothers; other chieftains follow the standing orders you set under Personnel → Issue Orders.
- **The sixteen commands of the Amiga release:** Fight (Go to War, Go on Expedition), Service (Flood Control, Cultivation, Construction), Make (Ships, Weapons), Move (Hero, Provisions, Go into Exile), Negotiate (Ally, Invite to Lair), Travel (Marketplace, Downtown, Smithy, Shipyard, Return to Lair), Solicit, Hunt, Personnel (Swear Brotherhood, Promote, Exile, Issue Orders), Organize (Hire Men, Assign Men, Assign Ships), Train, Feast, Rest, Give, View and Interrupt (Save, Wait, Sound, Animation, Messages, Quit). View and Promote (appoint a chieftain) do not use up the month's command.
- **Body.** Every command costs the hero who carries it out some Body, using the manual's figures: for example Service 15, Hunt 20, Train 10, Negotiate 25, Go to War 10. Heroes recover 5 Body a month, or 10 with Rest.
- **Troops.** A hero leads at most 100 men, so a prefecture holds at most 100 men per hero, and five heroes per castle. Going to war costs 34 gold in provisions for every hero with 100 men, plus food for the month.
- **Economy.** Taxes in January only where Support is 40 or more. Each January also wears down drill, weapons, dikes, fields, wealth and support a little, and followers grow restless, faster under a leader whose personality differs from theirs. Soldiers eat food every month and followers draw a little pay. Seasons bring festivals, beasts (bears, tigers, leopards or wolves), typhoons, snowstorms and epidemics. Riots can strike while Support is 40–55; you may pay gold to calm the crowds.
- **The Imperial Edict.** Popularity of 250 or more at the January check earns the Edict, the only licence to attack Gao Qiu's home prefecture. Going into exile loses it. Holding Liangshan Marsh (19) is worth 100 popularity, and well-governed prefectures earn more each January. When an Edict is proclaimed, part of Gao Qiu's capital garrison deserts.
- **Gao Qiu's empire** is mostly defensive: it demands tribute, arms its border governors and punishes refusals, and its Kaifeng guard never leaves the capital. Rival Good Fellows and rebel kings are the day-to-day threat. Treaties between Good Fellows last three years.
- **Hex battles** last up to 30 days, with terrain, rivers flowing from the upper left to the lower right, daily weather, wind-spread fire, archery, magic and duels. The defender moves first each day, may abandon the prefecture instead of fighting, and can call up heroes beyond the ten on the field. A winning attacker captures every defender left on the field. Castles favour the defender: an attacker wins about half the time at 1.5-to-1 and needs 2-to-1 to win reliably.
- **Battle View.** As in the manual, View lists either side's heroes with their men, Body, abilities, ships and whereabouts (on the field, waiting in the prefecture, captured, fled). Looking at your own side is free; scouting the enemy uses that unit's turn.
- **Battle orders** follow the manual's rules: archers (Dexterity over 60) shoot exactly two hexes along a line; Fireball needs Wisdom 60, dry weather and an adjacent target; Magic needs Wisdom 80, Body 50 and a cloudy day, and reaches 2 hexes (3 with Wisdom 90); a hero at 10 Body or less can only rest, and resting restores 2 Body below 40. A hero with no men left fights on, worth one man for every 5 Body, and is captured if attacked at 0 Body. Only heroes with a ship enter rivers and lakes; steersmen start with one.
- **Castles.** Service → Construction raises a new castle in a wealthy prefecture (wealth 70+, 230 gold). Each castle houses five more heroes.
- **Experience.** Heroes learn by doing: each action earns experience in the ability it uses (the amounts are the manual's), and every 100 points raises that ability by one.
- **Exile.** Lose your last prefecture and you live as an outlaw band of up to 10 heroes, with the Amiga exile commands: Flee, Recruit Hero (followers in town, or bandits), Settle (attack the prefecture you hide in), Rest, View and Interrupt.
- **Direct orders.** Only prefectures ruled by your Good Fellow or a sworn brother take your orders. Move your Good Fellow to the front before the final assault on Kaifeng.

Controls: click commands in the message window, use the menu bar, or type command numbers. As on the Amiga, you can hold the right mouse button to show the menus and release over an item to choose it, and Y or N answers yes/no questions. Enter or Space continues a message, Escape cancels, and right-click skips messages. Click any prefecture on the map to peek at it. Games save to browser storage: ten slots, like the Amiga save disk, plus a January autosave. Save game → To a file downloads the game as a JSON file, and Load game → From a file reads it back, so a game can be backed up or moved to another browser.

Music follows the structure of the original soundtrack described in the research report: a main theme and a war theme for each season, plus title, setup, Liangshan Marsh (played on turns in the marsh), Dispatch (an army sets out), After the Battle, the Imperial Edict, victory, defeat, game over and the ending, 18 cues in all. All of them are new compositions. `tools/music-preview.html` plays each one.

## About this version

This is an original browser game in the style of the Western Amiga release. **Fick** stands in for the original publisher. All art is drawn procedurally in code, the music is original Web Audio synthesis, and every formula, scenario setup and line of text is this project's own; the rule numbers follow the original manuals (see below). Character and place names come from the public-domain 14th-century novel and from Song-dynasty geography. The game title here is the project's working name; pick a new one before publishing.

## Sources for the rules

The Amiga release did not have a rulebook of its own. Compute! (issue 128, 1991) reviewed the Amiga version and found its manual "obviously not written for the Amiga", with a six-page Amiga reference leaflet for the controls. The Amiga manual text online (Games Database, Infogrames 1991) is a partial transcription of that same general manual. It has the same headings, the same keyboard and numeric-keypad instructions, and the same worked example (Make costs 15 Body and gives 15 Dexterity and 10 Wisdom experience). It stops before the battle chapter. A complete scan of the PC (DOS) edition of the manual supplies the rest. Its sixteen commands and six exile commands match. So the numbers below are the rules printed in the manual that came in the Amiga box:

- the battle chapter: 30 days, ten units a side, the defender's 20 deployment hexes and reinforcements, movement costs per terrain, ships for rivers and lakes, currents, weather by season, the Body cost and experience of every battle order, archery and magic ranges, Fireball and Extinguish requirements, duels, resting, fleeing and the victory conditions
- the attribute and prefecture maximums: 100 men per hero, Gold and Food 9999, Metal and Fur 999, Popularity 999, 7 castles per prefecture, five heroes per castle
- the Body cost and experience of every main command, Loyalty 95 to swear brotherhood, at most nine sworn brothers, the Edict at 250 popularity, three-year treaties, 34 gold of provisions per 100 men, feasts at 10 gold a head, gifts of up to 1000 food or 100 gold, and Scenario 1 starting every Good Fellow in exile

The formulas that turn those rules into results (damage, tax yields, recruiting odds and so on) are this project's own, since no manual gives them. An earlier version took its battle numbers from the US NES manual; they now come from the manual that shipped with the Amiga release. See `bandit-kings-research.html` for the other sources.

## Project layout

- `js/core`: shared namespace, seeded random numbers, map geometry
- `js/data`: map, characters, scenarios
- `js/engine`: rules, economy, battles, AI, turn loop, saves (no DOM; also runs in Node)
- `js/art`, `js/audio`: procedural portraits, vignettes, title art, music
- `js/ui`: the Amiga-style screens
- `tools`: art and music preview pages, the development server, and `autoplay.js`, a harness that plays a whole game through the real screen by clicking
- `tests`: engine tests and a balance runner

## Tests

```bash
node --test tests/engine.test.js
```

```bash
node tests/balance.js 12
```

The balance runner plays computer-only games and prints win rates per scenario.

```bash
node tests/strategy.js 10
```

The strategy runner plays one Good Fellow with a scripted "human" plan through the same rules a player uses. Set `DIFFICULTY=easy` or `DIFFICULTY=hard` to test other levels.

Last measured results:

With the PC manual's numbers in place:

- Computer-only games: a Good Fellow takes Kaifeng in 27 of 48 (56%). The rest end with the 1127 invasion.
- The scripted player wins 4 of 96 games on Easy, earning the Edict in 39, and 4 of 96 on Normal. Its weak point is massing a full ten-hero army beside the capital, which a person does on purpose.
- Full games through the real screen with `tools/autoplay.js` (only clicking): see the end of this file for the latest runs.
- Battles: with equal strength (counting castles), attackers win about 13%; at 1.5-to-1 about 47%; at 2-to-1 about 82%. Attackers that lose at 2-to-1 mostly run out of days against the walls.

The music has been listened to by a person and judged fine. It was also checked objectively. In a real browser every track sounds throughout at similar levels (average RMS about 0.03–0.11, peaks under 0.3, no clipping). An analysis of the note data finds all 18 cues free of problems: every note is in its track's pentatonic scale, every voice fits its loop length, no semitone, major-seventh or tritone clashes sound on a strong beat, and every instrument stays in a sensible range.

## Full games through the real screen

`tools/autoplay.js` plays one Good Fellow from the title screen to the final screen, acting only by clicking buttons, menu items, table rows, the map and battle hexes. Load it into the running page from the browser console:

```js
const s = document.createElement('script'); s.src = 'tools/autoplay.js'; document.head.appendChild(s);
// then: Autoplay.start({ scenario: 2, fellow: 'Chao Gai', difficulty: 'easy' })
```

Runs so far, each from New Game to the final screen with no state edits and no errors. The first four used an early version of the harness that often fell back to Rest, so they show a passive player; the later runs use the fixed harness.

| Good Fellow | Scenario | Difficulty | Ended | Turns | Result |
|---|---|---|---|---|---|
| Lin Chong | 1101 | Normal | April 1121 | 556 | Captured ("Your Good Fellow has fallen") |
| Li Kui | 1104 | Easy | February 1124 | 459 | Captured |
| Chao Gai | 1103 | Easy | January 1115 | 357 | Lin Chong took Kaifeng first |
| Song Jiang | 1104 | Easy | July 1113 | 201 | Li Ying took Kaifeng first |
| Song Jiang | 1104 | Easy | April 1116 | 147 | Captured |
| Chao Gai | 1103 | Easy | March 1115 | 146 | Yang Zhi took Kaifeng first |
| Chao Gai | 1103 | Easy | January 1127 | 288 | The 1127 invasion: time ran out |
| Li Kui | 1104 | Easy | January 1127 | 274 | The 1127 invasion |
| Chao Gai | 1103 | Easy | January 1118 | 233 | Captured |
| Song Jiang | 1104 | Easy | January 1127 | 275 | Held the Edict from 1123, but time ran out |
| Chao Gai | 1103 | Easy | March 1119 | 195 | **Victory**: took Kaifeng and captured Gao Qiu (687 clicks, 4 battles) |
| Chao Gai | 1103 | Easy | January 1127 | - | Held the Edict, but time ran out |
| Song Jiang | 1104 | Easy | January 1127 | - | Held the Edict, but time ran out |

The last three runs use the harness's improved plan, which keeps arms and drill up, fills each hero's ranks before recruiting more, routes the Good Fellow through his own lands to Kaifeng's border once he holds the Edict, and accepts worse odds against the capital as 1127 nears. One of them won outright from New Game.

All of the runs above used the earlier rules, with battle numbers from the NES manual. These runs use the PC manual's numbers (100 men per hero and the rest). They were played at the Fast message speed. The harness now waits for about 2-to-1 odds before attacking, keeps a year's pay in hand, feasts or rewards wavering heroes, and once it holds the Edict, sends food to the front and assaults Kaifeng with at least five heroes even at worse odds, wearing the guard down:

| Good Fellow | Scenario | Difficulty | Ended | Turns | Result |
|---|---|---|---|---|---|
| Chao Gai | 1103 | Easy | January 1127 | 288 | The 1127 invasion. Held one prefecture; an early version of the new pay rule cost him most of his heroes to desertion (since softened) |
| Lin Chong | 1101 | Easy | stopped in March 1110 | 110 | Settled Cangzhou from exile, then lost nine attacks on Enzhou at the old 1.5-to-1 threshold; stopped to retune the harness |
| Chao Gai | 1103 | Easy | February 1115 | 146 | Lin Chong took Kaifeng first (after three early defeats the harness never found 2-to-1 odds again) |
| Chao Gai | 1103 | Easy | September 1114 | 141 | **Victory** (620 clicks): took Yizhou, Xuzhou and Bozhou, earned the Edict in January 1114, lost a first assault on Kaifeng in May and wiped out its guard in September |
| Chao Gai | 1103 | Normal | January 1127 | 288 | The 1127 invasion (974 clicks): won all four of its attacks, held five prefectures including Liangshan, 33 heroes and the Edict, but never gathered five heroes beside Kaifeng for an assault |
