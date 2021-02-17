addHorizontalLine = function (y, width, linethickness, linecolor, alpha) {
    var container = new PIXI.Container();
    var graphics = new PIXI.Graphics();
    graphics.lineStyle(linethickness, linecolor, alpha);


    var dashWidth = 10;
    var dashOn = true;
    for (var xOffset = 0; xOffset < width; xOffset += dashWidth) {
        if (dashOn) {
            graphics.moveTo(xOffset, y);
            graphics.lineTo(xOffset + dashWidth / 2, y);
        } else {
            dashOn = false;
        }
    }
    container.addChild(graphics);

    container.x = 0;
    container.y = 0;

    return container;
}

addRect = function (x, y, xd, yd, color, alpha, text, textcolor) {
    if (alpha == undefined) {
        alpha = 1.0;
    }
    var container = new PIXI.Container();
    var graphics = new PIXI.Graphics();
    graphics.lineStyle(0);
    graphics.beginFill(color, alpha);
    graphics.drawRoundedRect(0, 0, xd, yd, 0);
    graphics.endFill();
    container.addChild(graphics);

    if (text) {
        var textObj = new PIXI.Text(text, {
            fontSize: 8,
            "fill": textcolor
        });

        // setting the anchor point to 0.5 will center align the text... great for spinning!
        textObj.anchor.set(0.5);
        textObj.x = xd / 2 + 1;
        textObj.y = yd - 8;
        container.addChild(textObj);
    }

    container.x = x;
    container.y = y;
    rectContainer.addChild(container);

    return container;
}

addText = function (x, y, color, text) {
    var container = new PIXI.Container();
    var textObj = new PIXI.Text(text, {
        fontSize: 8,
        "fill": "white"
    });
    textObj.anchor.set(0);
    textObj.x = 0;
    textObj.y = 0
    container.addChild(textObj);
    container.x = x;
    container.y = y;

    return container;
}