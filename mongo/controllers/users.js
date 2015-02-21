var mongoose = require('mongoose');
require('../models/usermodel');
var User = mongoose.model('User');

exports.addUser = function(req, res) {
  User.create(req.body, function(err, user) {
    if(err) return console.log(err);
    res.send(user);
  });
};

exports.updateUser = function(req, res) {
  var username = req.params.username;
  User.update({'username': username}, req.body, function(err, number) {
    if(err) return console.log(err);
    return res.send(202);
  });
};

exports.getUserData = function(req, res) {
  var username = req.params.username;
  User.find({'username': username}, function(err, results) {
    res.send(results);
  });
};

exports.addPredictions = function(req, res) {
  var username = req.params.username;
  User.update({'username': username}, { $pushAll: {'predictions': req.body}},
    {safe: true, upsert: false},
    function(err, number) {
      if(err) return console.log(err);
      return res.send(202);
    }
  );
};

exports.getPredictions = function(req, res) {
  var username = req.params.username;
};

exports.updatePrediction = function(req, res) {
  var username = req.params.username;
};

exports.clearPredictions = function(req, res) {
  User.update({}, {$pull: {'predictions': {}}}, function(err, number) {
    if(err) return console.log(err);
    return res.send(202);
  });
};