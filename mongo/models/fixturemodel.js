var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var fixtureSchema = new Schema({
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    round: { type: Number, required: true },
    fixDate: { type: Date, default: Date.now },
    fixResult: { type: Number, default: 0 },
    kickOff: { type: Date}, //times to be stored as 24 hr e.g 0830, 2359
    halfTime: { type: Date},
    fullTime: { type: Date}
});

//todo: add league and season fields?

var Fixture = mongoose.model('Fixture', fixtureSchema);