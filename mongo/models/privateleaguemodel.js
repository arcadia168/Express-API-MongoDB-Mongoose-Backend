/**
 * Created by ***REMOVED*** on 19/04/15.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

//A private league is simply a collection of user_ids for which to display scores.
var privateLeagueSchema = new Schema({
    privateLeagueId: { type: ObjectId},
    privateLeagueName: { type: String},
    privateLeagueCode: { type: String},
    creator: { type: String, index: true},
    members: [{ user_id: String, username: String, score: Number, status: String}], //todo: include pic url?
    dateCreated: { type: Date, default: Date.now }
});

var PrivateLeague = mongoose.model('PrivateLeague', privateLeagueSchema);