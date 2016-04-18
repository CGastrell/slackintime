var config = require("config");
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var basicAuth = require('basic-auth');
var debug = require("debug")("slacktome:app.js");
// var crash2slack = require("crash-to-slack");

// var agendaUI = require('agendash');
/**
 * Log all uncaught exceptions to Talktome Slack channel
 */
// crash2slack(config.get("crash2slack"));

var routes = require('./routes/index');

//weird routes, overwritting the routes/index ???
// var routes = require('./routes/phonenumber-compare.js');
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));


//quick basic auth
var auth = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Totoro');
    return res.send(401);
  }

  var user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  }

  if (user.name === config.get('auth').user && user.pass === config.get('auth').pass) {
    return next();
  } else {
    return unauthorized(res);
  }
};


app.use('/', auth, routes);

app.use('/logout', function(req, res, next){
  res.set('WWW-Authenticate', 'Basic realm=Totoro');
  return res.send(401);
});


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// app.apiRouter = express.Router();

require('./lib/scheduler')(app);

var messagesModule = require('./lib/messages')(app);
app.use('/', messagesModule.router);

// app.use('/agenda', agendaUI(app.scheduler.agenda, {poll: 30000}));

// app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//loader = require("./lib/core-lib-loader")(app);
// loader = require("my-express-module-loader")(app);

// app.use("/", app.apiRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    debug("Express error handler for development env caught: %j", err.stack);
    res.json({
      status: err.status,
      err: err.stack
    });
    // res.render('error', {
    //  message: err.message,
    //  error: err
    // });
  });
}

// production error handler
// no stacktraces leaked to user
// app.use(function(err, req, res, next) {
// 		res.status(err.status || 500);
// 		res.render('error', {
// 				message: err.message,
// 				error: {}
// 		});
// });

module.exports = app;
