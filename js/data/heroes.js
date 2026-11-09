/* Character roster. Names come from the public-domain novel Water Margin; stats are this
   game's own, rolled from archetype ranges with a per-character seed, plus a few overrides.
   `look` feeds BK.Portrait (any missing field is filled from the character's id). */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  // [body, strength, dexterity, wisdom, integrity, mercy, courage] as [lo, hi] ranges.
  var ARCH = {
    leader:    [[70, 85], [40, 60], [45, 65], [75, 90], [85, 98], [85, 98], [60, 80]],
    general:   [[85, 100], [78, 94], [70, 88], [45, 70], [60, 85], [50, 75], [78, 95]],
    brawler:   [[85, 100], [86, 99], [55, 78], [12, 40], [40, 80], [30, 65], [88, 99]],
    archer:    [[75, 92], [60, 78], [88, 99], [50, 72], [60, 85], [50, 75], [70, 88]],
    scholar:   [[55, 75], [18, 40], [30, 55], [86, 98], [70, 92], [65, 90], [40, 62]],
    sorcerer:  [[60, 80], [30, 50], [40, 60], [86, 99], [60, 85], [55, 80], [55, 75]],
    sailor:    [[80, 95], [65, 85], [70, 90], [30, 60], [55, 85], [45, 70], [75, 92]],
    rogue:     [[70, 88], [45, 65], [76, 94], [50, 76], [35, 70], [40, 70], [55, 80]],
    craftsman: [[65, 82], [40, 62], [68, 88], [55, 78], [60, 85], [60, 85], [40, 62]],
    merchant:  [[60, 80], [38, 60], [45, 68], [55, 75], [45, 75], [45, 75], [40, 65]],
    amazon:    [[78, 92], [66, 82], [84, 96], [50, 70], [60, 85], [45, 70], [80, 94]],
    noble:     [[65, 80], [45, 65], [55, 75], [60, 80], [80, 95], [85, 98], [55, 75]],
    official:  [[60, 80], [30, 60], [35, 65], [55, 85], [10, 45], [10, 45], [30, 60]],
    officer:   [[80, 95], [70, 90], [65, 85], [40, 65], [30, 65], [30, 60], [65, 88]],
    boss:      [[85, 98], [75, 92], [65, 85], [60, 80], [30, 60], [25, 55], [80, 95]],
    commoner:  [[50, 75], [25, 55], [30, 60], [25, 60], [30, 80], [30, 80], [20, 60]]
  };
  var STATS = ['body', 'str', 'dex', 'wis', 'int', 'mercy', 'courage'];

  var list = [];
  function H(name, nick, arch, look, fix, extra) {
    var d = { key: name, name: name, nick: nick || '', arch: arch, role: 'hero', look: look || {}, fix: fix || {} };
    if (extra) for (var k in extra) d[k] = extra[k];
    list.push(d);
    return d;
  }

  // The thirty-six Heavenly Spirits.
  H('Song Jiang', 'Timely Rain', 'leader', { age: 'adult', hairColor: 'black', skin: 3, hair: 'cap', beard: 'mustache', mood: 'smile', mark: 'brand', build: 'slim' }, { int: 99, mercy: 99, pop: 90 });
  H('Lu Junyi', 'Jade Unicorn', 'general', { hair: 'topknot', beard: 'long', mood: 'calm', build: 'broad', garb: 1 }, { str: 97, dex: 96, int: 90, pop: 60 });
  H('Wu Yong', 'Wizard', 'scholar', { hair: 'cap', beard: 'goatee', mood: 'sly', garb: 19 }, { wis: 99, pop: 35 });
  H('Gongsun Sheng', 'Dragon in the Clouds', 'sorcerer', { hair: 'topknot', beard: 'long', mood: 'calm', garb: 24 }, { wis: 98, pop: 40 });
  H('Guan Sheng', 'Great Halberd', 'general', { skin: 2, hair: 'headband', beard: 'long', mood: 'calm', garb: 15 }, { str: 94, pop: 40 });
  H('Lin Chong', 'Panther Head', 'general', { age: 'adult', hairColor: 'black', skin: 1, hair: 'headband', beard: 'full', brows: 'thick', mood: 'fierce', mark: 'brand' }, { str: 95, dex: 94, int: 92, pop: 50 });
  H('Qin Ming', 'Thunderbolt', 'general', { hair: 'helmet', beard: 'full', brows: 'angry', mood: 'fierce', garb: 10 }, { courage: 97 });
  H('Huyan Zhuo', 'Twin Clubs', 'general', { hair: 'helmet', beard: 'full', mood: 'calm', garb: 20 });
  H('Hua Rong', 'Little Li Guang', 'archer', { age: 'young', hair: 'topknot', beard: 'none', mood: 'calm', accessory: 'feather' }, { dex: 99, int: 92 });
  H('Chai Jin', 'Little Whirlwind', 'noble', { hair: 'cap', beard: 'mustache', mood: 'smile', garb: 21 }, { pop: 55 });
  H('Li Ying', 'Soaring Eagle', 'general', { age: 'adult', hairColor: 'black', skin: 1, hair: 'turban', beard: 'mustache', mood: 'calm' }, { dex: 92, wis: 70, pop: 40 });
  H('Zhu Tong', 'Beautiful Beard', 'general', { skin: 2, hair: 'cap', beard: 'long', mood: 'calm' }, { mercy: 90 });
  H('Lu Zhishen', 'Flowery Monk', 'brawler', { age: 'adult', hairColor: 'black', skin: 1, hair: 'monk', beard: 'full', brows: 'thick', mood: 'fierce', mark: 'tattoo', accessory: 'beads', build: 'broad', garb: 4 }, { str: 98, mercy: 85, int: 88, pop: 45 });
  H('Wu Song', 'Pilgrim', 'brawler', { age: 'young', hairColor: 'black', skin: 1, hair: 'headband', beard: 'none', brows: 'angry', mood: 'fierce', mark: 'brand', build: 'broad' }, { str: 97, courage: 99, int: 85, pop: 50 });
  H('Dong Ping', 'Twin Spears', 'general', { hair: 'helmet', beard: 'mustache', mood: 'smile' });
  H('Zhang Qing', 'Featherless Arrow', 'archer', { age: 'young', hair: 'headband', beard: 'none' }, { dex: 97 });
  H('Yang Zhi', 'Blue-Faced Beast', 'general', { age: 'adult', hairColor: 'black', skin: 1, hair: 'cap', beard: 'stubble', mood: 'calm', mark: 'blueface', garb: 20 }, { dex: 90, int: 78, pop: 30 });
  H('Xu Ning', 'Gold Lancer', 'general', { hair: 'helmet', beard: 'mustache' });
  H('Suo Chao', 'Vanguard', 'brawler', { hair: 'helmet', beard: 'wild', mood: 'fierce' });
  H('Dai Zong', 'Swift Walker', 'rogue', { hair: 'scarf', beard: 'mustache', mood: 'smile', build: 'slim' }, { dex: 95 });
  H('Liu Tang', 'Red-Haired Devil', 'brawler', { hair: 'wild', hairColor: 'red', beard: 'stubble', mood: 'fierce', mark: 'scar' });
  H('Li Kui', 'Black Whirlwind', 'brawler', { age: 'adult', hairColor: 'black', skin: 3, hair: 'wild', beard: 'wild', brows: 'angry', mood: 'fierce', build: 'broad' }, { str: 99, courage: 99, wis: 12, mercy: 15, int: 70, pop: 20 });
  H('Shi Jin', 'Nine Dragons', 'general', { age: 'young', hairColor: 'black', skin: 0, hair: 'topknot', beard: 'none', mood: 'calm', mark: 'tattoo' }, { str: 86, dex: 88, pop: 35 });
  H('Mu Hong', 'Unbridled', 'general', { hair: 'topknot', beard: 'mustache' });
  H('Lei Heng', 'Winged Tiger', 'brawler', { hair: 'cap', beard: 'full' });
  H('Li Jun', 'River Dragon', 'sailor', { age: 'adult', hairColor: 'black', skin: 2, hair: 'headband', beard: 'mustache', mood: 'calm' }, { dex: 88, wis: 66, int: 82, pop: 25 });
  H('Ruan Xiaoer', 'Standing Year God', 'sailor', { skin: 2, hair: 'scarf', beard: 'stubble' });
  H('Zhang Heng', 'Boatman', 'sailor', { skin: 2, hair: 'headband', beard: 'stubble', mood: 'sly' });
  H('Ruan Xiaowu', 'Short-Lived', 'sailor', { skin: 2, hair: 'scarf', beard: 'stubble', mark: 'tattoo' });
  H('Zhang Shun', 'White Streak', 'sailor', { skin: 0, hair: 'topknot', beard: 'none', mood: 'smile' }, { dex: 93 });
  H('Ruan Xiaoqi', 'Living Yama', 'sailor', { skin: 2, hair: 'wild', beard: 'none', mood: 'fierce' });
  H('Yang Xiong', 'Pallid', 'brawler', { skin: 0, hair: 'topknot', beard: 'mustache', accessory: 'flower' });
  H('Shi Xiu', 'Desperado', 'brawler', { age: 'young', hair: 'headband', beard: 'none', mood: 'fierce' });
  H('Xie Zhen', 'Two-Headed Snake', 'rogue', { hair: 'scarf', beard: 'stubble', mark: 'tattoo' });
  H('Xie Bao', 'Two-Tailed Scorpion', 'rogue', { hair: 'scarf', beard: 'stubble' });
  H('Yan Qing', 'Prodigy', 'rogue', { age: 'young', hair: 'topknot', beard: 'none', mood: 'smile', mark: 'tattoo', accessory: 'flower' }, { dex: 96 });

  // The seventy-two Earthly Fiends.
  H('Zhu Wu', 'Strategist', 'scholar', { hair: 'cap', beard: 'goatee', mood: 'calm' });
  H('Huang Xin', 'Garrison', 'officer', { hair: 'helmet', beard: 'full' });
  H('Sun Li', 'Sick Yuchi', 'general', { skin: 1, hair: 'helmet', beard: 'mustache' });
  H('Xuan Zan', 'Ugly Son-in-Law', 'general', { skin: 3, hair: 'cap', beard: 'wild', mood: 'fierce' });
  H('Hao Siwen', 'Wood Star', 'general', {});
  H('Han Tao', 'Hundred Victories', 'general', { hair: 'helmet' });
  H('Peng Qi', 'Eyes of Heaven', 'general', { hair: 'helmet' });
  H('Shan Tinggui', 'Water General', 'sailor', { skin: 1 });
  H('Wei Dingguo', 'Fire General', 'general', { skin: 2, garb: 10 });
  H('Xiao Rang', 'Calligrapher', 'scholar', { hair: 'cap', beard: 'goatee', build: 'slim' });
  H('Pei Xuan', 'Iron Face', 'scholar', { hair: 'official', beard: 'full', mood: 'calm' }, { int: 97 });
  H('Ou Peng', 'Golden Wings', 'brawler', {});
  H('Deng Fei', 'Fiery Eyes', 'brawler', { brows: 'angry', mood: 'fierce' });
  H('Yan Shun', 'Bandit Tiger', 'brawler', { hairColor: 'brown', beard: 'full' });
  H('Yang Lin', 'Forest Leopard', 'rogue', {});
  H('Ling Zhen', 'Heaven-Shaker', 'craftsman', { hair: 'cap', beard: 'mustache' });
  H('Jiang Jing', 'Divine Abacus', 'scholar', { hair: 'cap', beard: 'none' });
  H('Lu Fang', 'Little Marquis', 'general', { age: 'young', garb: 10 });
  H('Guo Sheng', 'Rival Marquis', 'general', { age: 'young', garb: 1 });
  H('An Daoquan', 'Divine Physician', 'craftsman', { age: 'old', hair: 'cap', beard: 'long', mood: 'calm' }, { mercy: 97 });
  H('Huangfu Duan', 'Purple Beard', 'craftsman', { hairColor: 'brown', beard: 'full' });
  H('Wang Ying', 'Stumpy Tiger', 'brawler', { build: 'broad', mood: 'sly' });
  H('Hu Sanniang', 'Ten Feet of Steel', 'amazon', { sex: 'f', hair: 'bun', mood: 'fierce', garb: 10 }, { dex: 95 });
  H('Bao Xu', 'Death God', 'brawler', { skin: 3, beard: 'wild', mood: 'fierce' });
  H('Fan Rui', 'Demon King', 'sorcerer', { hair: 'long', beard: 'goatee', mood: 'sly', garb: 21 }, { wis: 92 });
  H('Kong Ming', 'Hairy Star', 'brawler', { age: 'young' });
  H('Kong Liang', 'Lone Fire', 'brawler', { age: 'young' });
  H('Xiang Chong', 'Eight-Armed Nezha', 'general', {});
  H('Li Gun', 'Flying Sky Lord', 'general', {});
  H('Jin Dajian', 'Jade Arm', 'craftsman', { hair: 'cap' });
  H('Ma Lin', 'Iron Flute', 'rogue', { age: 'young' });
  H('Tong Wei', 'Cave Dragon', 'sailor', { skin: 2 });
  H('Tong Meng', 'River Python', 'sailor', { skin: 2 });
  H('Meng Kang', 'Jade Pillar', 'craftsman', { skin: 0 }, {}, { steersman: true });
  H('Hou Jian', 'Long Arm Ape', 'craftsman', { build: 'slim', skin: 3 });
  H('Chen Da', 'Leaping Tiger', 'brawler', {});
  H('Yang Chun', 'Python', 'brawler', { build: 'slim' });
  H('Zheng Tianshou', 'White Gentleman', 'rogue', { skin: 0, age: 'young' });
  H('Tao Zongwang', 'Nine-Tailed Turtle', 'craftsman', {});
  H('Song Qing', 'Iron Fan', 'merchant', { skin: 3, hair: 'cap' });
  H('Yue He', 'Iron Throat', 'rogue', { age: 'young', mood: 'smile' });
  H('Gong Wang', 'Flowery Neck Tiger', 'general', { mark: 'tattoo' });
  H('Ding Desun', 'Arrow-Struck Tiger', 'general', { mark: 'scar' });
  H('Mu Chun', 'Little Restrained', 'brawler', { age: 'young' });
  H('Cao Zheng', 'Knife Demon', 'brawler', { build: 'broad' });
  H('Song Wan', 'Cloud Giant', 'brawler', { build: 'broad' });
  H('Du Qian', 'Sky Toucher', 'brawler', { build: 'broad' });
  H('Xue Yong', 'Sick Tiger', 'rogue', { build: 'slim' });
  H('Shi En', 'Golden-Eyed Tiger', 'merchant', { age: 'young' });
  H('Li Zhong', 'Tiger-Slaying General', 'brawler', {});
  H('Zhou Tong', 'Little Conqueror', 'brawler', {});
  H('Tang Long', 'Gold-Coin Leopard', 'craftsman', { mark: 'scar' });
  H('Du Xing', 'Demon Face', 'merchant', { skin: 3, mood: 'sly' });
  H('Zou Yuan', 'Forest Dragon', 'brawler', { age: 'old' });
  H('Zou Run', 'Lone Horn Dragon', 'brawler', {});
  H('Zhu Gui', 'Dry-Land Crocodile', 'merchant', { hair: 'cap', mood: 'smile' });
  H('Zhu Fu', 'Smiling Tiger', 'merchant', { mood: 'smile' });
  H('Cai Fu', 'Iron Arm', 'brawler', {});
  H('Cai Qing', 'Single Flower', 'brawler', { accessory: 'flower' });
  H('Li Li', 'Life Snatcher', 'merchant', { mood: 'sly' });
  H('Li Yun', 'Green-Eyed Tiger', 'general', { hairColor: 'brown' });
  H('Jiao Ting', 'Faceless', 'brawler', { mood: 'fierce' });
  H('Shi Yong', 'Stone General', 'brawler', {});
  H('Sun Xin', 'Little Yuchi', 'general', {});
  H('Gu Dasao', 'Tigress', 'amazon', { sex: 'f', hair: 'bun', mood: 'fierce', build: 'broad' });
  H('Gardener Zhang', 'Gardener', 'merchant', { hair: 'scarf', mood: 'smile' });
  H('Sun Erniang', 'Night Ogress', 'amazon', { sex: 'f', hair: 'bun', mood: 'sly' });
  H('Wang Dingliu', 'Living Flash', 'rogue', { build: 'slim' });
  H('Yu Baosi', 'Dangerous Road God', 'brawler', { build: 'broad' });
  H('Bai Sheng', 'Daylight Rat', 'rogue', { mood: 'sly' });
  H('Shi Qian', 'Flea on a Drum', 'rogue', { build: 'slim', mood: 'sly' }, { dex: 96, str: 30, int: 30 });
  H('Duan Jingzhu', 'Golden Dog', 'rogue', { hairColor: 'brown', mood: 'sly' });

  // Other outlaws of the marsh.
  H('Chao Gai', 'Pagoda Bearer', 'leader', { age: 'adult', hairColor: 'black', skin: 2, hair: 'topknot', beard: 'full', build: 'broad', mood: 'calm' }, { str: 82, dex: 74, courage: 90, int: 94, mercy: 88, pop: 60 });
  H('Wang Lun', 'White-Robed Scholar', 'scholar', { hair: 'cap', beard: 'goatee', mood: 'sly', build: 'slim', garb: 1 }, { int: 25, mercy: 20, courage: 30, wis: 62 });

  // Rebel kings who hold prefectures of their own.
  H('Tian Hu', 'Rebel of Hebei', 'boss', { hair: 'helmet', beard: 'wild', mood: 'fierce' }, {}, { role: 'boss' });
  H('Wang Qing', 'Rebel of Huaixi', 'boss', { hair: 'cap', beard: 'mustache', mood: 'sly' }, {}, { role: 'boss' });
  H('Fang La', 'Rebel of Jiangnan', 'boss', { hair: 'turban', beard: 'full', mood: 'fierce', garb: 13 }, { wis: 78 }, { role: 'boss' });
  H('Zhu Chaofeng', 'Squire of the Zhu Manor', 'boss', { hair: 'cap', beard: 'mustache', mood: 'sly' }, {}, { role: 'boss' });
  H('Zeng Nong', 'Master of Zeng Fortress', 'boss', { hair: 'turban', beard: 'full', age: 'old' }, {}, { role: 'boss' });

  // The court of Gao Qiu.
  H('Gao Qiu', 'Minister of War', 'official', { hair: 'official', beard: 'mustache', brows: 'thin', mood: 'sly', garb: 11 }, { body: 75, str: 48, dex: 72, wis: 78, int: 74, mercy: 66, courage: 77 }, { role: 'villain' });
  H('Cai Jing', 'Grand Tutor', 'official', { age: 'old', hair: 'official', beard: 'long', mood: 'sly', garb: 21 }, { wis: 90 }, { role: 'official' });
  H('Tong Guan', 'Privy Commander', 'official', { hair: 'official', beard: 'none', mood: 'sly', garb: 11 }, { str: 60, courage: 55 }, { role: 'official' });
  H('Yang Jian', 'Grand Guardian', 'official', { hair: 'official', beard: 'none', mood: 'sly' }, {}, { role: 'official' });
  H('Liang Shijie', 'Governor of Daming', 'official', { hair: 'official', beard: 'goatee', mood: 'calm' }, {}, { role: 'official' });
  H('Cai Jiu', 'Governor of Jiangzhou', 'official', { hair: 'official', beard: 'mustache', age: 'young' }, {}, { role: 'official' });
  H('Murong Yanda', 'Governor of Qingzhou', 'official', { hair: 'official', beard: 'full' }, {}, { role: 'official' });
  H('Gao Lian', 'Prefect of Gaotang', 'official', { hair: 'official', beard: 'mustache', mood: 'fierce' }, { wis: 82 }, { role: 'official' });
  H('Huang Wenbing', 'Schemer', 'official', { hair: 'cap', beard: 'goatee', mood: 'sly' }, {}, { role: 'official' });
  H('He Tao', 'Police Inspector', 'officer', { hair: 'cap', beard: 'mustache' }, {}, { role: 'official' });
  H('Zhang Shuye', 'Prefect of Haizhou', 'official', { hair: 'official', beard: 'long', mood: 'calm' }, { int: 70, mercy: 60 }, { role: 'official' });
  H('Wen Huanzhang', 'Imperial General', 'officer', { hair: 'helmet', beard: 'long' }, { wis: 80 }, { role: 'official' });
  H('Dang Shiying', 'Imperial General', 'officer', { hair: 'helmet', beard: 'full' }, {}, { role: 'official' });
  H('Dang Shixiong', 'Imperial General', 'officer', { hair: 'helmet', beard: 'full' }, {}, { role: 'official' });
  H('Wang Huan', 'Imperial General', 'officer', { hair: 'helmet', beard: 'long', age: 'old' }, {}, { role: 'official' });
  H('Han Cun', 'Imperial General', 'officer', { hair: 'helmet' }, {}, { role: 'official' });
  H('Zhou Ang', 'Imperial General', 'officer', { hair: 'helmet', mood: 'fierce' }, {}, { role: 'official' });
  H('Qiu Yue', 'Imperial General', 'officer', { hair: 'helmet' }, {}, { role: 'official' });
  H('Yang Wen', 'Imperial General', 'officer', { hair: 'helmet' }, {}, { role: 'official' });

  BK.Heroes = {
    ARCH: ARCH,
    STATS: STATS,
    list: list,
    byKey: function (key) {
      for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
      return null;
    },

    // The ten playable Good Fellows, their map colours and personal stat limits.
    GOOD_FELLOWS: [
      { key: 'Lu Zhishen', color: 12 },
      { key: 'Shi Jin', color: 18 },
      { key: 'Song Jiang', color: 13 },
      { key: 'Lin Chong', color: 19 },
      { key: 'Wu Song', color: 15 },
      { key: 'Yang Zhi', color: 21 },
      { key: 'Chao Gai', color: 2 },
      { key: 'Li Kui', color: 4 },
      { key: 'Li Jun', color: 17 },
      { key: 'Li Ying', color: 22 }
    ],

    // Generic names for officials and townsfolk who fill the rest of the 255 slots.
    SURNAMES: ['Wang', 'Zhao', 'Qian', 'Zheng', 'Feng', 'Chen', 'Chu', 'Wei', 'Jiang', 'Shen', 'Han',
      'Zhu', 'Qin', 'You', 'He', 'Lu', 'Shi', 'Zhang', 'Kong', 'Cao', 'Yan', 'Hua', 'Jin', 'Tao',
      'Qi', 'Xie', 'Zou', 'Bai', 'Shui', 'Dou', 'Yun', 'Su', 'Pan', 'Ge', 'Fan', 'Peng', 'Lang', 'Lu',
      'Wei', 'Chang', 'Ma', 'Miao', 'Fang', 'Ren', 'Yuan', 'Liu', 'Bao', 'Shi', 'Tang', 'Fei', 'Lian',
      'Cen', 'Xue', 'Lei', 'He', 'Ni', 'Tang', 'Teng', 'Yin', 'Luo', 'Bi', 'Hao', 'Wu', 'An', 'Chang',
      'Le', 'Yu', 'Shi', 'Fu', 'Pi', 'Bian', 'Qi', 'Kang', 'Wu', 'Yu', 'Yuan', 'Bu', 'Gu', 'Meng',
      'Ping', 'Huang', 'Mu', 'Xiao', 'Yin', 'Yao', 'Shao', 'Zhan', 'Wang', 'Qi', 'Mao', 'Yu', 'Di'],
    GIVEN: ['An', 'Bin', 'Cheng', 'Da', 'De', 'Fu', 'Gang', 'Guang', 'Hai', 'Heng', 'Hong', 'Hu',
      'Hui', 'Jian', 'Jie', 'Jing', 'Jun', 'Kai', 'Kang', 'Liang', 'Lin', 'Long', 'Ming', 'Ning',
      'Peng', 'Qiang', 'Quan', 'Rong', 'Shan', 'Sheng', 'Shou', 'Tai', 'Tao', 'Tian', 'Ting', 'Wei',
      'Wen', 'Wu', 'Xian', 'Xiang', 'Xin', 'Xing', 'Xiong', 'Xuan', 'Yan', 'Yi', 'Yong', 'You', 'Yuan',
      'Zhen', 'Zheng', 'Zhi', 'Zhong', 'Zhou', 'Zong', 'Bao', 'Chong', 'Dong', 'Fei', 'Gui', 'Han'],
    TOWN_CLASS: ['Farmer', 'Hunter', 'Fisherman', 'Peddler', 'Innkeeper', 'Scholar', 'Monk',
      'Young Master', 'Elder', 'Outlaw', 'Blacksmith', 'Boatman', 'Physician', 'Wrestler', 'Clerk',
      'Soldier', 'Woodcutter', 'Butcher'],
    ARCH_FOR_CLASS: {
      Farmer: 'commoner', Hunter: 'archer', Fisherman: 'sailor', Peddler: 'merchant', Innkeeper: 'merchant',
      Scholar: 'scholar', Monk: 'brawler', 'Young Master': 'noble', Elder: 'commoner', Outlaw: 'rogue',
      Blacksmith: 'craftsman', Boatman: 'sailor', Physician: 'craftsman', Wrestler: 'brawler', Clerk: 'scholar',
      Soldier: 'officer', Woodcutter: 'commoner', Butcher: 'brawler'
    },

    // Class label shown for a named hero, picked from their archetype.
    CLASS_FOR_ARCH: {
      leader: 'Clerk', general: 'Soldier', brawler: 'Outlaw', archer: 'Hunter', scholar: 'Scholar',
      sorcerer: 'Taoist', sailor: 'Boatman', rogue: 'Outlaw', craftsman: 'Artisan', merchant: 'Innkeeper',
      amazon: 'Swordswoman', noble: 'Young Master', official: 'Official', officer: 'Officer',
      boss: 'Chieftain', commoner: 'Farmer'
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BK.Heroes;
})(typeof window !== 'undefined' ? window : globalThis);
