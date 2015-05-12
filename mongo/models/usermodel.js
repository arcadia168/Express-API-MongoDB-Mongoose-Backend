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
    predictions: [Prediction],
    notifications: [{notificationId: String, message: String}],
    //invitations: [{ invitedBy: String, privateLeagueId: String, privateLeagueName: String}],
    score: { type: Number, default: 0 } //TODO: Add a url to a user picture! - Get this from Auth0
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
