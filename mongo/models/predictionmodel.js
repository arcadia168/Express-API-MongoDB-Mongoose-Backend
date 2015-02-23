var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var predictionSchema = new Schema({
  fixture: { type: String, index: true },
  prediction: Number,
  predictDate: { type: Date, default: Date.now },
  predictValue: Number
});

module.exports = predictionSchema;
