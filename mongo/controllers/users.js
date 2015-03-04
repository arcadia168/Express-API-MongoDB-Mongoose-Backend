var mongoose = require('mongoose');
var User = mongoose.model('User');
var Fixture = mongoose.model('Fixture');

exports.addUser = function(req, res) {
    User.create(req.body, function(err, user) {
        if(err) return console.log(err);
        res.jsonp(user);
    });
};

exports.getScoreboard = function(req, res) {
    User.find({}, 'username score', function(err, results) {
        res.jsonp(results);
    });
};

exports.updateUser = function(req, res) {
    var username = req.params.username;
    User.update({'username': username}, req.body, function(err, number) {
        if(err) return console.log(err);
        return res.jsonp(202);
    });
};

exports.getUserData = function(req, res) {
    var username = req.params.username;
    User.find({'username': username}, function(err, results) {
        res.jsonp(results);
    });
};

exports.addPredictions = function(req, res) {
    var username = req.params.username;
    var userExistingPredictions = []; //variable to hold all of the user's current predictions
    var predictionForFixtureExistsAlready = false;
    var ohballs = false;
    debugger;
    userExistingPredictions = User.find({'username': username}, 'predictions', function(err, results) {
        if (err) {
            return res.jsonp(400);
        }
    }); //query the db

    // first get the fixture object, assign a score to the prediction
    Fixture.find({'round':req.params.round}, 'fixDate', function(err, results) { //gets fixture by round

        if(err){
            return res.jsonp(400); //return an error if there is one.
        } else {

            var date = new Date();

            var predictions = req.body[0].predictions; //list of received predictions

            //get a list of fixtures for a given round, find the fixture on which we are making a prediction
            for(var i = 0; i < predictions.length; i++) { //iterate over each prediction recieved from user to be added

                for(var j = 0; j < results.length; j++) { //iterate over the list of fixtures for the round and date

                    var result = results[j]; //get the current fixture from results

                    if(result._id == predictions[i].fixture) { //checks to if the prediction is for the current fixture
                        // wont apply right now using test data
                        //if(!result.fixDate || result.fixDate.getTime() <= (date.getTime() + (1000*60*60)))
                        //  return res.jsonp(400);

                        //TODO: Check HERE to see if a prediction has already been made for this fixture! Set a flag
                        //DO THIS BY SEARCHING PREDICTIONS FOR THE USER, IF FIXTURE ID EXISTS WITHIN LIST, THEN A PREDICTION HAS ALREADY BEEN MADE FOR THIS ROUND

                        var predVal = allocatePoints(result.fixDate, date); //allocate prediction points based on date of prediction

                        predictions[i]["predictValue"] = predVal; //set the value in points of the prediction!

                        //get the users list of predictions

                        //ENSURE NO MORE THAN ONE PREDICTION PER FIXTURE FOR ANY USER
                        //check to see if this prediction's fixture already exists within the users list of predictions
                        //if so, PULL that predictoin out of the user's prediction array
                        //have to do this with a loop
                        for (var k = 0; k < userExistingPredictions.length; k++){
                            if (userExistingPredictions[k].fixture == predictions[i].fixture) {

                                //then the fixture trying to be predicted on already has a prediction, so delete this

                                predictionForFixtureExistsAlready = true;

                                break; //out of inner inner loop
                            }
                        }

                        //if a prediction already exists for this fixture, delete it based on fixture id query
                        if (predictionForFixtureExistsAlready) {
                            User.update({'username': username}, {$pull: {'predictions': {'fixture' : predictions[i].fixture}}},
                                {safe: true, upsert: false}, function(err, response) { if (err) ohballs = true; return } //WILL THIS AFFECT GLOBAL VARIABLE
                            );
                            predictionForFixtureExistsAlready = false; //reset the found flag on delete of old prediction
                        }

                        //push the new prediction for the fixture into the user's prediction array
                        User.update({'username': username}, { $push: {'predictions': predictions[i]}}, //upsert each prediction to the users prediction array
                            {safe: true, upsert: false}, function(err, response) { if (err) ohballs = true; return }
                                );

                        break; //out of inner loop, move on to the next prediction given to us by the user!

                    } //if

                } //inner loop, loops over fixtures for the round being predicted on

            } //outer loop, loops over newly submitted predictions

            //check to see if something went wrong or not
            if (!ohballs) {
                return res.jsonp(202);
            } else {
                return res.jsonp(502);
            }
        }

        });
};

exports.getPredictions = function(req, res) {
    var username = req.params.username;
    User.find({'username': username}, 'predictions', function(err, results) {
        res.jsonp(results);
    });
};

//dafuq does this do?
exports.updatePrediction = function(req, res) {
    var username = req.params.username; //get username from request
    Fixture.findOne({'_id':req.body[0].fixture}, 'fixDate', function(err, result) { //find specific fixure from params
        var date = new Date();
        if(result == null || typeof result == 'undefined' || typeof result.fixDate == 'undefined') // Not functional for dummy data: || result.fixDate.getTime() <= (date.getTime() + (1000*60*45)))
            return res.jsonp(400);
        req.body[0]["predictValue"] = allocatePoints(result.fixDate, date);
        req.body[0]["predictDate"] = date;
        User.findOneAndUpdate({'username': username,
                'predictions.fixture': req.body[0].fixture},
            { $set: {'predictions.$': req.body[0]}},
            {upsert : false, setDefaultsOnInsert: true, runValidators: true},
            function(err, number) {
                if(err) return console.log(err);
                return res.jsonp(202);
            });
    });
};

exports.findRoundPredictions = function(req, res) {
    var username = req.params.username;
    User.findOne({'username': username}, function(err, uRes) { //find the user
        Fixture.find({'round':req.params.round}, function(err, fRes) { //find all fixtures for the round
            res.header('Content-type','application/json');
            res.header('Charset','utf8');
            var predictions = uRes.predictions; //all of the predictions for the user
            var roundsToReturn = [];
            for(var i = 0; i < predictions.length; i++) {
                for(var j = 0; j < fRes.length; j++) {
                    var fix = fRes[j];
                    if(fix._id == predictions[i].fixture) {

                        roundsToReturn.push(predictions[i]);
                        //res.write(JSON.stringify([predictions[i]));
                        break; //break to the outer loop
                    }
                }
            }
            //now return all of the predictions
            res.write(JSON.stringify(roundsToReturn)); //append the result
            res.end();
        });
    });
}

exports.clearRoundPredictions = function(req, res) {
    var username = req.params.username;
    User.findOne({'username': username}, function(err, uRes) { //get all predictions for the user
        Fixture.find({'round':req.params.round}, function(err, fRes) { //get all fixtures for the round
            var uPred = [];
            for(var i = uRes.predictions.length-1; i >= 0; i--) { //iterate over all users predictions
                for(var j = 0; j < fRes.length; j++) { //iterate over all fixtures for round
                    if(fRes[j]._id == uRes.predictions[i].fixture) { //if matching fixture
                        //doesn't remove from db?
                        uRes.predictions.id(uRes.predictions[i]._id).remove(); //delete the fixture
                        break;
                    }
                }
            }
            uRes.save(function (err) {
                if (err) return console.log(err);
                return res.jsonp(202);
            });
        });
    });
}

function allocatePoints(fixDate, currDate) {
    if(typeof fixDate === 'undefined' || typeof currDate === 'undefined')
        return 0;
    var diffMins = ((fixDate.getTime() + (1000*60*60)) - currDate.getTime()) / 1000 / 60;
    var minsFromMid = new Date(currDate.getTime());
    minsFromMid.setHours(0);
    minsFromMid.setMinutes(0);
    minsFromMid.setSeconds(0);
    if(diffMins <= 60) {
        return 5;
    } else if(diffMins <= 1440) {
        return 6;
    } else if(diffMins <= ((currDate.getTime() - minsFromMid.getTime()) / 1000 / 60)) {
        return 9;
    } else {
        return 12;
    }
    // preSeason needs to be implemented
}

exports.clearPredictions = function(req, res) {
    User.update({}, {$pull: {'predictions': {}}}, {multi:true}, function(err, number) {
        if(err) return console.log(err);
        return res.jsonp(202);
    });
};

var examples = [{"username":"kekLord999", "password":"Iluvmum", "firstName":"Jerry", "lastName":"Springer", "email":"kekLord@gmail.com"},
    {"username":"***REMOVED***6969", "password":"Ih8craig", "firstName":"***REMOVED***", "lastName":"***REMOVED***erino", "email":"***REMOVED***lord@gmail.com"},
    {"username":"CatLadFandango", "password":"alcohol6", "firstName":"Daniel", "lastName":"Cattlin", "email":"ladladlad@lad.lad"},
    {"username":"SoElBex", "password":"IstoppedSinging", "firstName":"Sophie-Ellis", "lastName":"Bexter", "email":"IdDoMe@gmail.com"},
    {"username":"OverlordChrist", "password":"Shiva4christ", "firstName":"Jesus", "lastName":"Christ", "email":"theRedeemer@heaven.org"}];

exports.dummyData = function(req, res) {
    User.create(examples,
        function(err) {
            if(err)
                return console.log(err);
            return res.jsonp(202);
        }
    );
};

exports.wipe = function(req, res) {
    Fixture.remove({}, function(result) {
        User.remove({}, function(result) {
            return res.jsonp(result);
        });
    });
}