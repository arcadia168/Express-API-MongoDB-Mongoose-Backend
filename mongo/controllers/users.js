var mongoose = require('mongoose');
require('../models/usermodel');
var User = mongoose.model('User');

exports.addUser = function(req, res) {
  res.send('add user response');
};
exports.updateUser = function() {};
exports.getUserData = function() {};
exports.addPredictions = function() {};
exports.getPredictions = function() {};