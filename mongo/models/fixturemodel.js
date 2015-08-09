var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var fixtureSchema = new Schema({
    homeTeam: {type: String, required: true},
    homeTeamPos: {type: String},
    homeTeamForm: {type: String},
    homeTeamHtScore:{type: Number},
    homeTeamFtScore:{type: Number},
    awayTeam: {type: String, required: true},
    awayTeamPos:{type: String},
    awayTeamForm: {type: String},
    awayTeamHtScore:{type: Number},
    awayTeamFtScore:{type: Number},
    fixStadium: {type: String},
    fixSocial: {type: String},
    round: {type: Number, required: true},
    fixDate: {type: Date, default: Date.now},
    fixResult: {fixResult: Number, fixScore: String},
    fixtureFacts: [{type: String}],
    fixHalfTimeResult: {fixResult: Number, fixScore: String},
    kickOff: {type: Date}, //times to be stored as 24 hr e.g 0830, 2359
    halfTime: {type: Date},
    fullTime: {type: Date}
});

//todo: add league and season fields?

var Fixture = mongoose.model('Fixture', fixtureSchema);
