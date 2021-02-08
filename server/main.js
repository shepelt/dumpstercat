import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';
import { Upbit, UpbitWs } from 'upbit-js';

import '../imports/candles.js';

const upbit = new Upbit();

const intervalSeconds = 10;
Meteor.startup(() => {
	// ensure inddex on collections
	Candles._ensureIndex({
		market: 1,
		index: 1
	});

	fetchCandles(1024);
	setInterval(function () {
		fetchCandles(5);
	}, 1000 * intervalSeconds);
});


function fetchCandles(count) {
	upbit.candlesMinutes({ unit: 5, market: 'KRW-BTC', count: count, to: undefined })
		.then(value => {
			console.log("[candles updated]")
			_.each(value, processCandle);
		})
		.catch(err => {
			console.error(err);
		})
}

const fiveMinuteSecs = 5 * 60 * 1000;

function processCandle(candle) {
	candle.timestamp = (new Date(candle.candle_date_time_utc + "Z")).getTime();
	candle.index = timestampToIndex(candle.timestamp);
	var now = (new Date()).getTime();
	var offset = now - candle.timestamp;
	if (offset < fiveMinuteSecs) {
		candle.closed = false;
	} else {
		candle.closed = true;
	}
	delete candle.candle_date_time_kst;
	delete candle.unit;

	if (candle.closed == false) { console.log(candle); }
	Candles.upsert(candle.market + candle.timestamp, candle);
}