var mongoose = require('mongoose');
var http = require('http');
var https = require('https');
var users = require('./users');
var _ = require('underscore'); //todo: remove if not used, reduce server load as much as possible.
var MiniSet = require('./miniset');
var Fixture = mongoose.model('Fixture');
var User = mongoose.model('User');


exports.getFixtures = function(req, res) {
    Fixture.find({}, function(err, results) {
        return res.jsonp(results);
    });

    //console.log('Getting rounds');
    //Fixture.find({}, function(err, results) {
    //    var data = JSON.parse(JSON.stringify(results));
    //
    //    console.log('Parsing fixture data ' + data + ' into rounds');
    //
    //    var newData = {rounds:[]};
    //
    //    var set = new MiniSet();
    //
    //    for(var i = 0; i < data.length; i++) {
    //
    //        var obj = data[i];
    //
    //        // if this round already exists in the list add it else make a new JSON object
    //
    //        var roundNum = Number(obj.round.toString());
    //        console.log('Now working on round number: ' + roundNum);
    //
    //        if(set.has(roundNum)) {
    //            console.log('The set already has the round ' + roundNum + ' just adding in ' + obj);
    //            // there is a fatal flaw in which we assume the rounds[number] exists in order, fix later lol
    //            newData.rounds[roundNum-1].data.push(obj);
    //        } else {
    //            var stringData = JSON.stringify(obj);
    //            console.log('Round ' + roundNum + ' did not exist, creating it now and adding in object ' + stringData);
    //            var nextData = JSON.parse("{\"round\":\""+roundNum+"\",\"data\":["+stringData+"]}");
    //            newData.rounds.push(nextData);
    //            set.add(roundNum);
    //        }
    //    }
    //
    //    console.log('Now returning to the user: ' + newData);
    //    return res.jsonp(newData);
    //});
};

exports.getRound = function(req, res) {
    var round = req.params.round;
    Fixture.find({'round': round}, function(err, result) {
        return res.jsonp(result);
    });
};

exports.getGroupedFixtures = function(req, res) {

    console.log('Getting rounds');

    Fixture.find({}).sort({ 'round' : 1}).exec(function(err, results) {

        var data = JSON.parse(JSON.stringify(results));

        console.log('Parsing sorted fixture data ' + results + ' into rounds');

        var newData = {
            rounds: []
        };
        console.log('The new data variable is: ' + JSON.stringify(newData));

        var newSet = new MiniSet();
        //console.log(newSet);

        //loop over each fixture, assign to a round
        for(var i = 0; i < data.length; i++) {

            var fixtures = data[i];

            console.log('The data should now have been sorted, and the resulting sorted fixtures are:' + JSON.stringify(fixtures));
            // if this round already exists in the list add it else make a new JSON object

            var roundNum = Number(fixtures.round.toString());
            console.log('Now working on round number: ' + roundNum);

            if(newSet.has(roundNum)) {

                console.log('The set already has the round ' + roundNum + ' just adding in ' + JSON.stringify(fixtures));

                // there is a fatal flaw in which we assume the rounds[number] exists in order, fix later lol

                console.log('Now pushing the fixture into the round ' + roundNum);
                newData.rounds[roundNum-1].data.push(fixtures);

            } else {

                var stringData = JSON.stringify(fixtures);

                console.log('Round ' + roundNum + ' did not exist, creating it now and adding in object ' + stringData);

                var nextData = JSON.parse("{\"round\":\""+roundNum+"\",\"data\":["+stringData+"]}");

                newData.rounds.push(nextData);

                newSet.add(roundNum);
            }
        }

        console.log('Now returning to the user: ' + JSON.stringify(newData));
        return res.jsonp(newData);
    });
};

//function to call to the football-api and retrieve the league table
exports.getStandings = function(req, res) {
    debugger;

    console.log("rest::getStandings");

    //set the option settings which will always be the same here
    var options = {
        host: 'football-api.com',
        path: '/api/?Action=standings&APIKey=2760810b-be47-82d7-db48d00daa1c&comp_id=1204',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    var obj = {}; //variable to hold the returned json

    http.get(options, function (res2) {
        var output = '';
        console.log(options.host + ':' + res2.statusCode);
        res2.setEncoding('utf8');

        res2.on('data', function (chunk) {
            output += chunk;
        });

        res2.on('end', function() {
            obj = JSON.parse(output);
            console.log(obj);
            return res.jsonp(obj);
        });
    });
};

exports.addFixtures = function(req, res) {
    Fixture.create(req.body, function(err, fixture) {
        if(err) return console.log(err);
        return res.jsonp(fixture);
    });
};

exports.clearFixtures = function(req, res) {
    Fixture.remove({}, function(result) {
        return res.jsonp(result);
    });
};

exports.clearRound = function() {
    var round = req.params.round;
    Fixture.remove({'round': round}, function(result){
        return res.jsonp(result);
    });
};

//TODO: ALTERNATIVELY, write method to pull these down from football-api and store all relevant details!
var examples = [
    {"homeTeam":"Arsenal", "awayTeam":"Crystal Palace","round":"1"},
    {"homeTeam":"Burnley", "awayTeam":"Chelsea", "round":"1"},
    {"homeTeam":"Leicester City", "awayTeam":"Everton", "round":"1"},
    {"homeTeam":"Liverpool", "awayTeam":"Southampton", "round":"1"},
    {"homeTeam":"Manchester United", "awayTeam":"Swansea City", "round":"1"},
    {"homeTeam":"Newcastle United", "awayTeam":"Manchester City", "round":"1"},
    {"homeTeam":"Queens Park Rangers", "awayTeam":"Everton", "round":"1"},
    {"homeTeam":"Stoke City", "awayTeam":"Aston Villa", "round":"1"},
    {"homeTeam":"West Bromwich Albion", "awayTeam":"Sunderland", "round":"1"},
    {"homeTeam":"West Ham United", "awayTeam":"Tottenham Hotspur", "round":"1"},
    {"homeTeam":"Aston Villa", "awayTeam":"Newcastle United", "round":"2"},
    {"homeTeam":"Chelsea", "awayTeam":"Leicester City", "round":"2"},
    {"homeTeam":"Crystal Palace", "awayTeam":"West Ham United", "round":"2"},
    {"homeTeam":"Everton", "awayTeam":"Arsenal", "round":"2"},
    {"homeTeam":"Hull City", "awayTeam":"Stoke City", "round":"2"},
    {"homeTeam":"Manchester City", "awayTeam":"Liverpool", "round":"2"},
    {"homeTeam":"Southampton", "awayTeam":"West Bromwich Album", "round":"2"},
    {"homeTeam":"Sunderland", "awayTeam":"Manchester United", "round":"2"},
    {"homeTeam":"Swansea City", "awayTeam":"Burnley", "round":"2"},
    {"homeTeam":"Tottenham Hotspur", "awayTeam":"Swansea City", "round":"2"},
    {"homeTeam":"Aston Villa", "awayTeam":"Hull City", "round":"3"},
    {"homeTeam":"Burnley", "awayTeam":"Manchester United", "round":"3"},
    {"homeTeam":"Everton", "awayTeam":"Chelsea", "round":"3"},
    {"homeTeam":"Leicester City", "awayTeam":"Arsenal", "round":"3"},
    {"homeTeam":"Manchester City", "awayTeam":"Stoke City", "round":"3"},
    {"homeTeam":"Newcastle United", "awayTeam":"Crystal Palace", "round":"3"},
    {"homeTeam":"Queens Park Rangers", "awayTeam":"Sunderland", "round":"3"},
    {"homeTeam":"Swansea City", "awayTeam":"West Bromwich Albion", "round":"3"},
    {"homeTeam":"Tottenham Hotspur", "awayTeam":"Liverpool", "round":"3"},
    {"homeTeam":"West Ham United", "awayTeam":"Southampton", "round":"3"},
    {"homeTeam":"Arsenal", "awayTeam":"Manchester City", "round":"4"},
    {"homeTeam":"Chelsea", "awayTeam":"Swansea City", "round":"4"},
    {"homeTeam":"Crystal Palace", "awayTeam":"Burnley", "round":"4"},
    {"homeTeam":"Hull City", "awayTeam":"West Ham United", "round":"4"},
    {"homeTeam":"Liverpool", "awayTeam":"Aston Villa", "round":"4"},
    {"homeTeam":"Manchester United", "awayTeam":"Queens Park Rangers", "round":"4"},
    {"homeTeam":"Southampton", "awayTeam":"Newcastle United", "round":"4"},
    {"homeTeam":"Stoke City", "awayTeam":"Leicester City", "round":"4"},
    {"homeTeam":"Sunderland", "awayTeam":"Tottenham Hotspur", "round":"4"},
    {"homeTeam":"West Bromwich Albion", "awayTeam":"Everton", "round":"4"},
    {"homeTeam":"Aston Villa", "awayTeam":"Arsenal", "round":"5"},
    {"homeTeam":"Burnley", "awayTeam":"Sunderland", "round":"5"},
    {"homeTeam":"Everton", "awayTeam":"Crystal Palace", "round":"5"},
    {"homeTeam":"Leicester City", "awayTeam":"Manchester United", "round":"5"},
    {"homeTeam":"Manchester City", "awayTeam":"Chelsea", "round":"5"},
    {"homeTeam":"Newcastle United", "awayTeam":"Hull City", "round":"5"},
    {"homeTeam":"Queens Park Rangers", "awayTeam":"Stoke City", "round":"5"},
    {"homeTeam":"Swansea City", "awayTeam":"Southampton", "round":"5"},
    {"homeTeam":"Tottenham Hotspur", "awayTeam":"West Bromwich Albion", "round":"5"},
    {"homeTeam":"West Ham United", "awayTeam":"Liverpool", "round":"5"},
    {"homeTeam":"Arsenal", "awayTeam":"Tottenham Hotspur", "round":"6"},
    {"homeTeam":"Chelsea", "awayTeam":"Aston Villa", "round":"6"},
    {"homeTeam":"Crystal Palace", "awayTeam":"Leicester City", "round":"6"},
    {"homeTeam":"Hull City", "awayTeam":"Manchester City", "round":"6"},
    {"homeTeam":"Liverpool", "awayTeam":"Everton", "round":"6"}
];

//this must come after examples, I think
exports.dummyData = function(req, res) {
    Fixture.create(examples,
        function(err) {
            if(err)
                return console.log(err);
            return res.jsonp(202);
        }
    );
};

//delte this function once testing is complete
exports.testGetResultThenScore = function (req, res) {

    //now set the the mongo id of this fixture
    //to test whole thing make this a fixture which users have predicted - so they'll get a score
    var id = mongoose.Types.ObjectId("5530f4edde6582f3038bb73b");
    console.log("Fake document id is: " + id);

    var fixture = {
        _id: id,
        fixDate: new Date(2015, 03, 26), //the month is 0 indexed
        fixResult: 0,
        homeTeam: "Everton",
        awayTeam: "Manchester United"
    };

    console.log("The string value of the fixDate is: " + _formattedDate(fixture.fixDate));

    //now invoke the function and pass in this fixture object
    //pass object in as json
    //TODO: evaulate if the callback is necessary?
    //TODO: SCHEDULE THIS TO GET RUN FOR EACH FIXTURE, AT THE END OF THE MATCH...
    getFixtureResult(JSON.stringify(fixture), function () {
        res.jsonp('THE USERS WHO PREDICTED FOR THIS FIXTURE WERE GIVEN SCORES BASED OFF OF LIVE RESULTS!!!')
    });

    //return res.jsonp(202);
};

//PRIVATE FUNCTIONS

//this function will be sheduled to run for each fixture.
//function to take a local fixture and retrieve the live result from 3rd party football-api
//once this has been tested, pass in a callback and test it upon success.
function getFixtureResult(fixture, callback) {

    //TODO: implement date validation here that the fixture occurred in the past

    console.log("Now attempting to get the live result for the fixture: " + fixture);

    //1. Query the API to get matches on the given fixture date

    //parse the date into an object
    console.log("Now parsing the fixture into an object.");
    var fixture = JSON.parse(fixture);

    console.log("Now contacting 3rd party API football-api to get real-world fixture data.");

    var fixtureDate = _formattedDate(fixture.fixDate); //TODO: Need to parse this date into dd.mm.yyyy from js date
    console.log("The formatted date being sent in the API query is: " + fixtureDate);

    var options = {
        host: 'football-api.com',
        path: '/api/?Action=fixtures&APIKey=2760810b-be47-82d7-db48d00daa1c&comp_id=1204&match_date=' + fixtureDate,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    var obj = {}; //variable to hold the returned json

    //make the call to the football-api API
    http.get(options, function (response) {

        var output = '';

        console.log(options.host + ':' + response.statusCode);
        response.setEncoding('utf8');

        response.on('data', function (chunk) {
            output += chunk;
        });

        response.on('end', function () {
            obj = JSON.parse(output);
            console.log("Results returned from server: " + JSON.stringify(obj));

            var fixDateFixtures = obj.matches;

            //this can only happen once the call to the api has finished

            console.log("The fixtures taking place on the given date: " + fixtureDate + " are: \n" + fixDateFixtures);

            //2. Now filter out the relevant fixture using the date and the teams of our local fixture

            //loop through the array of objects, inspecting the properties match_localteam_name, match_visitorteam_name
            var fixFound = false;

            var localFixResult = null;

            console.log("Now attempting to loop over the matches on the given day and select relevant one.");
            for (var i = 0; i < fixDateFixtures.length; i++) {
                //compare api fixture properties to our own


                //place current fixture into variable to reduce number of reads
                var currentAPIFixture = fixDateFixtures[i];

                console.log("Now attempting to compare the fixture from the api: \n API home team name: " +
                    currentAPIFixture.match_localteam_name + " to local home team name: " + fixture.homeTeam
                    + "\n API away team name: " + currentAPIFixture.match_visitorteam_name + " to local away team name "
                    + fixture.awayTeam);

                if ((currentAPIFixture.match_localteam_name == fixture.homeTeam) && (currentAPIFixture.match_visitorteam_name == fixture.awayTeam)) {
                    //then this is the fixture of which we want to process the result.

                    //3. Now assign the result of the match to our fixture and put in appropriate format.

                    //set the found flag to active
                    fixFound = true;

                    //extract the result and put into usable form
                    var tempAPIResult = currentAPIFixture.match_ft_score;
                    console.log("The result of the relelvant fixture from the football-api.com API is: " + tempAPIResult);

                    var homeTeamResult = tempAPIResult.charAt(1);
                    var awayTeamResult = tempAPIResult.charAt(3);
                    console.log("The home team " + currentAPIFixture.match_localteam_name + " result is: " + homeTeamResult);
                    console.log("The away team " + currentAPIFixture.match_visitorteam_name + " result is: " + awayTeamResult);

                    //Now process this result into a usable format for our server (1, 2 or 3)
                    //1 = home win, 2 = away win, 3 = draw
                    if (homeTeamResult > awayTeamResult) {
                        //then this was a home win
                        localFixResult = 1;
                        console.log("The match " + fixture._id + " was a home win. Won by " + fixture.homeTeam);
                    } else if (homeTeamResult < awayTeamResult) {
                        //then this was an away win
                        localFixResult = 2;
                        console.log("The match " + fixture._id + " was an away win. Won by " + fixture.awayTeam);
                    } else if (homeTeamResult == awayTeamResult) {
                        //then this was a draw
                        console.log("The match " + fixture._id + " was a draw.");
                    }

                    //4. Now save the result to our fixture.
                    fixture.fixResult = localFixResult;

                    console.log("Now attempting to update the fixture with the obtained result");
                    //Now run a mongoose update
                    //TODO: Test this using simply {"_id" : fixture._id} also - more elegant
                    Fixture.update({"_id": fixture._id}, {fixResult: localFixResult}, function (err) {

                        //if there is an error, simply return straight back to the user
                        if (err) return console.log("An error occurred: " + err);

                        //fixture should now have been given the correct result
                        console.log("The fixture with id: " + fixture.id + " has now been given the live result");

                        /*TODO: MOVE ALL return statements out of server logic so that they immediately return to frontend and leave the server running
                         the only times this shouldn't happen is when returning an error message, use a condition to achieve this!*/

                        //once the fixture has been updated, invoke the callback function
                        console.log("The fixture has successfully been given the correct result, invoking callback");
                        //comment this out whilst testing main function, implement afterwards.
                        _scheduleScoreFilteredUsers(fixture, callback);

                    });
                }
            }

            if (!fixFound) {
                return "No live results found for this fixture.";
            }
        });
    });
}

//small function for conveniently reformatting a date
function _formattedDate(date) {
    var d = new Date(date || Date.now()),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [day, month, year].join('.');
}

//find all users who made a prediction on a given fixture
//similar to the above function but only takes in a single fixture
function _scheduleScoreFilteredUsers(fixture, callback) {

    //This should only return users who have made a prediction for the given fixture
    User.find({'predictions.fixture': fixture._id}, function (error, users) {

        //for testing
        console.log("The number of returned users is: " + users.length);
        console.log("The users returned are: " + JSON.stringify(users));

        //invokes the score adder function passing in all users who are to be scored, and all fixtures
        _scoreAdder(0, users, fixture, function () {
            //feeds the callback method into the scoreadder method
            callback(null, 202); //this is fed in from the highest level
        });

    });
}

//used to recursively give all users who predicted an a given fixture a score when the result is determined
function _scoreAdder(i, users, fixture, callback) {
    if (i < users.length) {
        //place the current user's predictions into an array
        var preds = users[i].predictions;

        //get the current value of the user's score
        var score = users[i].score;

        //for each user, loop over all of the user's predictions and compare to current fixture
        for (var j = 0; j < preds.length; j++) {

            //if the user made a prediction for this fixture.
            //if the prediction was made for the current fixture
            if (preds[j].fixture == fixture._id) {

                //is this method of scoring correct? yes, if correct get a varying score, if wrong, get nothing
                //if the prediction was correct, update the user's score!
                if (preds[j].prediction == fixture.fixResult) {
                    score += preds[j].predictValue;
                }
            }
        }


        //if the score has been updated
        if (score != users[i].score) {
            //then save the change made to the user's score and recurse, scoring the next user
            User.findByIdAndUpdate(users[i]._id, {$set: {'score': score}}, function () {
                //recurse, scoring the next user
                _scoreAdder(i + 1, users, fixture, callback);
            });
        } else {
            //recurse without saving, scoring the next user
            _scoreAdder(i + 1, users, fixture, callback);
        }

    } else {
        //if the recursion should have ended as all user's given scores, run the callback.
        callback();
    }
}
