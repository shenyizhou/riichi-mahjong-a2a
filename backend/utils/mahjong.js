const Syanten = require('syanten');
const Riichi = require('riichi');

// 牌转换工具
const suitsMap = {
  'man': 0,
  'pin': 1,
  'sou': 2,
  'wind': 3,
  'dragon': 3
};

const windsMap = {
  '东': 0, '南': 1, '西': 2, '北': 3
};

const dragonsMap = {
  '白': 4, '发': 5, '中': 6
};

// 转换为 Syanten 库需要的二维数组格式 [[m0-m8], [p0-p8], [s0-s8], [z0-z6]]
function toSyantenFormat(tiles) {
  const haiArr = [
    new Array(9).fill(0), // man
    new Array(9).fill(0), // pin
    new Array(9).fill(0), // sou
    new Array(7).fill(0)  // honor
  ];

  tiles.forEach(tile => {
    let suitIdx = suitsMap[tile.suit];
    let rankIdx = -1;

    if (tile.suit === 'man' || tile.suit === 'pin' || tile.suit === 'sou') {
      rankIdx = parseInt(tile.rank) - 1;
    } else if (tile.suit === 'wind') {
      rankIdx = windsMap[tile.rank];
    } else if (tile.suit === 'dragon') {
      rankIdx = dragonsMap[tile.rank];
    }

    if (suitIdx !== undefined && rankIdx !== -1) {
      haiArr[suitIdx][rankIdx]++;
    }
  });

  return haiArr;
}

// 转换为 Riichi 库需要的字符串格式 (1m2p3s...)
function toRiichiString(tiles) {
  const counts = { m: [], p: [], s: [], z: [] };
  
  const wMap = { '东': 1, '南': 2, '西': 3, '北': 4 };
  const dMap = { '白': 5, '发': 6, '中': 7 };

  tiles.forEach(tile => {
    if (tile.suit === 'man') counts.m.push(tile.value);
    else if (tile.suit === 'pin') counts.p.push(tile.value);
    else if (tile.suit === 'sou') counts.s.push(tile.value);
    else if (tile.suit === 'wind') counts.z.push(wMap[tile.rank]);
    else if (tile.suit === 'dragon') counts.z.push(dMap[tile.rank]);
  });

  let result = '';
  ['m', 'p', 's', 'z'].forEach(suit => {
    if (counts[suit].length > 0) {
      counts[suit].sort((a, b) => a - b);
      result += counts[suit].join('') + suit;
    }
  });
  
  return result;
}

function calculateShanten(tiles) {
  try {
    const haiArr = toSyantenFormat(tiles);
    // syanten library default export calculates min shanten
    const shanten = Syanten(haiArr);
    return shanten;
  } catch (e) {
    console.error('Shanten calc error', e);
    return 99;
  }
}

// 简单的 AI 决策：计算切掉哪张牌后向听数最小
// 如果向听数相同，则随机切一张
function getBestDiscard(hand) {
    let bestDiscard = null;
    let minShanten = 99;
    
    // 遍历手牌，尝试切掉每一张
    for (let i = 0; i < hand.length; i++) {
        const tile = hand[i];
        // 临时移除该牌
        const tempHand = [...hand];
        tempHand.splice(i, 1);
        
        const shanten = calculateShanten(tempHand);
        
        if (shanten < minShanten) {
            minShanten = shanten;
            bestDiscard = i;
        }
    }
    
    // 如果没有找到更优解（例如已经是听牌或者向听数无法优化），默认切最后摸到的一张（即索引最后的牌，通常是摸牌）
    // 或者随机切一张维持向听数的牌
    // 这里简单起见，如果计算出的 bestDiscard 还是 null，就切最后一张
    if (bestDiscard === null) {
        return hand.length - 1;
    }
    
    return bestDiscard;
}

function checkWin(handTiles, winTile, isTsumo) {
  try {
    let str = toRiichiString(handTiles);
    if (winTile) {
      // Riichi lib expects the win tile to be part of the hand string usually?
      // Or separated? The lib takes one string.
      // If we are checking if hand+winTile is a win.
      const winTileStr = toRiichiString([winTile]);
      str += winTileStr;
    }
    
    const r = new Riichi(str);
    const result = r.calc();
    
    // Check if valid yaku exists
    if (result.yaku && Object.keys(result.yaku).length > 0) {
      return {
        isWin: true,
        score: result.ten,
        yaku: result.yaku,
        text: result.text
      };
    }
    return { isWin: false };
  } catch (e) {
    // Riichi lib might throw if hand is invalid count
    return { isWin: false };
  }
}

function getMjaiType(tile) {
    // Helper to convert internal tile to MJAI string (e.g. "1m", "5z")
    if (tile.suit === 'man') return tile.rank + 'm';
    if (tile.suit === 'pin') return tile.rank + 'p';
    if (tile.suit === 'sou') return tile.rank + 's';
    if (tile.suit === 'wind') {
        const map = { '东': 1, '南': 2, '西': 3, '北': 4 };
        return map[tile.rank] + 'z';
    }
    if (tile.suit === 'dragon') {
        const map = { '白': 5, '发': 6, '中': 7 };
        return map[tile.rank] + 'z';
    }
    return '?';
}

module.exports = {
  toSyantenFormat,
  toRiichiString,
  calculateShanten,
  getBestDiscard,
  checkWin,
  getMjaiType
};
