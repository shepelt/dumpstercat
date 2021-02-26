import { Meteor } from 'meteor/meteor';
import { fetch } from "meteor/fetch";
import { _ } from 'meteor/underscore';
import { Upbit, UpbitWs } from 'upbit-js';
import { Telegraf } from 'telegraf';
import '../imports/candles.js';
import './candlerenderer.js';
var MA = require('moving-average');
var { URL, URLSearchParams } = require('url');
var moment = require('moment');
var cryptoquantKey = process.env.CRYPTOQUANT_KEY;

var upbitKey = {
	accessKey: process.env.UPBIT_ACCESS_KEY,
	secretKey: process.env.UPBIT_SECRET_KEY
}

var markets = {
	ETH: {
		url: "http://121.165.90.98:8080/eth",
		name: "KRW-ETH"
	},
	BTC: {
		url: "http://121.165.90.98:8080/btc",
		name: "KRW-BTC"
	}
}


const upbit = new Upbit();
upbit.setAuth(upbitKey.accessKey, upbitKey.secretKey);

var btcCandleProcessor = new CandleProcessor("BTC");
var ethCandleProcessor = new CandleProcessor("ETH");

var BotChannels = new Meteor.Collection('botchannels');

function fetchCandles(count) {
	// process BTC candles
	upbit.candlesMinutes({ unit: 5, market: 'KRW-BTC', count: count, to: undefined })
		.then(candles => {
			// console.log("[ BTC ] [candles updated]")
			for (var i = candles.length - 1; i >= 0; i--) {
				btcCandleProcessor.processCandle(candles[i]);
			}
		})
		.catch(err => {
			console.error(err);
		})

	// process ETH candles
	upbit.candlesMinutes({ unit: 5, market: 'KRW-ETH', count: count, to: undefined })
		.then(candles => {
			// console.log("[ ETH ] [candles updated]")
			for (var i = candles.length - 1; i >= 0; i--) {
				ethCandleProcessor.processCandle(candles[i]);
			}
		})
		.catch(err => {
			console.error(err);
		})
}

const intervalSeconds = 1;
var bot = null;
Meteor.startup(() => {
	// ensure inddex on collections
	Candles._ensureIndex({
		market: 1,
		index: 1
	});

	// check CQ data
	if (cryptoquantKey != null) {
		Meteor.setInterval(function () {
			queryCryptoQuant();
		}, 1000 * 10); // every 10 seconds
	} else {
		console.log("[ CQ ] skipping CQ routine");
	}

	// start candle processor
	fetchCandles(1024);

	Meteor.setInterval(function () {
		fetchCandles(2);
	}, 1000 * intervalSeconds);

	// publish
	Meteor.publish('candles', function () {
		return Candles.find({}, {
			sort: { index: -1 },
			limits: 1024
		});
	});

	// startup the bot
	if (process.env.BOT_TOKEN) {
		console.log("[ BOT ] bot started")
		bot = new Telegraf(process.env.BOT_TOKEN)

		bot.start((ctx) => ctx.reply('Welcome'));
		bot.command('quit', (ctx) => {
			var fromID = ctx.update.message.from.id;
			var chatID = ctx.update.message.chat.id;
			// check admin
			console.log("checking admin")
			return ctx.getChatAdministrators().then(function (data) {
				console.log(data);
				if (_.some(data, function (user) {
					return user.user.id == fromID;
				})) {
					ctx.reply("굿바이.").then(function () {
						BotChannels.remove(chatID);
						ctx.leaveChat();
					})
				} else { }
			}).catch(console.log);
		})

		bot.command('subscribe', (ctx) => {
			var fromID = ctx.update.message.from.id;
			var chatID = ctx.update.message.chat.id;
			// check admin
			console.log("checking admin")
			return ctx.getChatAdministrators().then(function (data) {
				if (_.some(data, function (user) {
					return user.user.id == fromID;
				})) {
					ctx.reply("차트 정보 공유를 시작합니다.").then(function () {
						BotChannels.upsert(chatID, {});
					})
				} else { }
			}).catch(console.log);
		})

		bot.launch();

		process.once('SIGINT', () => bot.stop('SIGINT'))
		process.once('SIGTERM', () => bot.stop('SIGTERM'))

	}
});


function CandleProcessor(market) {
	const fiveMinuteSecs = 5 * 60 * 1000;
	const heightOutlierRatioToAverage = 0.5;

	this.market = market;
	this.maHeight = MA(fiveMinuteSecs);
	this.lastClosedCandleIndex = -1;
	this.dumpTrendCounter = 0;
	this.lastNotifiedCandle = 0;

	this.processCandle = function (candle) {
		// calculate index first
		candle.timestamp = (new Date(candle.candle_date_time_utc + "Z")).getTime();
		candle.index = timestampToIndex(candle.timestamp);

		if (this.lastClosedCandleIndex != -1 && candle.index <= this.lastClosedCandleIndex) {
			// skip processed candles
			// console.log("[", market, "]", "[skipping candle]", candle.index)
			return;
		}

		var now = (new Date()).getTime();
		var offset = now - candle.timestamp;
		if (offset < fiveMinuteSecs) {
			candle.closed = false;
		} else {
			candle.closed = true;
		}
		delete candle.candle_date_time_kst;
		delete candle.unit;

		var boxLow = candle.opening_price;
		var boxHigh = candle.trade_price;
		candle.rising = true;
		if (boxLow > boxHigh) {
			var swapTemp = boxLow;
			boxLow = boxHigh;
			boxHigh = swapTemp;
			candle.rising = false;
		}
		candle.box_low_price = boxLow;
		candle.box_high_price = boxHigh;


		if (candle.closed) {
			if (candle.index > this.lastClosedCandleIndex) {
				console.log("[", market, "]", "[updating closed candle]", candle.index);
				this.lastClosedCandleIndex = candle.index;

				// update moving average
				var boxHeight = candle.box_high_price - candle.box_low_price;
				var date = new Date(candle.timestamp);
				this.maHeight.push(date, boxHeight);
				candle.moving_average_height = this.maHeight.movingAverage();
				candle.height = boxHeight;

				// detect outliers
				var heightRatio = candle.height / candle.moving_average_height;
				if (heightRatio > heightOutlierRatioToAverage) {
					candle.height_outlier = false;
				} else {
					candle.height_outlier = true;
				}

				if (candle.height_outlier == false) {
					// process non-outlier candles for trend analysis
					if (candle.rising) {
						this.dumpTrendCounter = 0;
					} else {
						this.dumpTrendCounter++;
					}
					candle.dump_count = this.dumpTrendCounter;
				}
			}
		} else {
			// console.log("[", market, "]", "[updating open candle]", candle.index)

			// pending analysis (will be finalized when candle closed)

			// update moving average
			var boxHeight = candle.box_high_price - candle.box_low_price;
			candle.moving_average_height = this.maHeight.movingAverage(); // use existing MA value without updating
			candle.height = boxHeight;

			// detect outliers
			var heightRatio = candle.height / candle.moving_average_height;

			if (heightRatio > heightOutlierRatioToAverage) {
				candle.height_outlier = false;
			} else {
				candle.height_outlier = true;
			}

			if (candle.height_outlier == false) {
				// process non-outlier candles for trend analysis
				if (candle.rising) {
					candle.dump_count = 0;
				} else {
					candle.dump_count = this.dumpTrendCounter + 1;

					// bot injection
					var processor = this;
					var dumpCount = candle.dump_count;

					if (bot && dumpCount >= 3) {
						if (processor.lastNotifiedCandle == candle.index) {
							return; // do not notify again
						}

						// render chart on server side
						console.log("rendering serverside")
						drawCandles(candle.index, markets[processor.market].name, function (path) {
							console.log("output saved to", path);

							// notify bot
							BotChannels.find({}).forEach(function (item) {
								var channelID = item._id;
								console.log("[ BOT ] sending message to channels")
								console.log(processor);
								var message = markets[processor.market].name + "에 " + dumpCount + "연속 하락 캔들이 발생\n" + markets[processor.market].url + ""
								// upload image
								bot.telegram.sendPhoto(channelID, { source: path }, { caption: message });
							});
						});
					}
					processor.lastNotifiedCandle = candle.index;

				}
			}


		}

		Candles.upsert(candle.market + candle.timestamp, candle);
	}
}


var NotifiedBlocks = new Meteor.Collection('notifiedblocks');
var threshold = {
	netflow: 3000
}

function queryCryptoQuant() {
	console.log("[ CQ ] fetching API")
	var url = new URL('https://api.cryptoquant.com/v1/btc/exchange-flows/netflow');
	var params = {
		exchange: "all_exchange",
		window: "block",
		// limit: 64
		limit: 1000
	};
	var authKey = "Bearer " + cryptoquantKey;
	url.search = new URLSearchParams(params).toString();
	fetch(url, {
		method: 'GET',
		headers: {
			Authorization: authKey
		}
	})
		.then(res => res.json())
		.then(json => {
			if (json.status.code != 200) {
				console.log("[ CQ ] failed to fetch result", json.result);
			}
			var res = json.result;
			for (var i = res.data.length - 1; i >= 0; i--) {
				var block = res.data[i];
				block.netflow_total = parseFloat(block.netflow_total);
				block.datestring = formatDate(block.datetime);

				if (NotifiedBlocks.findOne(block.blockheight) != null) {
					continue; // skip duplicate notification
				}

				if (bot == null) {
					continue;
				}

				if (block.netflow_total >= threshold.netflow) {
					console.log("netflow over threshold");

					var message = "거래소에 급격한 비트코인 입금이 감지되었습니다\n" + "블록: " + block.blockheight + " (" + block.datestring + ")";
					// notify bot
					BotChannels.find({}).forEach(function (item) {
						var channelID = item._id;
						console.log("[ BOT ] sending message to channels")
						bot.telegram.sendMessage(channdlID, message);
					});


					NotifiedBlocks.upsert(block.blockheight, { notified: true });
				}
			}
		})
		.catch(function (err) {
			console.log("[ CQ ]", err);
		})
}

formatDate = function (date) {
	return moment.utc(date).local().format("YYYY년 MM월 DD일 HH시 mm분");
}