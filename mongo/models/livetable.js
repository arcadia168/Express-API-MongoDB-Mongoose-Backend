var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var leagPosSchema = new Schema({

    leagPos : {type: Number, required:  true},
    teamLong : {type: String, required:  true},
    teamShort : {type: String, required:  true},
    gamesHW : {type: Number},
    gamesHD : {type: Number},
    gamesHL : {type: Number},
    gamesAW : {type: Number},
    gamesAD : {type: Number},
    gamesAL : {type: Number},
    gamesPlayed : {type: Number, required:  true},
    gamesWon : {type: Number, required:  true},
    gamesDrawn : {type: Number, required:  true},
    gamesLose : {type: Number, required:  true},
    goalsForHome : {type: Number},
    goalsForAway : {type: Number},
    goalsFor : {type: Number},
    goalsAgaHome : {type: Number},
    goalsAgaAway : {type: Number},
    goalsAway : {type: Number},
    goalDif : {type: Number},
    points : {type: Number, required:  true},

    //todo: add type of league and season

  var LiveTable = mongoose.model('LiveTable', leagPosSchema);
