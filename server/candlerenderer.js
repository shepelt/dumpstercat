import fs from 'fs';
import { sep } from 'path';
import { _ } from 'meteor/underscore';
var PImage = require('pureimage');

const tempDir = fs.mkdtempSync('/tmp/' + sep);

getLastCandle = function (market) {
    return Candles.findOne({ market: "KRW-BTC" }, { sort: { index: -1 } });
}


candleDisplay = {
    width: 5,
    wickWidth: 1,
    margin: 1,
    spacing: 2,
    positive: "0xEF5450",
    negative: "0x25A69A",
    neutral: "0x566573",
    infowidth: 65,
    background: "0x161A25",
    infobackground: "0xDDDDDD",
    textcolor: "0xFFFFFF",
    chartwidth: 320,
    chartheight: 240
};

var ctx = null;

drawCandles = function (endIndex, market) {
    // empty container

    // prepare graphics
    var img = PImage.make(candleDisplay.chartwidth, candleDisplay.chartheight);
    ctx = img.getContext('2d');

    var chartWidth = candleDisplay.chartwidth - candleDisplay.infowidth;

    candleDisplay.endIndex = endIndex;
    candleDisplay.startIndex = endIndex - candleScreenToOrder(chartWidth) + 1;
    var candles = Candles.find({ "market": market, index: { $gte: candleDisplay.startIndex, $lte: candleDisplay.endIndex } }, { sort: { index: 1 } }).fetch();

    // draw frame
    var canvasHeight = candleDisplay.chartheight - candleDisplay.margin * 2;
    var canvasWidth = chartWidth - candleDisplay.margin * 2;
    addRect(candleDisplay.margin, candleDisplay.margin, canvasWidth, canvasHeight, candleDisplay.background);
    addRect(chartWidth, candleDisplay.margin, candleDisplay.infowidth - candleDisplay.margin, canvasHeight, candleDisplay.infobackground);

    var minPrice = _.min(candles, function (candle) { return candle.low_price }).low_price;
    var maxPrice = _.max(candles, function (candle) { return candle.high_price }).high_price;
    var priceRange = maxPrice - minPrice;

    var xOffset = candleDisplay.margin;
    for (var i = 0; i < candles.length; i++) {
        var candle = candles[i];
        var candleRising = candle.rising;
        var candleColor = candleDisplay.negative;
        if (candleRising) {
            candleColor = candleDisplay.positive;
        } else {
            candleColor = candleDisplay.negative;
        }

        if (candle.trade_price == candle.opening_price) {
            candleColor = candleDisplay.neutral;
        }


        // draw box
        var yOffset = candlePriceToScreen(priceRange, canvasHeight, candle.box_low_price - minPrice) + candleDisplay.margin;
        var yHeight = candlePriceToScreen(priceRange, canvasHeight, candle.box_high_price - minPrice) - yOffset;
        var boxHeight = yOffset + yHeight;
        var alpha = 1.0;
        if (candle.closed == false) {
            alpha = 1.0;
        } else {
            if (candle.height_outlier) {
                alpha = 0.5;
                candleColor = candleDisplay.neutral;
            } else {
                alpha = 1;
            }
        }
        addRect(xOffset, yOffset, candleDisplay.width, yHeight, candleColor, alpha);

        // draw wick
        var accent = undefined;
        if (candle.height_outlier == false && candle.dump_count > 2) {
            accent = candle.dump_count + "";
        }

        yOffset = candlePriceToScreen(priceRange, canvasHeight, candle.low_price - minPrice) + candleDisplay.margin;
        yHeight = candlePriceToScreen(priceRange, canvasHeight, candle.high_price - minPrice) - yOffset + 1;
        addRect(xOffset + Math.floor(candleDisplay.width / 2), yOffset, candleDisplay.wickWidth, yHeight, candleColor, alpha, accent, candleDisplay.textcolor);


        xOffset = xOffset + candleDisplay.width + candleDisplay.spacing;

        // draw visual guide
        if (i == candles.length - 1) {
            var dash = addHorizontalLine(boxHeight, canvasWidth + 1, 0.5, "0xD5402B", 0.9);
            // rectContainer.addChild(dash);

            var priceRect = addRect(canvasWidth + 2, boxHeight - 4, candleDisplay.infowidth - 1, 10, "0xD5402B");
            // rectContainer.addChild(priceRect);

            var price = addText(canvasWidth + 5, boxHeight - 4, "0x000000", "" + candle.trade_price + " KRW")
            // rectContainer.addChild(price);

        }
    }


    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(100, 50);
    ctx.stroke();

    // save file
    var filePath = process.env['METEOR_SHELL_DIR'] + '/../../../public/out.png';

    PImage.encodePNGToStream(img, fs.createWriteStream(filePath)).then(() => {
        console.log("wrote out the png file to out.png", filePath);
    }).catch((e) => {
        console.log("there was an error writing");
    });
}

candlePriceToScreen = function (priceRange, canvasHeight, price) {
    var ratio = price / priceRange;
    var position = canvasHeight - Math.floor(ratio * canvasHeight);
    return position;
}

candleOrderToScreen = function (index) {
    return index * (candleDisplay.width + candleDisplay.spacing) + candleDisplay.margin;
}

candleScreenToOrder = function (x) {
    var index = Math.floor((x - candleDisplay.margin) / (candleDisplay.width + candleDisplay.spacing));
    return index;
}

addHorizontalLine = function (y, width, linethickness, linecolor, alpha) {
    console.log("[HORIZONTAL LINE]", y, width)

}

addRect = function (x, y, xd, yd, color, alpha, text, textcolor) {
    console.log("[RECT]", x, y, xd, yd)
}

addText = function (x, y, color, text) {
    console.log("[TEXT]", x, y, text)
}