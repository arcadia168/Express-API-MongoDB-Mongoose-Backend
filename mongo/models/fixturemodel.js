var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var fixtureSchema = new Schema({
  homeTeam: String,
  awayTeam: String,
  round: Number,
  fixDate: { type: Date, default: Date.now },
  fixResult: Number
});

var Fixture = mongoose.model('Fixture', fixtureSchema);