Candles = new Meteor.Collection('candles');

timestampToIndex = function (timestamp) {
    var index = timestamp / 100000;
    index = index / 3;
    return index;
}

indexToTimestamp = function (index) {
    return index * 3 * 100000;
}

getLastCandle = function (market) {
    return Candles.findOne({ market: "KRW-BTC" }, { sort: { index: -1 } });
}