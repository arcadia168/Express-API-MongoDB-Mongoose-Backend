var mongoose = require('mongoose');
var Prediction = require('./predictionmodel');
var Schema = mongoose.Schema;

var userSchema = new Schema({
  username: String,
  password: String,
  firstName: String,
  lastName: String,
  email: String,
  predictions: [Prediction],
  score: Number
});

var User = mongoose.model('User', userSchema);
