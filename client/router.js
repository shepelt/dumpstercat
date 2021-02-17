import { FlowRouter } from 'meteor/ostrio:flow-router-extra';

FlowRouter.route('/', {
    name: 'index',
    action() {
        // Render a template using Blaze
        this.render('main');
    }
});

FlowRouter.route('/btc', {
    name: 'bitcoin',
    action() {
        Session.set("market", "KRW-BTC");
        this.render('btc');
    }
});

FlowRouter.route('/eth', {
    name: 'ethereum',
    action() {
        Session.set("market", "KRW-ETH");
        this.render('eth');
    }
});

// Create 404 route (catch-all)
FlowRouter.route('*', {
    action() {
        // Show 404 error page using Blaze
        this.render('notFound');

        // Can be used with BlazeLayout,
        // and ReactLayout for React-based apps
    }
});