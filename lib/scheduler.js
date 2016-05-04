var agenda = require("agenda");
var format = require("util").format;
var config = require("config");
var debug = require("debug")("slacktome:scheduler");

var monk = require("monk");
var db = monk(config.get("mongodb").url);
var request = require('request');

module.exports = scheduler_module;

function scheduler_module(app) {
  if (!(this instanceof scheduler_module)) {
    return new scheduler_module(app);
  }


  var messages = db.get("messages");
  var _this = this;
  app.scheduler = this;

  this.app = app;
  this.agenda = new agenda({
    defaultConcurrency: 50,
    maxConcurrency: 200,
    db: {
      address: config.get("mongodb").url
    }
  });

  function ignoreErrors() {}

  this.agenda._db.ensureIndex("nextRunAt", ignoreErrors)
    .ensureIndex("lockedAt", ignoreErrors)
    .ensureIndex("name", ignoreErrors)
    .ensureIndex("priority", ignoreErrors);

  // Define the job
  this.agenda.define("scheduled_message", function(job, done) {
    debug('Called scheduled_message job');
    _this.scheduledMessageProcessor(app, job, done, messages);
  });

  this.agenda.start();
  this.agenda.on('start', function(job) {
    debug("Message job %s starting", job.attrs.name);
  });
  this.agenda.on('error', function(err, job) {
    debug('Agenda Error');
    debug("Message job %s failed with: %j", job.name, err.stack);
  });
  this.agenda.on('fail', function(err, job) {
    debug("Message job %s failed with: %j", job.name, err.stack);
  });
  // Listen the event emitted when a new message is created on the DB.
  app.on("new_message", function(message) {
    debug('Called event new_message');
    _this.scheduleMessage(message);
  });

  // Unlock agenda events when process finishes
  function graceful() {
    _this.agenda.stop(function() {});
    process.exit(0);
  }

  process.on('SIGTERM', graceful);
  process.on('SIGINT', graceful);
}



scheduler_module.prototype = {
  /**
   * schedules a message
   * @param {Object} msg. A message document from the DB.
   */
  scheduleMessage: function(msg) {
    debug('scheduleMessage');
    debug(msg);

    // var starting_date = new Date(msg.timedate);
    // mongodb document's ._id comes as an object, so I must cast it to string
    // for it to be a valid job name
    this.schedule(msg.timedate, "scheduled_message", msg);
    // this.schedule(starting_date, msg._id.toString(), msg)
  },
  /**
   * Schedules a message job for its starting date and parsing its properties
   * accounting for frequency settings
   * @param {Date} starting. First date/time on which the message job should be triggered
   * @param {String} jobName. The job name that the `agenda` module requires.  I'm using
   * @param {Object} message. A message document from the DB.
   * @param {String} [Optional] interval. A human-interval string. If not passed,
   * the interval is parsed from the message properties
   */
  schedule: function(starting, jobName, message, interval) {
    var _this = this;
    var app = this.app;

    var job = this.agenda.create(jobName, message);

    // If there are no week days specified, then make this
    // job be the one that repeats.
    job.schedule(starting);
    debug("job.schedule %s", starting);
    // if (interval) {
    //   debug("repeatEvery %s", interval);
    //   job.repeatEvery(interval);
    // }
    job.save();

  },
  scheduledMessageProcessor: function(app, job, done, messages) {
    var self = this;
    debug('Called job processor scheduledMessageProcessor');

    var messageId = job.attrs.data._id;
    var jobName = job.attrs.name;

    // Message object passed to alert, does not contain all data. Refresing data
    var messageList = db.get("messages");
    if(!messageList) {
        debug('Could not get messages from database. MessageId %s push will not be sent! ', messageId);
    } else {
      // Get item
      messageList.findOne({ _id: messageId }, function(msgErr, msgDoc) {
        if(msgErr) {
          debug('Error on getting messageId %s: %s', messageId, JSON.stringify(msgErr));
        } else if(msgDoc !== null) {
          //success
          debug("MessageId %s delivery.", msgDoc._id);
          var webHookUrl = config.get('slack').webHookUrl;
          var payloadObject = {
            channel: msgDoc.destination,
            text: msgDoc.msg,
            username: "Totoro",
            icon_url: msgDoc.icon_url || config.get('site').baseUrl + config.get('slack').defaultIconUrl
          };
          var payload = 'payload='+JSON.stringify(payloadObject);
          request.post({ url: webHookUrl, form: payload }, function(err, res, body){
            if(err) {
              debug('Request error');
              debug(err);
            }
            debug('Slack Message delivered');
          });

        } else {
          debug( "MessageId %s not found!", job.attrs.data._id);
        }

        done();
      });
    }
  }

};
