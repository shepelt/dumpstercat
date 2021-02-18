import fs from 'fs';
import { sep } from 'path';
import { _ } from 'meteor/underscore';
var PImage = require('pureimage');

const tempDir = fs.mkdtempSync('/tmp/' + sep);

getLastCandle = function (market) {
    return Candles.findOne({ market: "KRW-BTC" }, { sort: { index: -1 } });
}


candleDisplay = {
    width: 10,
    wickWidth: 1,
    margin: 1,
    spacing: 2,
    positive: "0xEF5450",
    negative: "0x25A69A",
    neutral: "0x566573",
    infowidth: 130,
    background: "0x161A25",
    infobackground: "0xDDDDDD",
    textcolor: "0xFFFFFF",
    chartwidth: 630,
    chartheight: 480
};

var ctx = null;

var basePath = process.env['METEOR_SHELL_DIR'] + '/../../../public';
var fnt = PImage.registerFont(basePath + '/freepixel.ttf', 'Open Sans');
fnt.load();

drawCandles = function (endIndex, market, res) {
    // empty container

    // prepare graphics
    var img = PImage.make(candleDisplay.chartwidth, candleDisplay.chartheight);
    ctx = img.getContext('2d');
    // background
    addRect(0, 0, candleDisplay.chartwidth, candleDisplay.chartheight, "0x000000", 1.0);

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
            addHorizontalLine(boxHeight, canvasWidth + 1, 4.0, "0xD5402B", 0.9);
            addRect(canvasWidth + 2, boxHeight - 10, candleDisplay.infowidth - 1, 20, "0xD5402B");
            addText(canvasWidth + 5, boxHeight - 10, "0xFFFFFF", "" + candle.trade_price + " KRW")

        }
    }

    // save file
    var filePath = basePath + '/out.png';

    PImage.encodePNGToStream(img, fs.createWriteStream(filePath)).then(() => {
        console.log("wrote out the png file to out.png", filePath);
        if (res) {
            res(filePath);
        }
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

// rendering implementation
addHorizontalLine = function (y, width, linethickness, linecolor, alpha) {
    ctx.lineWidth = linethickness;

    var gap = 10;
    var alternate = false;
    for (var x = 0; x < width; x += gap) {
        if (alternate) {
            alternate = false;
            ctx.strokeStyle = hexToRgbA(linecolor, alpha);
        } else {
            alternate = true;
            ctx.strokeStyle = hexToRgbA(linecolor, 0);
        }
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + gap, y);
        ctx.stroke();
    }
}

addRect = function (x, y, xd, yd, color, alpha, text, textcolor) {
    if (alpha == undefined)
        alpha = 1.0;

    // normalized coordinates
    if (xd < 0) {
        x = x + xd;
        xd = Math.abs(xd);
    }
    if (yd < 0) {
        y = y + yd;
        yd = Math.abs(yd);
    }
    ctx.fillStyle = hexToRgbA(color, alpha);
    ctx.fillRect(x, y, xd, yd);

    if (text) {
        ctx.fillStyle = hexToRgbA(textcolor, 1.0);
        ctx.font = "20pt 'Open Sans'";
        ctx.fillText(text, x - 5, y - 5);
    }
}

addText = function (x, y, color, text) {
    ctx.fillStyle = hexToRgbA(color, 1.0);
    ctx.font = "20pt 'Open Sans'";
    ctx.fillText(text, x, y + 15);
}

function hexToRgbA(hex, alpha) {
    var c;
    hex = hex.replace("0x", "#");
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    throw new Error('Bad Hex');
}