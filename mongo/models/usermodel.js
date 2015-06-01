var mongoose = require('mongoose');
var Prediction = require('./predictionmodel');
var Schema = mongoose.Schema;
var bcrypt = require('bcryptjs');
var SALT_WORK_FACTOR = 10;

var userSchema = new Schema({
    user_id: {type: String, required: true},
    username: { type: String, required: true, index: true }, //nickname
    //email: { type: String, required: true },
    name: { type: String, required: true },
    pic: { type: String, default: 'none'}, //string url to a user picture from Auth0
    predictions: [Prediction],
    notifications: [{notificationId: String, message: String}],
    //invitations: [{ invitedBy: String, privateLeagueId: String, privateLeagueName: String}],
    overallSeasonScore: {type: Number, default: 0},
    roundScores: [{roundNo: Number, roundScore: {type : Number, default: 0}}],
    currentRoundScore: { type: Number, default: 0}
});

userSchema.pre('save', function(next) { var user = this;
    if(!user.isModified('password')) return next();
});

userSchema.methods.comparePassword = function(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    });
};

var User = mongoose.model('User', userSchema);
