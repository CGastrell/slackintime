var express = require("express");
var debug = require("debug")("slacktome:messages");
var config = require("config");
var monk = require("monk");
var db = monk(config.get("mongodb").url);
// var request = require('request');

module.exports = messages_module;

function messages_module(app) {
  if (!(this instanceof messages_module)) {
    return new messages_module(app);
  }
  var self = this;
  var messages = db.get("messages");
  // var jobs = db.get("agendaJobs");
  var router = express.Router();

  // Expose this.router for the lib-loader
  this.router = router;

  // Create
  router.route("/messages")
    // CREATE A MESSAGE
    .post(function(req, res) {
      self.createMessageMiddleware(req, res, messages);
    });

}

messages_module.prototype = {
  createMessageMiddleware: function createMessageMiddleware(req, res, messages) {

    var app = req.app;
    var msg = req.body;


    debug('createMessageMiddleware, msg: ' + JSON.stringify(msg));
    // Time for date creation
    msg.createdAt = new Date();

    messages.insert(msg)
    .on("error", function(err) {
      res.status(500).json(err);
    })
    .on("success", function(doc) {
      debug('Emitting new_message event. MsgId: ' + doc._id);
      app.emit("new_message", doc);

      res.status(201).redirect('/');
    });
  },

};
