var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var predictionSchema = new Schema({
  fixture: { type: String, index: true, required: true },
  prediction: { type: Number, required: true },
  predictDate: { type: Date, default: Date.now },
  predictValue: [{ correctPoints: Number, incorrectPoints: Number }]
});

module.exports = predictionSchema;
