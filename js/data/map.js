/* Map of Song China: 49 prefectures placed at their historical seats (longitude/latitude),
   coastline, rivers, lakes and mountain ranges. Region borders are generated from these
   seeds by BK.MapGeo, so the map is an original drawing rather than a copy of any game. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  var P = function (id, name, lon, lat, area, tags) {
    return { id: id, name: name, lon: lon, lat: lat, area: area, tags: tags || [] };
  };

  BK.MapData = {
    W: 348, H: 266,
    LON0: 107.8, LON1: 122.2, LAT0: 40.2, LAT1: 28.0,
    frontierLat: 39.45,
    capital: 24,
    liangshan: 19,

    prefs: [
      P(1, 'Daizhou', 112.9, 39.0, 'north', ['border']),
      P(2, 'Xiongzhou', 116.2, 39.0, 'north', ['border']),
      P(3, 'Dingzhou', 115.0, 38.55, 'north', ['border']),
      P(4, 'Cangzhou', 117.0, 38.1, 'north', []),
      P(5, 'Taiyuan', 112.5, 37.85, 'north', []),
      P(6, 'Zhenzhou', 114.45, 37.95, 'north', []),
      P(7, 'Enzhou', 115.75, 37.4, 'north', []),
      P(8, 'Binzhou', 118.0, 37.4, 'east', []),
      P(9, 'Laizhou', 119.9, 36.95, 'east', []),
      P(10, 'Dengzhou', 121.0, 37.45, 'east', []),
      P(11, 'Yanan', 109.5, 36.6, 'west', ['border']),
      P(12, 'Fenzhou', 111.6, 37.1, 'north', []),
      P(13, 'Luzhou', 113.1, 36.3, 'north', []),
      P(14, 'Zhangde', 114.35, 36.0, 'central', []),
      P(15, 'Daming', 115.35, 36.4, 'central', ['rich']),
      P(16, 'Jinan', 117.0, 36.65, 'east', []),
      P(17, 'Qingzhou', 118.5, 36.7, 'east', []),
      P(18, 'Mizhou', 119.4, 35.9, 'east', []),
      P(19, 'Yunzhou', 115.75, 35.75, 'central', ['liangshan']),
      P(20, 'Jizhou', 116.6, 35.3, 'central', []),
      P(21, 'Yizhou', 118.3, 35.1, 'east', []),
      P(22, 'Hezhong', 110.4, 35.0, 'west', []),
      P(23, 'Huaizhou', 113.1, 35.2, 'central', []),
      P(24, 'Kaifeng', 114.3, 34.75, 'central', ['capital', 'rich']),
      P(25, 'Jingzhao', 108.9, 34.3, 'west', ['rich']),
      P(26, 'Huazhou', 109.85, 34.45, 'west', []),
      P(27, 'Shanzhou', 111.2, 34.7, 'west', []),
      P(28, 'Luoyang', 112.45, 34.6, 'central', ['rich']),
      P(29, 'Yingchang', 113.8, 34.0, 'central', []),
      P(30, 'Xuzhou', 117.2, 34.3, 'east', []),
      P(31, 'Haizhou', 119.2, 34.6, 'east', []),
      P(32, 'Bozhou', 115.8, 33.85, 'central', []),
      P(33, 'Chenzhou', 114.9, 33.6, 'central', []),
      P(34, 'Sizhou', 118.3, 33.5, 'east', []),
      P(35, 'Tangzhou', 112.95, 32.75, 'south', []),
      P(36, 'Caizhou', 114.35, 32.95, 'south', []),
      P(37, 'Shouzhou', 116.8, 32.6, 'south', []),
      P(38, 'Yangzhou', 119.45, 32.5, 'south', ['rich']),
      P(39, 'Xiangyang', 112.1, 32.0, 'south', []),
      P(40, 'Jiankang', 118.75, 31.9, 'south', ['rich']),
      P(41, 'Suzhou', 120.6, 31.35, 'south', ['rich']),
      P(42, 'Huangzhou', 114.7, 30.5, 'south', []),
      P(43, 'Jingnan', 112.2, 30.55, 'south', []),
      P(44, 'Xuanzhou', 118.75, 30.9, 'south', []),
      P(45, 'Hangzhou', 120.15, 30.25, 'south', ['rich']),
      P(46, 'Jiangzhou', 116.0, 29.7, 'south', []),
      P(47, 'Muzhou', 119.25, 29.6, 'south', []),
      P(48, 'Mingzhou', 121.45, 29.9, 'south', []),
      P(49, 'Hongzhou', 115.9, 28.65, 'south', [])
    ],

    // Sea polygons in lon/lat. The Shandong peninsula runs off the east edge and splits them.
    seas: [
      [[122.2, 40.2], [119.6, 40.2], [119.6, 39.9], [118.9, 39.3], [117.8, 38.95], [117.55, 38.5],
        [118.1, 38.1], [118.8, 37.75], [119.1, 37.25], [119.8, 37.1], [120.2, 37.4], [120.7, 37.8],
        [121.4, 37.6], [122.2, 37.5]],
      [[122.2, 37.1], [122.0, 36.95], [121.0, 36.6], [120.4, 36.1], [119.6, 35.5], [119.3, 34.8],
        [119.8, 34.3], [120.3, 33.6], [120.8, 32.7], [121.0, 32.1], [121.8, 31.6], [121.9, 31.1],
        [121.0, 30.8], [120.4, 30.4], [120.9, 30.15], [121.6, 30.05], [121.9, 29.6], [121.6, 29.0],
        [121.4, 28.0], [122.2, 28.0]]
    ],

    // The Yellow River follows its Northern Song course past Daming to the Bohai.
    rivers: {
      yellow: [[110.9, 40.2], [110.5, 39.3], [110.6, 38.0], [110.3, 36.8], [110.5, 35.6], [110.3, 34.65],
        [111.2, 34.85], [112.4, 34.92], [113.6, 34.98], [114.4, 35.15], [115.0, 35.7], [115.6, 36.6],
        [116.3, 37.4], [116.9, 38.3], [117.7, 38.95]],
      yangtze: [[107.8, 30.2], [109.5, 31.0], [111.2, 30.7], [112.2, 30.2], [113.2, 29.7], [114.3, 30.55],
        [115.4, 29.95], [116.0, 29.82], [117.0, 30.5], [118.0, 31.2], [118.8, 32.08], [119.5, 32.25],
        [120.5, 32.0], [121.3, 31.75]],
      huai: [[112.6, 32.45], [113.5, 32.4], [114.5, 32.45], [115.6, 32.5], [116.6, 32.75], [117.6, 33.1],
        [118.6, 33.3], [119.3, 33.6], [119.95, 34.0]],
      wei: [[107.8, 34.4], [109.0, 34.45], [110.3, 34.62]],
      han: [[107.8, 33.0], [109.5, 32.7], [111.0, 32.5], [112.1, 32.15], [112.6, 31.2], [113.4, 30.7],
        [114.3, 30.55]],
      fen: [[112.6, 38.4], [112.3, 37.6], [111.7, 36.8], [111.3, 36.0], [110.6, 35.6]]
    },

    lakes: [
      { name: 'Liangshan Marsh', lon: 116.08, lat: 35.98, r: 0.32 },
      { name: 'Tai Lake', lon: 120.2, lat: 31.2, r: 0.32 },
      { name: 'Poyang Lake', lon: 116.3, lat: 29.15, r: 0.38 },
      { name: 'Dongting Lake', lon: 112.85, lat: 29.3, r: 0.42 },
      { name: 'Hongze Lake', lon: 118.7, lat: 33.25, r: 0.22 }
    ],

    // Mountain ranges as clusters of peaks: centre, spread in degrees, peak count.
    mountains: [
      { lon: 113.6, lat: 37.4, dlon: 0.35, dlat: 1.6, n: 16 },   // Taihang
      { lon: 111.2, lat: 37.4, dlon: 0.35, dlat: 1.2, n: 10 },   // Luliang
      { lon: 109.6, lat: 33.85, dlon: 1.6, dlat: 0.3, n: 14 },   // Qinling
      { lon: 112.3, lat: 33.7, dlon: 0.6, dlat: 0.3, n: 6 },     // Funiu
      { lon: 115.6, lat: 31.25, dlon: 0.9, dlat: 0.3, n: 8 },    // Dabie
      { lon: 117.1, lat: 36.2, dlon: 0.3, dlat: 0.2, n: 4 },     // Tai Shan
      { lon: 118.2, lat: 30.05, dlon: 0.7, dlat: 0.4, n: 7 },    // Huang Shan
      { lon: 109.4, lat: 31.4, dlon: 0.9, dlat: 0.6, n: 9 },     // Wu Shan
      { lon: 113.3, lat: 39.2, dlon: 0.8, dlat: 0.2, n: 6 }      // Wutai
    ]
  };

  BK.MapData.prefById = function (id) { return BK.MapData.prefs[id - 1]; };

  if (typeof module !== 'undefined' && module.exports) module.exports = BK.MapData;
})(typeof window !== 'undefined' ? window : globalThis);
