/* The four starting scenarios. Placements follow the novel's geography; every number here
   (strength, starting stocks) is this game's own design.

   As in the original, the map opens mostly empty: Gao Qiu's court holds the capital and the great
   cities, a few bandit chiefs hold their hills, and every other prefecture is wild land with no
   ruler, waiting for a band to settle it. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  // The empire's core: Kaifeng and the rich cities. It is the same in every scenario; Gao Qiu grows
  // stronger through imperialBoost rather than by taking more land.
  var EMPIRE = [24, 28, 15, 25, 38, 40, 41, 45, 43];
  // Where each named official of the court is stationed. Every one sits in an EMPIRE prefecture.
  var COURT = {
    'Gao Qiu': 24, 'Wen Huanzhang': 24, 'Dang Shiying': 24,
    'Cai Jing': 28, 'Wang Huan': 28, 'Dang Shixiong': 28,
    'Tong Guan': 25, 'Yang Jian': 25, 'Zhou Ang': 25,
    'Liang Shijie': 15, 'Han Cun': 15, 'Qiu Yue': 15,
    'Murong Yanda': 38,
    'Huang Wenbing': 40,
    'Gao Lian': 41,
    'He Tao': 45, 'Yang Wen': 45,
    'Cai Jiu': 43, 'Zhang Shuye': 43
  };
  // The three rebel kings who hold land from 1103 on.
  var REBELS = {
    'Tian Hu': { pref: 5 },
    'Wang Qing': { pref: 36 },
    'Fang La': { pref: 47 }
  };

  BK.Scenarios = [
    {
      id: 1, year: 1101, title: 'The Wicked Minister',
      blurb: 'Gao Qiu has risen from kicking a ball for a prince to commanding the armies of the Song. ' +
        'Honest men are driven into the marshes and mountains. Five Good Fellows, all of them outlaws ' +
        'without a home or a single soldier, set out to gather followers.',
      imperialBoost: 0,
      // As in the original, every Good Fellow starts this scenario in exile, alone and unknown.
      // Lu Zhishen and Wu Song hide in wild land and can settle at once. Shi Jin hides in the
      // bandit Zhu Wu's hills, Yang Zhi in imperial Daming, and Lin Chong in Gao Qiu's own capital,
      // so they must flee or grow strong before they can take a home.
      pop: 0,
      goodFellows: {
        'Lu Zhishen': { pref: 17, exile: true, followers: [] },
        'Shi Jin': { pref: 26, exile: true, followers: [] },
        'Lin Chong': { pref: 24, exile: true, followers: [] },
        'Yang Zhi': { pref: 15, exile: true, followers: [] },
        'Wu Song': { pref: 7, exile: true, followers: [] }
      },
      // Old friends who live as townsfolk and can be recruited.
      townsfolk: {
        'Cao Zheng': 17, 'Li Zhong': 17, 'Zhou Tong': 17,
        'Chai Jin': 4,
        'Chao Gai': 20, 'Wu Yong': 20, 'Gongsun Sheng': 20, 'Liu Tang': 20, 'Bai Sheng': 20
      },
      bosses: {
        'Wang Lun': { pref: 19, followers: ['Du Qian', 'Song Wan', 'Zhu Gui'] },
        'Zhu Wu': { pref: 26, followers: ['Chen Da', 'Yang Chun'] },
        'Tian Hu': { pref: 5 }
      },
      empire: EMPIRE,
      imperial: COURT
    },
    {
      id: 2, year: 1103, title: 'Heroes Gather',
      blurb: 'Lin Chong has driven out the jealous Wang Lun and holds Liangshan Marsh. ' +
        'Song Jiang wanders as a branded exile. Seven Good Fellows contend for the right to strike at Gao Qiu.',
      imperialBoost: 1,
      goodFellows: {
        'Lu Zhishen': { pref: 17, followers: ['Cao Zheng', 'Li Zhong', 'Zhou Tong'] },
        'Shi Jin': { pref: 26, followers: ['Zhu Wu', 'Chen Da', 'Yang Chun'] },
        'Song Jiang': { pref: 46, exile: true, followers: ['Dai Zong', 'Li Kui'] },
        'Lin Chong': { pref: 19, followers: ['Du Qian', 'Song Wan', 'Zhu Gui'] },
        'Wu Song': { pref: 23, followers: ['Shi En', 'Gardener Zhang', 'Sun Erniang'] },
        'Yang Zhi': { pref: 21, followers: ['Suo Chao'] },
        'Chao Gai': { pref: 20, followers: ['Wu Yong', 'Gongsun Sheng', 'Liu Tang', 'Ruan Xiaoer', 'Ruan Xiaowu', 'Ruan Xiaoqi'] }
      },
      bosses: REBELS,
      empire: EMPIRE,
      imperial: COURT
    },
    {
      id: 3, year: 1104, title: 'Outlaws of the Marsh',
      blurb: 'Chao Gai leads the brotherhood of Liangshan. On Two Dragon Mountain Wu Song and the Flowery Monk ' +
        'raise their own banner, while Li Kui roams the hills of Yizhou alone. Gao Qiu tightens his grip.',
      imperialBoost: 2,
      goodFellows: {
        'Song Jiang': { pref: 20, followers: ['Hua Rong', 'Qin Ming', 'Huang Xin', 'Yan Shun', 'Wang Ying', 'Zheng Tianshou'] },
        'Wu Song': { pref: 17, followers: ['Lu Zhishen', 'Yang Zhi', 'Cao Zheng', 'Shi En', 'Gardener Zhang', 'Sun Erniang'] },
        'Chao Gai': { pref: 19, followers: ['Wu Yong', 'Gongsun Sheng', 'Lin Chong', 'Liu Tang', 'Ruan Xiaoer', 'Ruan Xiaowu', 'Ruan Xiaoqi', 'Du Qian', 'Song Wan', 'Zhu Gui'] },
        'Li Kui': { pref: 21, exile: true, followers: [] },
        'Li Ying': { pref: 30, followers: ['Du Xing'] }
      },
      bosses: REBELS,
      empire: EMPIRE,
      imperial: COURT
    },
    {
      id: 4, year: 1105, title: 'The Gathering Storm',
      blurb: 'Chao Gai is gone and Song Jiang commands Liangshan. On the Yangtze the boatman Li Jun gathers river ' +
        'heroes; in the north the Jurchen stir. Only twenty-two years remain before the barbarians fall on the empire.',
      imperialBoost: 3,
      goodFellows: {
        'Song Jiang': { pref: 19, followers: ['Wu Yong', 'Gongsun Sheng', 'Lin Chong', 'Hua Rong', 'Qin Ming', 'Dai Zong', 'Liu Tang', 'Ruan Xiaoer', 'Ruan Xiaowu', 'Ruan Xiaoqi'] },
        'Li Kui': { pref: 21, exile: true, followers: ['Jiao Ting'] },
        'Li Jun': { pref: 46, followers: ['Zhang Heng', 'Zhang Shun', 'Tong Wei', 'Tong Meng', 'Mu Hong', 'Mu Chun', 'Xue Yong'] },
        'Li Ying': { pref: 30, followers: ['Du Xing', 'Hu Sanniang'] }
      },
      bosses: REBELS,
      empire: EMPIRE,
      imperial: COURT
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = BK.Scenarios;
})(typeof window !== 'undefined' ? window : globalThis);
