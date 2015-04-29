var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var fixtureSchema = new Schema({
  homeTeam: { type: String, required: true },
  awayTeam: { type: String, required: true },
  round: { type: Number, required: true },
  fixDate: { type: Date, default: Date.now },
  fixResult: { type: Number, default: 0 }
    //TODO: Add fixture time and match_id for football-api in here?
});

var Fixture = mongoose.model('Fixture', fixtureSchema);