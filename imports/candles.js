Candles = new Meteor.Collection('candles');

timestampToIndex = function (timestamp) {
    var index = timestamp / 100000;
    index = index / 3;
    return index;
}

indexToTimestamp = function (index) {
    return index * 3 * 100000;
}

getLastCandleIndex = function () {
    return Candles.findOne({}, { sort: { index: -1 } }).index; // TODO: fix
}