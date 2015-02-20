var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var predictionSchema = new Schema({
  prediction: Number,
  predictDate: { type: Date, default: Date.now }
});

module.exports = predictionSchema;
