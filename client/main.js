import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { _ } from 'meteor/underscore';
import './main.html';
import '../imports/candles.js';

candleDisplay = {
  width: 5,
  margin: 0,
  spacing: 2
};

drawCandles = function (endIndex) {
  candleDisplay.endIndex = endIndex;
  candleDisplay.startIndex = endIndex - candleScreenToOrder($("#chart").width());
}

candleOrderToScreen = function (index) {
  return index * (candleDisplay.width + candleDisplay.spacing) + candleDisplay.margin;
}

candleScreenToOrder = function (x) {
  var index = Math.floor((x - candleDisplay.margin) / (candleDisplay.width + candleDisplay.spacing));
  return index;
}


Template.chart.onCreated(function helloOnCreated() {
  Meteor.subscribe("candles");
});

// UI initialization
app = null;
stage = null;
rectContainer = null;
Template.chart.onRendered(function () {
  PIXI.utils.sayHello("hello world");
  //Create a Pixi Application
  let dims = {
    width: $("#chart").width(),
    height: $("#chart").height()
  }
  // TODO: auto resize

  app = new PIXI.Application({ width: dims.width, height: dims.height });

  //Add the canvas that Pixi automatically created for you to the HTML document
  $("#chart")[0].appendChild(app.view)


  stage = new PIXI.Container();
  rectContainer = new PIXI.Container();
  app.stage.addChild(rectContainer);
})

// Template.hello.helpers({
//   counter() {
//     return Template.instance().counter.get();
//   },
// });

Template.chart.events({
  'click button'(event, instance) {
    addRect(200, 100, 10, 100, "0x9fa8a3");
  },
});

addRect = function (x, y, xd, yd, color) {
  var container = new PIXI.Container();
  var graphics = new PIXI.Graphics();
  graphics.lineStyle(0);
  graphics.beginFill(color, 1.0);
  graphics.drawRoundedRect(0, 0, xd, yd, 0);
  graphics.endFill();
  container.addChild(graphics);

  container.x = x;
  container.y = y;
  rectContainer.addChild(container);

  return container;
}