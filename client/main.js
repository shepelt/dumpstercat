import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { _ } from 'meteor/underscore';
import './main.html';
import '../imports/candles.js';
import './pixihelper.js';
import './router.js';

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
	textcolor: "0xFFFFFF"
};

drawCandles = function (endIndex) {
	// empty container
	rectContainer.removeChildren();

	var chartWidth = $("#chart").width() - candleDisplay.infowidth;

	candleDisplay.endIndex = endIndex;
	candleDisplay.startIndex = endIndex - candleScreenToOrder(chartWidth) + 1;
	var candles = Candles.find({ "market": Session.get("market"), index: { $gte: candleDisplay.startIndex, $lte: candleDisplay.endIndex } }, { sort: { index: 1 } }).fetch();

	// draw frame
	var canvasHeight = $("#chart").height() - candleDisplay.margin * 2;
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
			rectContainer.addChild(dash);

			var priceRect = addRect(canvasWidth + 2, boxHeight - 4, candleDisplay.infowidth - 1, 10, "0xD5402B");
			rectContainer.addChild(priceRect);

			var price = addText(canvasWidth + 5, boxHeight - 4, "0x000000", "" + candle.trade_price + " KRW")
			rectContainer.addChild(price);

		}
	}
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

Template.chart.onCreated(function () {
	Meteor.subscribe("candles");
});

// UI initialization
app = null;
stage = null;
rectContainer = null;
Template.chart.onRendered(function () {
	//Create a Pixi Application
	let dims = {
		width: $("#chart").width(),
		height: $("#chart").height()
	}
	// TODO: auto resize

	app = new PIXI.Application({ width: dims.width, height: dims.height, resolution: 2, autoResize: true });

	//Add the canvas that Pixi automatically created for you to the HTML document
	$("#chart")[0].appendChild(app.view)


	stage = new PIXI.Container();
	rectContainer = new PIXI.Container();
	app.stage.addChild(rectContainer);

	// start regular rendering
	Tracker.autorun(function () {
		var lastCandle = getLastCandle(Session.get("market"));
		if (lastCandle) {
			drawCandles(lastCandle.index);
		}
	})
})

Template.chart.events({
	'click button'(event, instance) {
		drawCandles(getLastCandleIndex());
	},
});

Template.btc.helpers({
	lasttime: function () {
		var lastCandle = getLastCandle();
		if (!lastCandle) return "";
		var lastTime = new Date(lastCandle.timestamp);
		return formatDate(lastTime);
	}
})

Template.eth.helpers({
	lasttime: function () {
		var lastCandle = getLastCandle();
		if (!lastCandle) return "";
		var lastTime = new Date(lastCandle.timestamp);
		return formatDate(lastTime);
	}
})

formatDate = function (date) {
	return moment(date).format("YYYY년 MM월 DD일 HH시 mm분");
}