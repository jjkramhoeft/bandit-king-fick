/* The four starting scenarios. Placements follow the novel's geography; every number here
   (strength, starting stocks) is this game's own design. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  BK.Scenarios = [
    {
      id: 1, year: 1101, title: 'The Wicked Minister',
      blurb: 'Gao Qiu has risen from kicking a ball for a prince to commanding the armies of the Song. ' +
        'Honest men are driven into the marshes and mountains. Five Good Fellows, all of them outlaws ' +
        'without a home, begin to gather followers.',
      imperialBoost: 0,
      // As in the original, every Good Fellow starts this scenario in exile. Their hiding places
      // have no ruler yet, so each band can settle at once.
      empty: [4, 17, 20, 26],
      goodFellows: {
        'Lu Zhishen': { pref: 17, exile: true, followers: ['Cao Zheng', 'Li Zhong', 'Zhou Tong'], bandits: 20 },
        'Shi Jin': { pref: 26, exile: true, followers: ['Zhu Wu', 'Chen Da', 'Yang Chun'], bandits: 20 },
        'Lin Chong': { pref: 4, exile: true, followers: ['Chai Jin'], bandits: 20 },
        'Yang Zhi': { pref: 15, exile: true, followers: [], bandits: 15 },
        'Chao Gai': { pref: 20, exile: true, followers: ['Wu Yong', 'Gongsun Sheng', 'Liu Tang', 'Bai Sheng'], bandits: 20 }
      },
      bosses: {
        'Wang Lun': { pref: 19, followers: ['Du Qian', 'Song Wan', 'Zhu Gui'] },
        'Tian Hu': { pref: 5 },
        'Wang Qing': { pref: 36 },
        'Fang La': { pref: 47 },
        'Zhu Chaofeng': { pref: 16 },
        'Zeng Nong': { pref: 1 }
      },
      locals: [10, 11, 43, 48],
      imperial: {
        'Gao Qiu': 24, 'Wen Huanzhang': 24, 'Dang Shiying': 24, 'Dang Shixiong': 23, 'Wang Huan': 29,
        'Cai Jing': 28, 'Tong Guan': 25, 'Yang Jian': 29, 'Liang Shijie': 15, 'Cai Jiu': 46,
        'Murong Yanda': 9, 'Gao Lian': 7, 'Huang Wenbing': 42, 'He Tao': 30, 'Zhang Shuye': 31,
        'Han Cun': 3, 'Zhou Ang': 22, 'Qiu Yue': 6, 'Yang Wen': 40
      }
    },
    {
      id: 2, year: 1103, title: 'Heroes Gather',
      blurb: 'Lin Chong has driven out the jealous Wang Lun and holds Liangshan Marsh. ' +
        'Song Jiang wanders as a branded exile. Seven Good Fellows contend for the right to strike at Gao Qiu.',
      imperialBoost: 1,
      goodFellows: {
        'Lu Zhishen': { pref: 17, followers: ['Cao Zheng', 'Li Zhong', 'Zhou Tong'] },
        'Shi Jin': { pref: 26, followers: ['Zhu Wu', 'Chen Da', 'Yang Chun'] },
        'Song Jiang': { pref: 46, exile: true, followers: ['Dai Zong', 'Li Kui'], bandits: 20 },
        'Lin Chong': { pref: 19, followers: ['Du Qian', 'Song Wan', 'Zhu Gui'] },
        'Wu Song': { pref: 23, followers: ['Shi En', 'Gardener Zhang', 'Sun Erniang'] },
        'Yang Zhi': { pref: 21, followers: ['Suo Chao'] },
        'Chao Gai': { pref: 20, followers: ['Wu Yong', 'Gongsun Sheng', 'Liu Tang', 'Ruan Xiaoer', 'Ruan Xiaowu', 'Ruan Xiaoqi'] }
      },
      bosses: {
        'Tian Hu': { pref: 5 },
        'Wang Qing': { pref: 36 },
        'Fang La': { pref: 47 },
        'Zhu Chaofeng': { pref: 16 },
        'Zeng Nong': { pref: 1 }
      },
      locals: [10, 11, 48],
      imperial: {
        'Gao Qiu': 24, 'Wen Huanzhang': 24, 'Dang Shiying': 24, 'Dang Shixiong': 23, 'Wang Huan': 29,
        'Cai Jing': 28, 'Tong Guan': 25, 'Yang Jian': 29, 'Liang Shijie': 15, 'Cai Jiu': 42,
        'Murong Yanda': 9, 'Gao Lian': 7, 'Huang Wenbing': 44, 'He Tao': 30, 'Zhang Shuye': 31,
        'Han Cun': 3, 'Zhou Ang': 22, 'Qiu Yue': 6, 'Yang Wen': 40
      }
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
        'Li Kui': { pref: 21, exile: true, followers: [], bandits: 15 },
        'Li Ying': { pref: 30, followers: ['Du Xing'] }
      },
      bosses: {
        'Tian Hu': { pref: 5 },
        'Wang Qing': { pref: 36 },
        'Fang La': { pref: 47 },
        'Zhu Chaofeng': { pref: 16 },
        'Zeng Nong': { pref: 1 }
      },
      locals: [10, 48],
      imperial: {
        'Gao Qiu': 24, 'Wen Huanzhang': 24, 'Dang Shiying': 24, 'Dang Shixiong': 23, 'Wang Huan': 29,
        'Cai Jing': 28, 'Tong Guan': 25, 'Yang Jian': 29, 'Liang Shijie': 15, 'Cai Jiu': 46,
        'Murong Yanda': 9, 'Gao Lian': 7, 'Huang Wenbing': 42, 'He Tao': 23, 'Zhang Shuye': 31,
        'Han Cun': 3, 'Zhou Ang': 22, 'Qiu Yue': 6, 'Yang Wen': 40
      }
    },
    {
      id: 4, year: 1105, title: 'The Gathering Storm',
      blurb: 'Chao Gai is gone and Song Jiang commands Liangshan. On the Yangtze the boatman Li Jun gathers river ' +
        'heroes; in the north the Jurchen stir. Only twenty-two years remain before the barbarians fall on the empire.',
      imperialBoost: 3,
      goodFellows: {
        'Song Jiang': { pref: 19, followers: ['Wu Yong', 'Gongsun Sheng', 'Lin Chong', 'Hua Rong', 'Qin Ming', 'Dai Zong', 'Liu Tang', 'Ruan Xiaoer', 'Ruan Xiaowu', 'Ruan Xiaoqi'] },
        'Li Kui': { pref: 21, exile: true, followers: ['Jiao Ting'], bandits: 18 },
        'Li Jun': { pref: 46, followers: ['Zhang Heng', 'Zhang Shun', 'Tong Wei', 'Tong Meng', 'Mu Hong', 'Mu Chun', 'Xue Yong'] },
        'Li Ying': { pref: 30, followers: ['Du Xing', 'Hu Sanniang'] }
      },
      bosses: {
        'Tian Hu': { pref: 5 },
        'Wang Qing': { pref: 36 },
        'Fang La': { pref: 47 },
        'Zeng Nong': { pref: 1 }
      },
      locals: [10, 48],
      imperial: {
        'Gao Qiu': 24, 'Wen Huanzhang': 24, 'Dang Shiying': 24, 'Dang Shixiong': 23, 'Wang Huan': 29,
        'Cai Jing': 28, 'Tong Guan': 25, 'Yang Jian': 29, 'Liang Shijie': 15, 'Cai Jiu': 42,
        'Murong Yanda': 17, 'Gao Lian': 7, 'Huang Wenbing': 44, 'He Tao': 20, 'Zhang Shuye': 31,
        'Han Cun': 3, 'Zhou Ang': 22, 'Qiu Yue': 6, 'Yang Wen': 40
      }
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = BK.Scenarios;
})(typeof window !== 'undefined' ? window : globalThis);
