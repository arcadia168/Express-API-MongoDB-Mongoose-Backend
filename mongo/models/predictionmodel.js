var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var predictionSchema = new Schema({
  fixture: String,
  prediction: Number,
  predictDate: { type: Date, default: Date.now },
  predictValue: Number
});

module.exports = predictionSchema;
