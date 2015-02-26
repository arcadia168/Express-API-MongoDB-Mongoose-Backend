var mongoose = require('mongoose');
var Prediction = require('./predictionmodel');
var Schema = mongoose.Schema;
var bcrypt = require('bcryptjs');
var SALT_WORK_FACTOR = 10;

var userSchema = new Schema({
  username: { type: String, required: true, index: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  predictions: [Prediction],
  score: { type: Number, default: 0 }
});

userSchema.pre('save', function(next) { var user = this;
  if(!user.isModified('password')) return next();

  bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
    if(err) return next(err);
    
    bcrypt.hash(user.password, salt, function(err, hash) {
      if (err) return next(err);
      
      user.password = hash;
      next();
    });
  });
});

userSchema.methods.comparePassword = function(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
      if (err) return cb(err);
      cb(null, isMatch);
  });
};

var User = mongoose.model('User', userSchema);
