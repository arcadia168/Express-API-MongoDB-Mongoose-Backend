var mongoose = require('mongoose');
var http = require('http');
var https = require('https');
var users = require('./users');
var Agenda = require('agenda');
var moment = require('moment');
var Q = require('q');
var underscore = require('underscore');
var MiniSet = require('./miniset');
var Fixture = mongoose.model('Fixture');
var User = mongoose.model('User');
var IPADDRESS = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var mongoConnection = 'mongodb://'+IPADDRESS+'/nodejs';
if (!process.env.OPENSHIFT_MONGODB_DB_PASSWORD) {
    console.log("RUNNING SERVER LOCALLY, MONGO CONNECTION STRING IS: " + mongoConnection);
} else {
    mongoConnection = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
        process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
        process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
        process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
        process.env.OPENSHIFT_APP_NAME;

    console.log("RUNNING SERVER ON OPENSHIFT, MONGO CONNECTION STRING IS: " + mongoConnection);
}

var agenda = new Agenda({db: { address: mongoConnection}}); //instantiate agenda

//fire up the scheduler
agenda.start();

//define any agenda jobs that are to be scheduled here
//define the job to be run for each fixture
agenda.define('score fixture predictors', function(job, done) {
    //retrieve data from parameters
    var data = job.attrs.data;

    //invoke the private function to retrieve users who made predictions on this fixture, and give them scores
    //fixture should be being passed in as JSON, no need to parse.
    _getFixtureResult(data.fixture, function (done) { //let's get recursive... BITCCHHEEEESSSS
        done(); //fire event to tell agenda job that this job has finished running
        console.log('THE USERS WHO PREDICTED FOR THIS FIXTURE WERE GIVEN SCORES BASED OFF OF LIVE RESULTS!!!')
    });
});

//the scheduled job to check for new and updated fixtures every day
agenda.define('get new and update existing fixtures', function(job, done){
    //retrieve data from parameters
    var data = job.attrs.data;

    //call function to check for any new fixtures and update the existing ones
    _getNewUpdateExistingFixtures();

    done();
});

//Put any global scheduled events in here
// FOR TESTING
//agenda.schedule('in 5 seconds', 'get new and update existing fixtures');

agenda.every('day', 'get new and update existing fixtures');

exports.getFixtures = function(req, res) {
    Fixture.find({}, function(err, results) {
        return res.jsonp(results);
    });
};

exports.getRound = function(req, res) {
    var round = req.params.round;
    Fixture.find({'round': round}, function(err, result) {
        return res.jsonp(result);
    });
};

exports.getGroupedFixtures = function(req, res) {

    //console.log('Getting rounds');

    Fixture.find({}).sort({ 'round' : -1 }).exec(function(err, results) {

        var data = JSON.parse(JSON.stringify(results));

        //console.log('Parsing sorted fixture data ' + results + ' into rounds');

        var newData = {
            rounds: []
        };

        //console.log('The new data variable is: ' + JSON.stringify(newData));

        var newSet = new MiniSet();
        //console.log(newSet);

        //console.log('The data should now have been sorted, and the resulting sorted fixtures are:' + JSON.stringify(fixture));
        // if this round already exists in the list add it else make a new JSON object

        //loop over each fixture, assign to a round
        for(var i = 0; i < data.length; i++) {

            //console.log("ITERATION " + (i + 1) + " OF " + (data.length - 1));
            //console.log("FOR THIS ITERATION THE NEW SET BEGINS AS: \t" + JSON.stringify(newSet));

            var fixture = data[i];
            //console.log("The value of the data[i] variable is: " + JSON.stringify(fixture));

            var roundNum = Number(fixture.round.toString());

            //console.log('Now working on round number: ' + roundNum);
            //console.log("Does the newSet variable already contain the round number?:\t " + newSet.has(roundNum));

            if(newSet.has(roundNum)) {

                //console.log('The set already has the round ' + roundNum + ' just adding in ' + JSON.stringify(fixture));

                // there is a fatal flaw in which we assume the rounds[number] exists in order, fix later lol

                //console.log('Now pushing the fixture into the round ' + roundNum);
                //console.log(JSON.stringify(newData));

                //trying to find round using array index instead of key/value pair!!!
                //use underscore to do this?
                //where the round = roundNum, add in this fixture.
                //do with utility function or look for it with a for loop.
                for (var j = 0; j < newData.rounds.length; j++){
                    if (newData.rounds[j].round == roundNum) {
                        newData.rounds[j].data.push(fixture);
                    }
                }

            } else {

                //console.log('Round ' + roundNum + ' did not exist, creating it now and adding in object ' + JSON.stringify(fixture));

                var nextData = {
                    round: roundNum,
                    data : []
                };
                //console.log("Adding a round object to array of rounds: " + JSON.stringify(nextData));

                nextData.data.push(fixture);
                //console.log("Added the first fixture to this round: " + JSON.stringify(nextData.data));

                newData.rounds.push(nextData);
                //console.log("Now added this round to the newdata rounds object array");

                //adding this round to the set used to keep track of rounds
                newSet.add(roundNum);
            }
        }

        //console.log('Now returning to the user: ' + JSON.stringify(newData));
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

//API TESTING FUNCTIONS - todo: DELETE ON RELEASE

//delte this function once testing is complete
exports.testGetResultThenScore = function (req, res) {

    //now set the the mongo id of this fixture
    //to test whole thing make this a fixture which users have predicted - so they'll get a score
    var id = mongoose.Types.ObjectId("5530f4edde6582f3038bb73b");
    console.log("Fake document id is: " + id);

    var fixture = {
        _id: id,
        fixDate: new Date(2015, 3, 26), //the month is 0 indexed
        fixResult: 0,
        homeTeam: "Everton",
        awayTeam: "Manchester United"
    };

    console.log("The string value of the fixDate is: " + _formattedDate(fixture.fixDate));

    //now invoke the function and pass in this fixture object
    //pass object in as json
    //TODO: evaulate if the callback is necessary?
    //TODO: SCHEDULE THIS TO GET RUN FOR EACH FIXTURE, AT THE END OF THE MATCH...
    _getFixtureResult(JSON.stringify(fixture), function () {
        res.jsonp('THE USERS WHO PREDICTED FOR THIS FIXTURE WERE GIVEN SCORES BASED OFF OF LIVE RESULTS!!!')
    });

    //return res.jsonp(202);
};

examples = [{"homeTeam":"Arsenal","awayTeam":"Crystal Palace","fixStadium":"Emirates Stadium","round":1,"fixDate":"2014-08-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-18T15:00:00.000Z","halfTime":"2014-08-18T15:45:00.000Z","fullTime":"2014-08-18T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Chelsea","fixStadium":"Turf Moore","round":1,"fixDate":"2014-08-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-18T15:00:00.000Z","halfTime":"2014-08-18T15:45:00.000Z","fullTime":"2014-08-18T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Everton","fixStadium":"King Power Stadium","round":1,"fixDate":"2014-08-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-18T15:00:00.000Z","halfTime":"2014-08-18T15:45:00.000Z","fullTime":"2014-08-18T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Southampton","fixStadium":"Anfield","round":1,"fixDate":"2014-08-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-18T15:00:00.000Z","halfTime":"2014-08-18T15:45:00.000Z","fullTime":"2014-08-18T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Swansea City","fixStadium":"Old Trafford","round":1,"fixDate":"2014-08-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-18T15:00:00.000Z","halfTime":"2014-08-18T15:45:00.000Z","fullTime":"2014-08-18T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Manchester City","fixStadium":"St James' Park","round":1,"fixDate":"2014-08-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-18T15:00:00.000Z","halfTime":"2014-08-18T15:45:00.000Z","fullTime":"2014-08-18T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Hull City","fixStadium":"Loftus Road","round":1,"fixDate":"2014-08-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-18T15:00:00.000Z","halfTime":"2014-08-18T15:45:00.000Z","fullTime":"2014-08-18T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Aston Villa","fixStadium":"Britannia Stadium","round":1,"fixDate":"2014-08-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-18T15:00:00.000Z","halfTime":"2014-08-18T15:45:00.000Z","fullTime":"2014-08-18T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Sunderland","fixStadium":"The Hawthorns","round":1,"fixDate":"2014-08-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-18T15:00:00.000Z","halfTime":"2014-08-18T15:45:00.000Z","fullTime":"2014-08-18T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Tottenham Hotspur","fixStadium":"Boleyn Ground","round":1,"fixDate":"2014-08-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-18T15:00:00.000Z","halfTime":"2014-08-18T15:45:00.000Z","fullTime":"2014-08-18T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Newcastle United","fixStadium":"Villa Park","round":2,"fixDate":"2014-08-23T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-23T15:00:00.000Z","halfTime":"2014-08-23T15:45:00.000Z","fullTime":"2014-08-23T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Leicester City","fixStadium":"Stamford Bridge","round":2,"fixDate":"2014-08-23T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-23T15:00:00.000Z","halfTime":"2014-08-23T15:45:00.000Z","fullTime":"2014-08-23T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"West Ham United","fixStadium":"Selhurst Park","round":2,"fixDate":"2014-08-23T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-23T15:00:00.000Z","halfTime":"2014-08-23T15:45:00.000Z","fullTime":"2014-08-23T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Arsenal","fixStadium":"Goodison Park","round":2,"fixDate":"2014-08-23T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-23T15:00:00.000Z","halfTime":"2014-08-23T15:45:00.000Z","fullTime":"2014-08-23T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Stoke City","fixStadium":"KC Stadium","round":2,"fixDate":"2014-08-23T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-23T15:00:00.000Z","halfTime":"2014-08-23T15:45:00.000Z","fullTime":"2014-08-23T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Liverpool","fixStadium":"Eithad Stadium","round":2,"fixDate":"2014-08-23T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-23T15:00:00.000Z","halfTime":"2014-08-23T15:45:00.000Z","fullTime":"2014-08-23T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"West Bromwich Albion","fixStadium":"St Mary's Stadium","round":2,"fixDate":"2014-08-23T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-23T15:00:00.000Z","halfTime":"2014-08-23T15:45:00.000Z","fullTime":"2014-08-23T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Manchester United","fixStadium":"Stadium of Light","round":2,"fixDate":"2014-08-23T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-23T15:00:00.000Z","halfTime":"2014-08-23T15:45:00.000Z","fullTime":"2014-08-23T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Burnley","fixStadium":"Liberty Stadium","round":2,"fixDate":"2014-08-23T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-23T15:00:00.000Z","halfTime":"2014-08-23T15:45:00.000Z","fullTime":"2014-08-23T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Queens Park Rangers","fixStadium":"White Hart Lane","round":2,"fixDate":"2014-08-23T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-23T15:00:00.000Z","halfTime":"2014-08-23T15:45:00.000Z","fullTime":"2014-08-23T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Hull City","fixStadium":"Villa Park","round":3,"fixDate":"2014-08-30T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-30T15:00:00.000Z","halfTime":"2014-08-30T15:45:00.000Z","fullTime":"2014-08-30T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Manchester United","fixStadium":"Turf Moore","round":3,"fixDate":"2014-08-30T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-30T15:00:00.000Z","halfTime":"2014-08-30T15:45:00.000Z","fullTime":"2014-08-30T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Chelsea","fixStadium":"Goodison Park","round":3,"fixDate":"2014-08-30T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-30T15:00:00.000Z","halfTime":"2014-08-30T15:45:00.000Z","fullTime":"2014-08-30T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Arsenal","fixStadium":"King Power Stadium","round":3,"fixDate":"2014-08-30T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-30T15:00:00.000Z","halfTime":"2014-08-30T15:45:00.000Z","fullTime":"2014-08-30T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Stoke City","fixStadium":"Eithad Stadium","round":3,"fixDate":"2014-08-30T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-30T15:00:00.000Z","halfTime":"2014-08-30T15:45:00.000Z","fullTime":"2014-08-30T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Crystal Palace","fixStadium":"St James' Park","round":3,"fixDate":"2014-08-30T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-30T15:00:00.000Z","halfTime":"2014-08-30T15:45:00.000Z","fullTime":"2014-08-30T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Sunderland","fixStadium":"Loftus Road","round":3,"fixDate":"2014-08-30T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-30T15:00:00.000Z","halfTime":"2014-08-30T15:45:00.000Z","fullTime":"2014-08-30T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"West Bromwich Albion","fixStadium":"Liberty Stadium","round":3,"fixDate":"2014-08-30T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-30T15:00:00.000Z","halfTime":"2014-08-30T15:45:00.000Z","fullTime":"2014-08-30T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Liverpool","fixStadium":"White Hart Lane","round":3,"fixDate":"2014-08-30T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-30T15:00:00.000Z","halfTime":"2014-08-30T15:45:00.000Z","fullTime":"2014-08-30T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Southampton","fixStadium":"Boleyn Ground","round":3,"fixDate":"2014-08-30T15:00:00.000Z","fixResult":0,"kickOff":"2014-08-30T15:00:00.000Z","halfTime":"2014-08-30T15:45:00.000Z","fullTime":"2014-08-30T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Manchester City","fixStadium":"Emirates Stadium","round":4,"fixDate":"2014-09-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-13T15:00:00.000Z","halfTime":"2014-09-13T15:45:00.000Z","fullTime":"2014-09-13T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Swansea City","fixStadium":"Stamford Bridge","round":4,"fixDate":"2014-09-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-13T15:00:00.000Z","halfTime":"2014-09-13T15:45:00.000Z","fullTime":"2014-09-13T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Burnley","fixStadium":"Selhurst Park","round":4,"fixDate":"2014-09-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-13T15:00:00.000Z","halfTime":"2014-09-13T15:45:00.000Z","fullTime":"2014-09-13T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"West Ham United","fixStadium":"KC Stadium","round":4,"fixDate":"2014-09-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-13T15:00:00.000Z","halfTime":"2014-09-13T15:45:00.000Z","fullTime":"2014-09-13T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Aston Villa","fixStadium":"Anfield","round":4,"fixDate":"2014-09-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-13T15:00:00.000Z","halfTime":"2014-09-13T15:45:00.000Z","fullTime":"2014-09-13T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Queens Park Rangers","fixStadium":"Old Trafford","round":4,"fixDate":"2014-09-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-13T15:00:00.000Z","halfTime":"2014-09-13T15:45:00.000Z","fullTime":"2014-09-13T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Newcastle United","fixStadium":"St Mary's Stadium","round":4,"fixDate":"2014-09-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-13T15:00:00.000Z","halfTime":"2014-09-13T15:45:00.000Z","fullTime":"2014-09-13T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Leicester City","fixStadium":"Britannia Stadium","round":4,"fixDate":"2014-09-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-13T15:00:00.000Z","halfTime":"2014-09-13T15:45:00.000Z","fullTime":"2014-09-13T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Tottenham Hotspur","fixStadium":"Stadium of Light","round":4,"fixDate":"2014-09-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-13T15:00:00.000Z","halfTime":"2014-09-13T15:45:00.000Z","fullTime":"2014-09-13T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Everton","fixStadium":"The Hawthorns","round":4,"fixDate":"2014-09-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-13T15:00:00.000Z","halfTime":"2014-09-13T15:45:00.000Z","fullTime":"2014-09-13T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Arsenal","fixStadium":"Villa Park","round":5,"fixDate":"2014-09-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-20T15:00:00.000Z","halfTime":"2014-09-20T15:45:00.000Z","fullTime":"2014-09-20T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Sunderland","fixStadium":"Turf Moore","round":5,"fixDate":"2014-09-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-20T15:00:00.000Z","halfTime":"2014-09-20T15:45:00.000Z","fullTime":"2014-09-20T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Crystal Palace","fixStadium":"Goodison Park","round":5,"fixDate":"2014-09-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-20T15:00:00.000Z","halfTime":"2014-09-20T15:45:00.000Z","fullTime":"2014-09-20T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Manchester United","fixStadium":"King Power Stadium","round":5,"fixDate":"2014-09-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-20T15:00:00.000Z","halfTime":"2014-09-20T15:45:00.000Z","fullTime":"2014-09-20T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Chelsea","fixStadium":"Eithad Stadium","round":5,"fixDate":"2014-09-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-20T15:00:00.000Z","halfTime":"2014-09-20T15:45:00.000Z","fullTime":"2014-09-20T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Hull City","fixStadium":"St James' Park","round":5,"fixDate":"2014-09-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-20T15:00:00.000Z","halfTime":"2014-09-20T15:45:00.000Z","fullTime":"2014-09-20T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Stoke City","fixStadium":"Loftus Road","round":5,"fixDate":"2014-09-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-20T15:00:00.000Z","halfTime":"2014-09-20T15:45:00.000Z","fullTime":"2014-09-20T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Southampton","fixStadium":"Liberty Stadium","round":5,"fixDate":"2014-09-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-20T15:00:00.000Z","halfTime":"2014-09-20T15:45:00.000Z","fullTime":"2014-09-20T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"West Bromwich Albion","fixStadium":"White Hart Lane","round":5,"fixDate":"2014-09-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-20T15:00:00.000Z","halfTime":"2014-09-20T15:45:00.000Z","fullTime":"2014-09-20T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Liverpool","fixStadium":"Boleyn Ground","round":5,"fixDate":"2014-09-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-20T15:00:00.000Z","halfTime":"2014-09-20T15:45:00.000Z","fullTime":"2014-09-20T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Tottenham Hotspur","fixStadium":"Emirates Stadium","round":6,"fixDate":"2014-09-27T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-27T15:00:00.000Z","halfTime":"2014-09-27T15:45:00.000Z","fullTime":"2014-09-27T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Aston Villa","fixStadium":"Stamford Bridge","round":6,"fixDate":"2014-09-27T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-27T15:00:00.000Z","halfTime":"2014-09-27T15:45:00.000Z","fullTime":"2014-09-27T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Leicester City","fixStadium":"Selhurst Park","round":6,"fixDate":"2014-09-27T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-27T15:00:00.000Z","halfTime":"2014-09-27T15:45:00.000Z","fullTime":"2014-09-27T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Manchester City","fixStadium":"KC Stadium","round":6,"fixDate":"2014-09-27T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-27T15:00:00.000Z","halfTime":"2014-09-27T15:45:00.000Z","fullTime":"2014-09-27T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Everton","fixStadium":"Anfield","round":6,"fixDate":"2014-09-27T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-27T15:00:00.000Z","halfTime":"2014-09-27T15:45:00.000Z","fullTime":"2014-09-27T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"West Ham United","fixStadium":"Old Trafford","round":6,"fixDate":"2014-09-27T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-27T15:00:00.000Z","halfTime":"2014-09-27T15:45:00.000Z","fullTime":"2014-09-27T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Queens Park Rangers","fixStadium":"St Mary's Stadium","round":6,"fixDate":"2014-09-27T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-27T15:00:00.000Z","halfTime":"2014-09-27T15:45:00.000Z","fullTime":"2014-09-27T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Newcastle United","fixStadium":"Britannia Stadium","round":6,"fixDate":"2014-09-27T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-27T15:00:00.000Z","halfTime":"2014-09-27T15:45:00.000Z","fullTime":"2014-09-27T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Swansea City","fixStadium":"Stadium of Light","round":6,"fixDate":"2014-09-27T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-27T15:00:00.000Z","halfTime":"2014-09-27T15:45:00.000Z","fullTime":"2014-09-27T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Burnley","fixStadium":"The Hawthorns","round":6,"fixDate":"2014-09-27T15:00:00.000Z","fixResult":0,"kickOff":"2014-09-27T15:00:00.000Z","halfTime":"2014-09-27T15:45:00.000Z","fullTime":"2014-09-27T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Manchester City","fixStadium":"Villa Park","round":7,"fixDate":"2014-10-04T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-04T15:00:00.000Z","halfTime":"2014-10-04T15:45:00.000Z","fullTime":"2014-10-04T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Arsenal","fixStadium":"Stamford Bridge","round":7,"fixDate":"2014-10-04T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-04T15:00:00.000Z","halfTime":"2014-10-04T15:45:00.000Z","fullTime":"2014-10-04T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Crystal Palace","fixStadium":"KC Stadium","round":7,"fixDate":"2014-10-04T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-04T15:00:00.000Z","halfTime":"2014-10-04T15:45:00.000Z","fullTime":"2014-10-04T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Burnley","fixStadium":"King Power Stadium","round":7,"fixDate":"2014-10-04T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-04T15:00:00.000Z","halfTime":"2014-10-04T15:45:00.000Z","fullTime":"2014-10-04T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"West Bromwich Albion","fixStadium":"Anfield","round":7,"fixDate":"2014-10-04T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-04T15:00:00.000Z","halfTime":"2014-10-04T15:45:00.000Z","fullTime":"2014-10-04T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Everton","fixStadium":"Old Trafford","round":7,"fixDate":"2014-10-04T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-04T15:00:00.000Z","halfTime":"2014-10-04T15:45:00.000Z","fullTime":"2014-10-04T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Stoke City","fixStadium":"Stadium of Light","round":7,"fixDate":"2014-10-04T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-04T15:00:00.000Z","halfTime":"2014-10-04T15:45:00.000Z","fullTime":"2014-10-04T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Newcastle United","fixStadium":"Liberty Stadium","round":7,"fixDate":"2014-10-04T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-04T15:00:00.000Z","halfTime":"2014-10-04T15:45:00.000Z","fullTime":"2014-10-04T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Southampton","fixStadium":"White Hart Lane","round":7,"fixDate":"2014-10-04T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-04T15:00:00.000Z","halfTime":"2014-10-04T15:45:00.000Z","fullTime":"2014-10-04T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Queens Park Rangers","fixStadium":"Boleyn Ground","round":7,"fixDate":"2014-10-04T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-04T15:00:00.000Z","halfTime":"2014-10-04T15:45:00.000Z","fullTime":"2014-10-04T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Hull City","fixStadium":"Emirates Stadium","round":8,"fixDate":"2014-10-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-18T15:00:00.000Z","halfTime":"2014-10-18T15:45:00.000Z","fullTime":"2014-10-18T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"West Ham United","fixStadium":"Turf Moore","round":8,"fixDate":"2014-10-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-18T15:00:00.000Z","halfTime":"2014-10-18T15:45:00.000Z","fullTime":"2014-10-18T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Chelsea","fixStadium":"Selhurst Park","round":8,"fixDate":"2014-10-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-18T15:00:00.000Z","halfTime":"2014-10-18T15:45:00.000Z","fullTime":"2014-10-18T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Aston Villa","fixStadium":"Goodison Park","round":8,"fixDate":"2014-10-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-18T15:00:00.000Z","halfTime":"2014-10-18T15:45:00.000Z","fullTime":"2014-10-18T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Tottenham Hotspur","fixStadium":"Eithad Stadium","round":8,"fixDate":"2014-10-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-18T15:00:00.000Z","halfTime":"2014-10-18T15:45:00.000Z","fullTime":"2014-10-18T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Leicester City","fixStadium":"St James' Park","round":8,"fixDate":"2014-10-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-18T15:00:00.000Z","halfTime":"2014-10-18T15:45:00.000Z","fullTime":"2014-10-18T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Liverpool","fixStadium":"Loftus Road","round":8,"fixDate":"2014-10-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-18T15:00:00.000Z","halfTime":"2014-10-18T15:45:00.000Z","fullTime":"2014-10-18T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Sunderland","fixStadium":"St Mary's Stadium","round":8,"fixDate":"2014-10-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-18T15:00:00.000Z","halfTime":"2014-10-18T15:45:00.000Z","fullTime":"2014-10-18T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Swansea City","fixStadium":"Britannia Stadium","round":8,"fixDate":"2014-10-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-18T15:00:00.000Z","halfTime":"2014-10-18T15:45:00.000Z","fullTime":"2014-10-18T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Manchester United","fixStadium":"The Hawthorns","round":8,"fixDate":"2014-10-18T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-18T15:00:00.000Z","halfTime":"2014-10-18T15:45:00.000Z","fullTime":"2014-10-18T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Everton","fixStadium":"Turf Moore","round":9,"fixDate":"2014-10-25T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-25T15:00:00.000Z","halfTime":"2014-10-25T15:45:00.000Z","fullTime":"2014-10-25T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Hull City","fixStadium":"Anfield","round":9,"fixDate":"2014-10-25T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-25T15:00:00.000Z","halfTime":"2014-10-25T15:45:00.000Z","fullTime":"2014-10-25T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Chelsea","fixStadium":"Old Trafford","round":9,"fixDate":"2014-10-25T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-25T15:00:00.000Z","halfTime":"2014-10-25T15:45:00.000Z","fullTime":"2014-10-25T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Aston Villa","fixStadium":"Loftus Road","round":9,"fixDate":"2014-10-25T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-25T15:00:00.000Z","halfTime":"2014-10-25T15:45:00.000Z","fullTime":"2014-10-25T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Stoke City","fixStadium":"St Mary's Stadium","round":9,"fixDate":"2014-10-25T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-25T15:00:00.000Z","halfTime":"2014-10-25T15:45:00.000Z","fullTime":"2014-10-25T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Arsenal","fixStadium":"Stadium of Light","round":9,"fixDate":"2014-10-25T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-25T15:00:00.000Z","halfTime":"2014-10-25T15:45:00.000Z","fullTime":"2014-10-25T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Leicester City","fixStadium":"Liberty Stadium","round":9,"fixDate":"2014-10-25T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-25T15:00:00.000Z","halfTime":"2014-10-25T15:45:00.000Z","fullTime":"2014-10-25T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Newcastle United","fixStadium":"White Hart Lane","round":9,"fixDate":"2014-10-25T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-25T15:00:00.000Z","halfTime":"2014-10-25T15:45:00.000Z","fullTime":"2014-10-25T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Crystal Palace","fixStadium":"The Hawthorns","round":9,"fixDate":"2014-10-25T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-25T15:00:00.000Z","halfTime":"2014-10-25T15:45:00.000Z","fullTime":"2014-10-25T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Manchester City","fixStadium":"Boleyn Ground","round":9,"fixDate":"2014-10-25T15:00:00.000Z","fixResult":0,"kickOff":"2014-10-25T15:00:00.000Z","halfTime":"2014-10-25T15:45:00.000Z","fullTime":"2014-10-25T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Burnley","fixStadium":"Emirates Stadium","round":10,"fixDate":"2014-11-01T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-01T15:00:00.000Z","halfTime":"2014-11-01T15:45:00.000Z","fullTime":"2014-11-01T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Tottenham Hotspur","fixStadium":"Villa Park","round":10,"fixDate":"2014-11-01T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-01T15:00:00.000Z","halfTime":"2014-11-01T15:45:00.000Z","fullTime":"2014-11-01T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Queens Park Rangers","fixStadium":"Stamford Bridge","round":10,"fixDate":"2014-11-01T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-01T15:00:00.000Z","halfTime":"2014-11-01T15:45:00.000Z","fullTime":"2014-11-01T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Sunderland","fixStadium":"Selhurst Park","round":10,"fixDate":"2014-11-01T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-01T15:00:00.000Z","halfTime":"2014-11-01T15:45:00.000Z","fullTime":"2014-11-01T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Swansea City","fixStadium":"Goodison Park","round":10,"fixDate":"2014-11-01T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-01T15:00:00.000Z","halfTime":"2014-11-01T15:45:00.000Z","fullTime":"2014-11-01T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Southampton","fixStadium":"KC Stadium","round":10,"fixDate":"2014-11-01T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-01T15:00:00.000Z","halfTime":"2014-11-01T15:45:00.000Z","fullTime":"2014-11-01T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"West Bromwich Albion","fixStadium":"King Power Stadium","round":10,"fixDate":"2014-11-01T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-01T15:00:00.000Z","halfTime":"2014-11-01T15:45:00.000Z","fullTime":"2014-11-01T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Manchester United","fixStadium":"Eithad Stadium","round":10,"fixDate":"2014-11-01T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-01T15:00:00.000Z","halfTime":"2014-11-01T15:45:00.000Z","fullTime":"2014-11-01T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Liverpool","fixStadium":"St James' Park","round":10,"fixDate":"2014-11-01T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-01T15:00:00.000Z","halfTime":"2014-11-01T15:45:00.000Z","fullTime":"2014-11-01T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"West Ham United","fixStadium":"Britannia Stadium","round":10,"fixDate":"2014-11-01T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-01T15:00:00.000Z","halfTime":"2014-11-01T15:45:00.000Z","fullTime":"2014-11-01T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Hull City","fixStadium":"Turf Moore","round":11,"fixDate":"2014-11-08T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-08T15:00:00.000Z","halfTime":"2014-11-08T15:45:00.000Z","fullTime":"2014-11-08T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Chelsea","fixStadium":"Anfield","round":11,"fixDate":"2014-11-08T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-08T15:00:00.000Z","halfTime":"2014-11-08T15:45:00.000Z","fullTime":"2014-11-08T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Crystal Palace","fixStadium":"Old Trafford","round":11,"fixDate":"2014-11-08T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-08T15:00:00.000Z","halfTime":"2014-11-08T15:45:00.000Z","fullTime":"2014-11-08T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Manchester City","fixStadium":"Loftus Road","round":11,"fixDate":"2014-11-08T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-08T15:00:00.000Z","halfTime":"2014-11-08T15:45:00.000Z","fullTime":"2014-11-08T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Leicester City","fixStadium":"St Mary's Stadium","round":11,"fixDate":"2014-11-08T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-08T15:00:00.000Z","halfTime":"2014-11-08T15:45:00.000Z","fullTime":"2014-11-08T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Everton","fixStadium":"Stadium of Light","round":11,"fixDate":"2014-11-08T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-08T15:00:00.000Z","halfTime":"2014-11-08T15:45:00.000Z","fullTime":"2014-11-08T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Arsenal","fixStadium":"Liberty Stadium","round":11,"fixDate":"2014-11-08T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-08T15:00:00.000Z","halfTime":"2014-11-08T15:45:00.000Z","fullTime":"2014-11-08T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Stoke City","fixStadium":"White Hart Lane","round":11,"fixDate":"2014-11-08T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-08T15:00:00.000Z","halfTime":"2014-11-08T15:45:00.000Z","fullTime":"2014-11-08T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Newcastle United","fixStadium":"The Hawthorns","round":11,"fixDate":"2014-11-08T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-08T15:00:00.000Z","halfTime":"2014-11-08T15:45:00.000Z","fullTime":"2014-11-08T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Aston Villa","fixStadium":"Boleyn Ground","round":11,"fixDate":"2014-11-08T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-08T15:00:00.000Z","halfTime":"2014-11-08T15:45:00.000Z","fullTime":"2014-11-08T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Manchester United","fixStadium":"Emirates Stadium","round":12,"fixDate":"2014-11-22T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-22T15:00:00.000Z","halfTime":"2014-11-22T15:45:00.000Z","fullTime":"2014-11-22T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Southampton","fixStadium":"Villa Park","round":12,"fixDate":"2014-11-22T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-22T15:00:00.000Z","halfTime":"2014-11-22T15:45:00.000Z","fullTime":"2014-11-22T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"West Bromwich Albion","fixStadium":"Stamford Bridge","round":12,"fixDate":"2014-11-22T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-22T15:00:00.000Z","halfTime":"2014-11-22T15:45:00.000Z","fullTime":"2014-11-22T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Liverpool","fixStadium":"Selhurst Park","round":12,"fixDate":"2014-11-22T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-22T15:00:00.000Z","halfTime":"2014-11-22T15:45:00.000Z","fullTime":"2014-11-22T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"West Ham United","fixStadium":"Goodison Park","round":12,"fixDate":"2014-11-22T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-22T15:00:00.000Z","halfTime":"2014-11-22T15:45:00.000Z","fullTime":"2014-11-22T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Tottenham Hotspur","fixStadium":"KC Stadium","round":12,"fixDate":"2014-11-22T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-22T15:00:00.000Z","halfTime":"2014-11-22T15:45:00.000Z","fullTime":"2014-11-22T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Sunderland","fixStadium":"King Power Stadium","round":12,"fixDate":"2014-11-22T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-22T15:00:00.000Z","halfTime":"2014-11-22T15:45:00.000Z","fullTime":"2014-11-22T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Swansea City","fixStadium":"Eithad Stadium","round":12,"fixDate":"2014-11-22T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-22T15:00:00.000Z","halfTime":"2014-11-22T15:45:00.000Z","fullTime":"2014-11-22T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Queens Park Rangers","fixStadium":"St James' Park","round":12,"fixDate":"2014-11-22T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-22T15:00:00.000Z","halfTime":"2014-11-22T15:45:00.000Z","fullTime":"2014-11-22T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Burnley","fixStadium":"Britannia Stadium","round":12,"fixDate":"2014-11-22T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-22T15:00:00.000Z","halfTime":"2014-11-22T15:45:00.000Z","fullTime":"2014-11-22T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Aston Villa","fixStadium":"Turf Moore","round":13,"fixDate":"2014-11-29T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-29T15:00:00.000Z","halfTime":"2014-11-29T15:45:00.000Z","fullTime":"2014-11-29T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Stoke City","fixStadium":"Anfield","round":13,"fixDate":"2014-11-29T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-29T15:00:00.000Z","halfTime":"2014-11-29T15:45:00.000Z","fullTime":"2014-11-29T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Hull City","fixStadium":"Old Trafford","round":13,"fixDate":"2014-11-29T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-29T15:00:00.000Z","halfTime":"2014-11-29T15:45:00.000Z","fullTime":"2014-11-29T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Leicester City","fixStadium":"Loftus Road","round":13,"fixDate":"2014-11-29T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-29T15:00:00.000Z","halfTime":"2014-11-29T15:45:00.000Z","fullTime":"2014-11-29T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Manchester City","fixStadium":"St Mary's Stadium","round":13,"fixDate":"2014-11-29T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-29T15:00:00.000Z","halfTime":"2014-11-29T15:45:00.000Z","fullTime":"2014-11-29T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Chelsea","fixStadium":"Stadium of Light","round":13,"fixDate":"2014-11-29T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-29T15:00:00.000Z","halfTime":"2014-11-29T15:45:00.000Z","fullTime":"2014-11-29T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Crystal Palace","fixStadium":"Liberty Stadium","round":13,"fixDate":"2014-11-29T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-29T15:00:00.000Z","halfTime":"2014-11-29T15:45:00.000Z","fullTime":"2014-11-29T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Everton","fixStadium":"White Hart Lane","round":13,"fixDate":"2014-11-29T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-29T15:00:00.000Z","halfTime":"2014-11-29T15:45:00.000Z","fullTime":"2014-11-29T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Arsenal","fixStadium":"The Hawthorns","round":13,"fixDate":"2014-11-29T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-29T15:00:00.000Z","halfTime":"2014-11-29T15:45:00.000Z","fullTime":"2014-11-29T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Newcastle United","fixStadium":"Boleyn Ground","round":13,"fixDate":"2014-11-29T15:00:00.000Z","fixResult":0,"kickOff":"2014-11-29T15:00:00.000Z","halfTime":"2014-11-29T15:45:00.000Z","fullTime":"2014-11-29T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Southampton","fixStadium":"Emirates Stadium","round":14,"fixDate":"2014-12-02T19:45:00.000Z","fixResult":0,"kickOff":"2014-12-02T19:45:00.000Z","halfTime":"2014-12-02T20:30:00.000Z","fullTime":"2014-12-02T21:30:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Newcastle United","fixStadium":"Turf Moore","round":14,"fixDate":"2014-12-02T19:45:00.000Z","fixResult":0,"kickOff":"2014-12-02T19:45:00.000Z","halfTime":"2014-12-02T20:30:00.000Z","fullTime":"2014-12-02T21:30:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Aston Villa","fixStadium":"Selhurst Park","round":14,"fixDate":"2014-12-02T20:00:00.000Z","fixResult":0,"kickOff":"2014-12-02T20:00:00.000Z","halfTime":"2014-12-02T20:45:00.000Z","fullTime":"2014-12-02T21:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Liverpool","fixStadium":"King Power Stadium","round":14,"fixDate":"2014-12-02T19:45:00.000Z","fixResult":0,"kickOff":"2014-12-02T19:45:00.000Z","halfTime":"2014-12-02T20:30:00.000Z","fullTime":"2014-12-02T21:30:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Stoke City","fixStadium":"Old Trafford","round":14,"fixDate":"2014-12-02T19:45:00.000Z","fixResult":0,"kickOff":"2014-12-02T19:45:00.000Z","halfTime":"2014-12-02T20:30:00.000Z","fullTime":"2014-12-02T21:30:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Queens Park Rangers","fixStadium":"Liberty Stadium","round":14,"fixDate":"2014-12-02T19:45:00.000Z","fixResult":0,"kickOff":"2014-12-02T19:45:00.000Z","halfTime":"2014-12-02T20:30:00.000Z","fullTime":"2014-12-02T21:30:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"West Ham United","fixStadium":"The Hawthorns","round":14,"fixDate":"2014-12-02T20:00:00.000Z","fixResult":0,"kickOff":"2014-12-02T20:00:00.000Z","halfTime":"2014-12-02T20:45:00.000Z","fullTime":"2014-12-02T21:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Tottenham Hotspur","fixStadium":"Stamford Bridge","round":14,"fixDate":"2014-12-02T19:45:00.000Z","fixResult":0,"kickOff":"2014-12-02T19:45:00.000Z","halfTime":"2014-12-02T20:30:00.000Z","fullTime":"2014-12-02T21:30:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Hull City","fixStadium":"Goodison Park","round":14,"fixDate":"2014-12-02T19:45:00.000Z","fixResult":0,"kickOff":"2014-12-02T19:45:00.000Z","halfTime":"2014-12-02T20:30:00.000Z","fullTime":"2014-12-02T21:30:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Manchester City","fixStadium":"Stadium of Light","round":14,"fixDate":"2014-12-02T19:45:00.000Z","fixResult":0,"kickOff":"2014-12-02T19:45:00.000Z","halfTime":"2014-12-02T20:30:00.000Z","fullTime":"2014-12-02T21:30:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Leicester City","fixStadium":"Villa Park","round":15,"fixDate":"2014-12-06T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-06T15:00:00.000Z","halfTime":"2014-12-06T15:45:00.000Z","fullTime":"2014-12-06T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"West Bromwich Albion","fixStadium":"KC Stadium","round":15,"fixDate":"2014-12-06T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-06T15:00:00.000Z","halfTime":"2014-12-06T15:45:00.000Z","fullTime":"2014-12-06T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Sunderland","fixStadium":"Anfield","round":15,"fixDate":"2014-12-06T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-06T15:00:00.000Z","halfTime":"2014-12-06T15:45:00.000Z","fullTime":"2014-12-06T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Everton","fixStadium":"Eithad Stadium","round":15,"fixDate":"2014-12-06T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-06T15:00:00.000Z","halfTime":"2014-12-06T15:45:00.000Z","fullTime":"2014-12-06T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Chelsea","fixStadium":"St James' Park","round":15,"fixDate":"2014-12-06T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-06T15:00:00.000Z","halfTime":"2014-12-06T15:45:00.000Z","fullTime":"2014-12-06T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Burnley","fixStadium":"Loftus Road","round":15,"fixDate":"2014-12-06T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-06T15:00:00.000Z","halfTime":"2014-12-06T15:45:00.000Z","fullTime":"2014-12-06T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Manchester United","fixStadium":"St Mary's Stadium","round":15,"fixDate":"2014-12-06T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-06T15:00:00.000Z","halfTime":"2014-12-06T15:45:00.000Z","fullTime":"2014-12-06T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Arsenal","fixStadium":"Britannia Stadium","round":15,"fixDate":"2014-12-06T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-06T15:00:00.000Z","halfTime":"2014-12-06T15:45:00.000Z","fullTime":"2014-12-06T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Crystal Palace","fixStadium":"White Hart Lane","round":15,"fixDate":"2014-12-06T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-06T15:00:00.000Z","halfTime":"2014-12-06T15:45:00.000Z","fullTime":"2014-12-06T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Swansea City","fixStadium":"Boleyn Ground","round":15,"fixDate":"2014-12-06T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-06T15:00:00.000Z","halfTime":"2014-12-06T15:45:00.000Z","fullTime":"2014-12-06T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Newcastle United","fixStadium":"Emirates Stadium","round":16,"fixDate":"2014-12-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-13T15:00:00.000Z","halfTime":"2014-12-13T15:45:00.000Z","fullTime":"2014-12-13T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Southampton","fixStadium":"Turf Moore","round":16,"fixDate":"2014-12-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-13T15:00:00.000Z","halfTime":"2014-12-13T15:45:00.000Z","fullTime":"2014-12-13T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Hull City","fixStadium":"Stamford Bridge","round":16,"fixDate":"2014-12-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-13T15:00:00.000Z","halfTime":"2014-12-13T15:45:00.000Z","fullTime":"2014-12-13T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Stoke City","fixStadium":"Selhurst Park","round":16,"fixDate":"2014-12-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-13T15:00:00.000Z","halfTime":"2014-12-13T15:45:00.000Z","fullTime":"2014-12-13T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Queens Park Rangers","fixStadium":"Goodison Park","round":16,"fixDate":"2014-12-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-13T15:00:00.000Z","halfTime":"2014-12-13T15:45:00.000Z","fullTime":"2014-12-13T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Manchester City","fixStadium":"King Power Stadium","round":16,"fixDate":"2014-12-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-13T15:00:00.000Z","halfTime":"2014-12-13T15:45:00.000Z","fullTime":"2014-12-13T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Liverpool","fixStadium":"Old Trafford","round":16,"fixDate":"2014-12-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-13T15:00:00.000Z","halfTime":"2014-12-13T15:45:00.000Z","fullTime":"2014-12-13T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"West Ham United","fixStadium":"Stadium of Light","round":16,"fixDate":"2014-12-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-13T15:00:00.000Z","halfTime":"2014-12-13T15:45:00.000Z","fullTime":"2014-12-13T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Tottenham Hotspur","fixStadium":"Liberty Stadium","round":16,"fixDate":"2014-12-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-13T15:00:00.000Z","halfTime":"2014-12-13T15:45:00.000Z","fullTime":"2014-12-13T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Aston Villa","fixStadium":"The Hawthorns","round":16,"fixDate":"2014-12-13T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-13T15:00:00.000Z","halfTime":"2014-12-13T15:45:00.000Z","fullTime":"2014-12-13T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Manchester United","fixStadium":"Villa Park","round":17,"fixDate":"2014-12-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-20T15:00:00.000Z","halfTime":"2014-12-20T15:45:00.000Z","fullTime":"2014-12-20T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Swansea City","fixStadium":"KC Stadium","round":17,"fixDate":"2014-12-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-20T15:00:00.000Z","halfTime":"2014-12-20T15:45:00.000Z","fullTime":"2014-12-20T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Arsenal","fixStadium":"Anfield","round":17,"fixDate":"2014-12-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-20T15:00:00.000Z","halfTime":"2014-12-20T15:45:00.000Z","fullTime":"2014-12-20T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Crystal Palace","fixStadium":"Eithad Stadium","round":17,"fixDate":"2014-12-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-20T15:00:00.000Z","halfTime":"2014-12-20T15:45:00.000Z","fullTime":"2014-12-20T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Sunderland","fixStadium":"St James' Park","round":17,"fixDate":"2014-12-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-20T15:00:00.000Z","halfTime":"2014-12-20T15:45:00.000Z","fullTime":"2014-12-20T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"West Bromwich Albion","fixStadium":"Loftus Road","round":17,"fixDate":"2014-12-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-20T15:00:00.000Z","halfTime":"2014-12-20T15:45:00.000Z","fullTime":"2014-12-20T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Everton","fixStadium":"St Mary's Stadium","round":17,"fixDate":"2014-12-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-20T15:00:00.000Z","halfTime":"2014-12-20T15:45:00.000Z","fullTime":"2014-12-20T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Chelsea","fixStadium":"Britannia Stadium","round":17,"fixDate":"2014-12-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-20T15:00:00.000Z","halfTime":"2014-12-20T15:45:00.000Z","fullTime":"2014-12-20T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Burnley","fixStadium":"White Hart Lane","round":17,"fixDate":"2014-12-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-20T15:00:00.000Z","halfTime":"2014-12-20T15:45:00.000Z","fullTime":"2014-12-20T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Leicester City","fixStadium":"Boleyn Ground","round":17,"fixDate":"2014-12-20T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-20T15:00:00.000Z","halfTime":"2014-12-20T15:45:00.000Z","fullTime":"2014-12-20T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Queens Park Rangers","fixStadium":"Emirates Stadium","round":18,"fixDate":"2014-12-26T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-26T15:00:00.000Z","halfTime":"2014-12-26T15:45:00.000Z","fullTime":"2014-12-26T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Liverpool","fixStadium":"Turf Moore","round":18,"fixDate":"2014-12-26T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-26T15:00:00.000Z","halfTime":"2014-12-26T15:45:00.000Z","fullTime":"2014-12-26T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"West Ham United","fixStadium":"Stamford Bridge","round":18,"fixDate":"2014-12-26T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-26T15:00:00.000Z","halfTime":"2014-12-26T15:45:00.000Z","fullTime":"2014-12-26T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Southampton","fixStadium":"Selhurst Park","round":18,"fixDate":"2014-12-26T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-26T15:00:00.000Z","halfTime":"2014-12-26T15:45:00.000Z","fullTime":"2014-12-26T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Stoke City","fixStadium":"Goodison Park","round":18,"fixDate":"2014-12-26T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-26T15:00:00.000Z","halfTime":"2014-12-26T15:45:00.000Z","fullTime":"2014-12-26T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Tottenham Hotspur","fixStadium":"King Power Stadium","round":18,"fixDate":"2014-12-26T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-26T15:00:00.000Z","halfTime":"2014-12-26T15:45:00.000Z","fullTime":"2014-12-26T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Newcastle United","fixStadium":"Old Trafford","round":18,"fixDate":"2014-12-26T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-26T15:00:00.000Z","halfTime":"2014-12-26T15:45:00.000Z","fullTime":"2014-12-26T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Hull City","fixStadium":"Stadium of Light","round":18,"fixDate":"2014-12-26T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-26T15:00:00.000Z","halfTime":"2014-12-26T15:45:00.000Z","fullTime":"2014-12-26T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Aston Villa","fixStadium":"Liberty Stadium","round":18,"fixDate":"2014-12-26T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-26T15:00:00.000Z","halfTime":"2014-12-26T15:45:00.000Z","fullTime":"2014-12-26T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Manchester City","fixStadium":"The Hawthorns","round":18,"fixDate":"2014-12-26T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-26T15:00:00.000Z","halfTime":"2014-12-26T15:45:00.000Z","fullTime":"2014-12-26T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Sunderland","fixStadium":"Villa Park","round":19,"fixDate":"2014-12-28T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-28T15:00:00.000Z","halfTime":"2014-12-28T15:45:00.000Z","fullTime":"2014-12-28T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Leicester City","fixStadium":"KC Stadium","round":19,"fixDate":"2014-12-28T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-28T15:00:00.000Z","halfTime":"2014-12-28T15:45:00.000Z","fullTime":"2014-12-28T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Swansea City","fixStadium":"Anfield","round":19,"fixDate":"2014-12-28T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-28T15:00:00.000Z","halfTime":"2014-12-28T15:45:00.000Z","fullTime":"2014-12-28T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Burnley","fixStadium":"Eithad Stadium","round":19,"fixDate":"2014-12-28T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-28T15:00:00.000Z","halfTime":"2014-12-28T15:45:00.000Z","fullTime":"2014-12-28T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Everton","fixStadium":"St James' Park","round":19,"fixDate":"2014-12-28T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-28T15:00:00.000Z","halfTime":"2014-12-28T15:45:00.000Z","fullTime":"2014-12-28T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Crystal Palace","fixStadium":"Loftus Road","round":19,"fixDate":"2014-12-28T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-28T15:00:00.000Z","halfTime":"2014-12-28T15:45:00.000Z","fullTime":"2014-12-28T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Chelsea","fixStadium":"St Mary's Stadium","round":19,"fixDate":"2014-12-28T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-28T15:00:00.000Z","halfTime":"2014-12-28T15:45:00.000Z","fullTime":"2014-12-28T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"West Bromwich Albion","fixStadium":"Britannia Stadium","round":19,"fixDate":"2014-12-28T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-28T15:00:00.000Z","halfTime":"2014-12-28T15:45:00.000Z","fullTime":"2014-12-28T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Manchester United","fixStadium":"White Hart Lane","round":19,"fixDate":"2014-12-28T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-28T15:00:00.000Z","halfTime":"2014-12-28T15:45:00.000Z","fullTime":"2014-12-28T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Arsenal","fixStadium":"Boleyn Ground","round":19,"fixDate":"2014-12-28T15:00:00.000Z","fixResult":0,"kickOff":"2014-12-28T15:00:00.000Z","halfTime":"2014-12-28T15:45:00.000Z","fullTime":"2014-12-28T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Crystal Palace","fixStadium":"Villa Park","round":20,"fixDate":"2015-01-01T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-01T15:00:00.000Z","halfTime":"2015-01-01T15:45:00.000Z","fullTime":"2015-01-01T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Everton","fixStadium":"KC Stadium","round":20,"fixDate":"2015-01-01T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-01T15:00:00.000Z","halfTime":"2015-01-01T15:45:00.000Z","fullTime":"2015-01-01T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Leicester City","fixStadium":"Anfield","round":20,"fixDate":"2015-01-01T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-01T15:00:00.000Z","halfTime":"2015-01-01T15:45:00.000Z","fullTime":"2015-01-01T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Sunderland","fixStadium":"Eithad Stadium","round":20,"fixDate":"2015-01-01T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-01T15:00:00.000Z","halfTime":"2015-01-01T15:45:00.000Z","fullTime":"2015-01-01T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Burnley","fixStadium":"St James' Park","round":20,"fixDate":"2015-01-01T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-01T15:00:00.000Z","halfTime":"2015-01-01T15:45:00.000Z","fullTime":"2015-01-01T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Swansea City","fixStadium":"Loftus Road","round":20,"fixDate":"2015-01-01T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-01T15:00:00.000Z","halfTime":"2015-01-01T15:45:00.000Z","fullTime":"2015-01-01T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Arsenal","fixStadium":"St Mary's Stadium","round":20,"fixDate":"2015-01-01T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-01T15:00:00.000Z","halfTime":"2015-01-01T15:45:00.000Z","fullTime":"2015-01-01T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Manchester United","fixStadium":"Britannia Stadium","round":20,"fixDate":"2015-01-01T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-01T15:00:00.000Z","halfTime":"2015-01-01T15:45:00.000Z","fullTime":"2015-01-01T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Chelsea","fixStadium":"White Hart Lane","round":20,"fixDate":"2015-01-01T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-01T15:00:00.000Z","halfTime":"2015-01-01T15:45:00.000Z","fullTime":"2015-01-01T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"West Bromwich Albion","fixStadium":"Boleyn Ground","round":20,"fixDate":"2015-01-01T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-01T15:00:00.000Z","halfTime":"2015-01-01T15:45:00.000Z","fullTime":"2015-01-01T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Stoke City","fixStadium":"Emirates Stadium","round":21,"fixDate":"2015-01-10T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-10T15:00:00.000Z","halfTime":"2015-01-10T15:45:00.000Z","fullTime":"2015-01-10T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Queens Park Rangers","fixStadium":"Turf Moore","round":21,"fixDate":"2015-01-10T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-10T15:00:00.000Z","halfTime":"2015-01-10T15:45:00.000Z","fullTime":"2015-01-10T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Newcastle United","fixStadium":"Stamford Bridge","round":21,"fixDate":"2015-01-10T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-10T15:00:00.000Z","halfTime":"2015-01-10T15:45:00.000Z","fullTime":"2015-01-10T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Tottenham Hotspur","fixStadium":"Selhurst Park","round":21,"fixDate":"2015-01-10T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-10T15:00:00.000Z","halfTime":"2015-01-10T15:45:00.000Z","fullTime":"2015-01-10T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Manchester City","fixStadium":"Goodison Park","round":21,"fixDate":"2015-01-10T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-10T15:00:00.000Z","halfTime":"2015-01-10T15:45:00.000Z","fullTime":"2015-01-10T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Aston Villa","fixStadium":"King Power Stadium","round":21,"fixDate":"2015-01-10T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-10T15:00:00.000Z","halfTime":"2015-01-10T15:45:00.000Z","fullTime":"2015-01-10T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Southampton","fixStadium":"Old Trafford","round":21,"fixDate":"2015-01-10T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-10T15:00:00.000Z","halfTime":"2015-01-10T15:45:00.000Z","fullTime":"2015-01-10T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Liverpool","fixStadium":"Stadium of Light","round":21,"fixDate":"2015-01-10T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-10T15:00:00.000Z","halfTime":"2015-01-10T15:45:00.000Z","fullTime":"2015-01-10T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"West Ham United","fixStadium":"Liberty Stadium","round":21,"fixDate":"2015-01-10T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-10T15:00:00.000Z","halfTime":"2015-01-10T15:45:00.000Z","fullTime":"2015-01-10T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Hull City","fixStadium":"The Hawthorns","round":21,"fixDate":"2015-01-10T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-10T15:00:00.000Z","halfTime":"2015-01-10T15:45:00.000Z","fullTime":"2015-01-10T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Liverpool","fixStadium":"Villa Park","round":22,"fixDate":"2015-01-17T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-17T15:00:00.000Z","halfTime":"2015-01-17T15:45:00.000Z","fullTime":"2015-01-17T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Crystal Palace","fixStadium":"Turf Moore","round":22,"fixDate":"2015-01-17T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-17T15:00:00.000Z","halfTime":"2015-01-17T15:45:00.000Z","fullTime":"2015-01-17T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"West Bromwich Albion","fixStadium":"Goodison Park","round":22,"fixDate":"2015-01-17T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-17T15:00:00.000Z","halfTime":"2015-01-17T15:45:00.000Z","fullTime":"2015-01-17T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Stoke City","fixStadium":"King Power Stadium","round":22,"fixDate":"2015-01-17T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-17T15:00:00.000Z","halfTime":"2015-01-17T15:45:00.000Z","fullTime":"2015-01-17T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Arsenal","fixStadium":"Eithad Stadium","round":22,"fixDate":"2015-01-17T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-17T15:00:00.000Z","halfTime":"2015-01-17T15:45:00.000Z","fullTime":"2015-01-17T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Southampton","fixStadium":"St James' Park","round":22,"fixDate":"2015-01-17T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-17T15:00:00.000Z","halfTime":"2015-01-17T15:45:00.000Z","fullTime":"2015-01-17T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Manchester United","fixStadium":"Loftus Road","round":22,"fixDate":"2015-01-17T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-17T15:00:00.000Z","halfTime":"2015-01-17T15:45:00.000Z","fullTime":"2015-01-17T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Chelsea","fixStadium":"Liberty Stadium","round":22,"fixDate":"2015-01-17T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-17T15:00:00.000Z","halfTime":"2015-01-17T15:45:00.000Z","fullTime":"2015-01-17T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Sunderland","fixStadium":"White Hart Lane","round":22,"fixDate":"2015-01-17T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-17T15:00:00.000Z","halfTime":"2015-01-17T15:45:00.000Z","fullTime":"2015-01-17T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Hull City","fixStadium":"Boleyn Ground","round":22,"fixDate":"2015-01-17T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-17T15:00:00.000Z","halfTime":"2015-01-17T15:45:00.000Z","fullTime":"2015-01-17T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Newcastle United","fixStadium":"KC Stadium","round":23,"fixDate":"2015-01-31T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-31T15:00:00.000Z","halfTime":"2015-01-31T15:45:00.000Z","fullTime":"2015-01-31T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Everton","fixStadium":"Selhurst Park","round":23,"fixDate":"2015-01-31T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-31T15:00:00.000Z","halfTime":"2015-01-31T15:45:00.000Z","fullTime":"2015-01-31T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"West Ham United","fixStadium":"Anfield","round":23,"fixDate":"2015-01-31T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-31T15:00:00.000Z","halfTime":"2015-01-31T15:45:00.000Z","fullTime":"2015-01-31T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Leicester City","fixStadium":"Old Trafford","round":23,"fixDate":"2015-01-31T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-31T15:00:00.000Z","halfTime":"2015-01-31T15:45:00.000Z","fullTime":"2015-01-31T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Queens Park Rangers","fixStadium":"Britannia Stadium","round":23,"fixDate":"2015-01-31T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-31T15:00:00.000Z","halfTime":"2015-01-31T15:45:00.000Z","fullTime":"2015-01-31T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Burnley","fixStadium":"Stadium of Light","round":23,"fixDate":"2015-01-31T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-31T15:00:00.000Z","halfTime":"2015-01-31T15:45:00.000Z","fullTime":"2015-01-31T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Tottenham Hotspur","fixStadium":"The Hawthorns","round":23,"fixDate":"2015-01-31T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-31T15:00:00.000Z","halfTime":"2015-01-31T15:45:00.000Z","fullTime":"2015-01-31T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Manchester City","fixStadium":"Stamford Bridge","round":23,"fixDate":"2015-01-31T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-31T15:00:00.000Z","halfTime":"2015-01-31T15:45:00.000Z","fullTime":"2015-01-31T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Aston Villa","fixStadium":"Emirates Stadium","round":23,"fixDate":"2015-01-31T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-31T15:00:00.000Z","halfTime":"2015-01-31T15:45:00.000Z","fullTime":"2015-01-31T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Swansea City","fixStadium":"St Mary's Stadium","round":23,"fixDate":"2015-01-31T15:00:00.000Z","fixResult":0,"kickOff":"2015-01-31T15:00:00.000Z","halfTime":"2015-01-31T15:45:00.000Z","fullTime":"2015-01-31T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Arsenal","fixStadium":"White Hart Lane","round":24,"fixDate":"2015-02-07T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-07T15:00:00.000Z","halfTime":"2015-02-07T15:45:00.000Z","fullTime":"2015-02-07T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Chelsea","fixStadium":"Villa Park","round":24,"fixDate":"2015-02-07T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-07T15:00:00.000Z","halfTime":"2015-02-07T15:45:00.000Z","fullTime":"2015-02-07T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Crystal Palace","fixStadium":"King Power Stadium","round":24,"fixDate":"2015-02-07T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-07T15:00:00.000Z","halfTime":"2015-02-07T15:45:00.000Z","fullTime":"2015-02-07T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Hull City","fixStadium":"Eithad Stadium","round":24,"fixDate":"2015-02-07T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-07T15:00:00.000Z","halfTime":"2015-02-07T15:45:00.000Z","fullTime":"2015-02-07T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Southampton","fixStadium":"Loftus Road","round":24,"fixDate":"2015-02-07T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-07T15:00:00.000Z","halfTime":"2015-02-07T15:45:00.000Z","fullTime":"2015-02-07T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Sunderland","fixStadium":"Liberty Stadium","round":24,"fixDate":"2015-02-07T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-07T15:00:00.000Z","halfTime":"2015-02-07T15:45:00.000Z","fullTime":"2015-02-07T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Liverpool","fixStadium":"Goodison Park","round":24,"fixDate":"2015-02-07T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-07T15:00:00.000Z","halfTime":"2015-02-07T15:45:00.000Z","fullTime":"2015-02-07T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"West Bromwich Albion","fixStadium":"Turf Moore","round":24,"fixDate":"2015-02-07T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-07T15:00:00.000Z","halfTime":"2015-02-07T15:45:00.000Z","fullTime":"2015-02-07T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Stoke City","fixStadium":"St James' Park","round":24,"fixDate":"2015-02-07T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-07T15:00:00.000Z","halfTime":"2015-02-07T15:45:00.000Z","fullTime":"2015-02-07T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Manchester United","fixStadium":"Boleyn Ground","round":24,"fixDate":"2015-02-07T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-07T15:00:00.000Z","halfTime":"2015-02-07T15:45:00.000Z","fullTime":"2015-02-07T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Leicester City","fixStadium":"Emirates Stadium","round":25,"fixDate":"2015-02-10T19:45:00.000Z","fixResult":0,"kickOff":"2015-02-10T19:45:00.000Z","halfTime":"2015-02-10T20:30:00.000Z","fullTime":"2015-02-10T21:30:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Aston Villa","fixStadium":"KC Stadium","round":25,"fixDate":"2015-02-10T20:00:00.000Z","fixResult":0,"kickOff":"2015-02-10T20:00:00.000Z","halfTime":"2015-02-10T20:45:00.000Z","fullTime":"2015-02-10T21:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Queens Park Rangers","fixStadium":"Stadium of Light","round":25,"fixDate":"2015-02-10T19:45:00.000Z","fixResult":0,"kickOff":"2015-02-10T19:45:00.000Z","halfTime":"2015-02-10T20:30:00.000Z","fullTime":"2015-02-10T21:30:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Tottenham Hotspur","fixStadium":"Anfield","round":25,"fixDate":"2015-02-10T20:00:00.000Z","fixResult":0,"kickOff":"2015-02-10T20:00:00.000Z","halfTime":"2015-02-10T20:45:00.000Z","fullTime":"2015-02-10T21:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Burnley","fixStadium":"Old Trafford","round":25,"fixDate":"2015-02-10T19:45:00.000Z","fixResult":0,"kickOff":"2015-02-10T19:45:00.000Z","halfTime":"2015-02-10T20:30:00.000Z","fullTime":"2015-02-10T21:30:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"West Ham United","fixStadium":"St Mary's Stadium","round":25,"fixDate":"2015-02-10T19:45:00.000Z","fixResult":0,"kickOff":"2015-02-10T19:45:00.000Z","halfTime":"2015-02-10T20:30:00.000Z","fullTime":"2015-02-10T21:30:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Everton","fixStadium":"Stamford Bridge","round":25,"fixDate":"2015-02-10T20:00:00.000Z","fixResult":0,"kickOff":"2015-02-10T20:00:00.000Z","halfTime":"2015-02-10T20:45:00.000Z","fullTime":"2015-02-10T21:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Manchester City","fixStadium":"Britannia Stadium","round":25,"fixDate":"2015-02-10T19:45:00.000Z","fixResult":0,"kickOff":"2015-02-10T19:45:00.000Z","halfTime":"2015-02-10T20:30:00.000Z","fullTime":"2015-02-10T21:30:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Newcastle United","fixStadium":"Selhurst Park","round":25,"fixDate":"2015-02-10T19:45:00.000Z","fixResult":0,"kickOff":"2015-02-10T19:45:00.000Z","halfTime":"2015-02-10T20:30:00.000Z","fullTime":"2015-02-10T21:30:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Swansea City","fixStadium":"The Hawthorns","round":25,"fixDate":"2015-02-10T19:45:00.000Z","fixResult":0,"kickOff":"2015-02-10T19:45:00.000Z","halfTime":"2015-02-10T20:30:00.000Z","fullTime":"2015-02-10T21:30:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Stoke City","fixStadium":"Villa Park","round":26,"fixDate":"2015-02-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-21T15:00:00.000Z","halfTime":"2015-02-21T15:45:00.000Z","fullTime":"2015-02-21T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Burnley","fixStadium":"Stamford Bridge","round":26,"fixDate":"2015-02-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-21T15:00:00.000Z","halfTime":"2015-02-21T15:45:00.000Z","fullTime":"2015-02-21T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Arsenal","fixStadium":"Selhurst Park","round":26,"fixDate":"2015-02-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-21T15:00:00.000Z","halfTime":"2015-02-21T15:45:00.000Z","fullTime":"2015-02-21T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Queens Park Rangers","fixStadium":"KC Stadium","round":26,"fixDate":"2015-02-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-21T15:00:00.000Z","halfTime":"2015-02-21T15:45:00.000Z","fullTime":"2015-02-21T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"West Bromwich Albion","fixStadium":"Stadium of Light","round":26,"fixDate":"2015-02-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-21T15:00:00.000Z","halfTime":"2015-02-21T15:45:00.000Z","fullTime":"2015-02-21T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Manchester United","fixStadium":"Liberty Stadium","round":26,"fixDate":"2015-02-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-21T15:00:00.000Z","halfTime":"2015-02-21T15:45:00.000Z","fullTime":"2015-02-21T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Newcastle United","fixStadium":"Eithad Stadium","round":26,"fixDate":"2015-02-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-21T15:00:00.000Z","halfTime":"2015-02-21T15:45:00.000Z","fullTime":"2015-02-21T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"West Ham United","fixStadium":"White Hart Lane","round":26,"fixDate":"2015-02-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-21T15:00:00.000Z","halfTime":"2015-02-21T15:45:00.000Z","fullTime":"2015-02-21T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Southampton","fixStadium":"Goodison Park","round":26,"fixDate":"2015-02-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-21T15:00:00.000Z","halfTime":"2015-02-21T15:45:00.000Z","fullTime":"2015-02-21T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Liverpool","fixStadium":"St Mary's Stadium","round":26,"fixDate":"2015-02-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-21T15:00:00.000Z","halfTime":"2015-02-21T15:45:00.000Z","fullTime":"2015-02-21T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Crystal Palace","fixStadium":"Boleyn Ground","round":27,"fixDate":"2015-02-28T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-28T15:00:00.000Z","halfTime":"2015-02-28T15:45:00.000Z","fullTime":"2015-02-28T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Swansea City","fixStadium":"Turf Moore","round":27,"fixDate":"2015-02-28T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-28T15:00:00.000Z","halfTime":"2015-02-28T15:45:00.000Z","fullTime":"2015-02-28T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Sunderland","fixStadium":"Old Trafford","round":27,"fixDate":"2015-02-28T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-28T15:00:00.000Z","halfTime":"2015-02-28T15:45:00.000Z","fullTime":"2015-02-28T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Aston Villa","fixStadium":"St James' Park","round":27,"fixDate":"2015-02-28T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-28T15:00:00.000Z","halfTime":"2015-02-28T15:45:00.000Z","fullTime":"2015-02-28T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Hull City","fixStadium":"Britannia Stadium","round":27,"fixDate":"2015-02-28T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-28T15:00:00.000Z","halfTime":"2015-02-28T15:45:00.000Z","fullTime":"2015-02-28T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Southampton","fixStadium":"The Hawthorns","round":27,"fixDate":"2015-02-28T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-28T15:00:00.000Z","halfTime":"2015-02-28T15:45:00.000Z","fullTime":"2015-02-28T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Chelsea","fixStadium":"King Power Stadium","round":27,"fixDate":"2015-02-28T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-28T15:00:00.000Z","halfTime":"2015-02-28T15:45:00.000Z","fullTime":"2015-02-28T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Manchester City","fixStadium":"Anfield","round":27,"fixDate":"2015-02-28T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-28T15:00:00.000Z","halfTime":"2015-02-28T15:45:00.000Z","fullTime":"2015-02-28T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Everton","fixStadium":"Emirates Stadium","round":27,"fixDate":"2015-02-28T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-28T15:00:00.000Z","halfTime":"2015-02-28T15:45:00.000Z","fullTime":"2015-02-28T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Tottenham Hotspur","fixStadium":"Loftus Road","round":27,"fixDate":"2015-02-28T15:00:00.000Z","fixResult":0,"kickOff":"2015-02-28T15:00:00.000Z","halfTime":"2015-02-28T15:45:00.000Z","fullTime":"2015-02-28T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"West Bromwich Albion","fixStadium":"Villa Park","round":28,"fixDate":"2015-03-03T19:45:00.000Z","fixResult":0,"kickOff":"2015-03-03T19:45:00.000Z","halfTime":"2015-03-03T20:30:00.000Z","fullTime":"2015-03-03T21:30:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Sunderland","fixStadium":"KC Stadium","round":28,"fixDate":"2015-03-03T19:45:00.000Z","fixResult":0,"kickOff":"2015-03-03T19:45:00.000Z","halfTime":"2015-03-03T20:30:00.000Z","fullTime":"2015-03-03T21:30:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Crystal Palace","fixStadium":"St Mary's Stadium","round":28,"fixDate":"2015-03-03T19:45:00.000Z","fixResult":0,"kickOff":"2015-03-03T19:45:00.000Z","halfTime":"2015-03-03T20:30:00.000Z","fullTime":"2015-03-03T21:30:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Chelsea","fixStadium":"Boleyn Ground","round":28,"fixDate":"2015-03-03T19:45:00.000Z","fixResult":0,"kickOff":"2015-03-03T19:45:00.000Z","halfTime":"2015-03-03T20:30:00.000Z","fullTime":"2015-03-03T21:30:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Arsenal","fixStadium":"Loftus Road","round":28,"fixDate":"2015-03-03T19:45:00.000Z","fixResult":0,"kickOff":"2015-03-03T19:45:00.000Z","halfTime":"2015-03-03T20:30:00.000Z","fullTime":"2015-03-03T21:30:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Leicester City","fixStadium":"Eithad Stadium","round":28,"fixDate":"2015-03-03T19:45:00.000Z","fixResult":0,"kickOff":"2015-03-03T19:45:00.000Z","halfTime":"2015-03-03T20:30:00.000Z","fullTime":"2015-03-03T21:30:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Newcastle United","fixStadium":"St James' Park","round":28,"fixDate":"2015-03-03T19:45:00.000Z","fixResult":0,"kickOff":"2015-03-03T19:45:00.000Z","halfTime":"2015-03-03T20:30:00.000Z","fullTime":"2015-03-03T21:30:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Everton","fixStadium":"Britannia Stadium","round":28,"fixDate":"2015-03-03T19:45:00.000Z","fixResult":0,"kickOff":"2015-03-03T19:45:00.000Z","halfTime":"2015-03-03T20:30:00.000Z","fullTime":"2015-03-03T21:30:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Swansea City","fixStadium":"White Hart Lane","round":28,"fixDate":"2015-03-03T19:45:00.000Z","fixResult":0,"kickOff":"2015-03-03T19:45:00.000Z","halfTime":"2015-03-03T20:30:00.000Z","fullTime":"2015-03-03T21:30:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Burnley","fixStadium":"Anfield","round":28,"fixDate":"2015-03-03T19:45:00.000Z","fixResult":0,"kickOff":"2015-03-03T19:45:00.000Z","halfTime":"2015-03-03T20:30:00.000Z","fullTime":"2015-03-03T21:30:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Queens Park Rangers","fixStadium":"Selhurst Park","round":29,"fixDate":"2015-03-14T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-14T15:00:00.000Z","halfTime":"2015-03-14T15:45:00.000Z","fullTime":"2015-03-14T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"West Ham United","fixStadium":"Emirates Stadium","round":29,"fixDate":"2015-03-14T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-14T15:00:00.000Z","halfTime":"2015-03-14T15:45:00.000Z","fullTime":"2015-03-14T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Newcastle United","fixStadium":"Goodison Park","round":29,"fixDate":"2015-03-14T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-14T15:00:00.000Z","halfTime":"2015-03-14T15:45:00.000Z","fullTime":"2015-03-14T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Hull City","fixStadium":"King Power Stadium","round":29,"fixDate":"2015-03-14T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-14T15:00:00.000Z","halfTime":"2015-03-14T15:45:00.000Z","fullTime":"2015-03-14T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Aston Villa","fixStadium":"Stadium of Light","round":29,"fixDate":"2015-03-14T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-14T15:00:00.000Z","halfTime":"2015-03-14T15:45:00.000Z","fullTime":"2015-03-14T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Stoke City","fixStadium":"The Hawthorns","round":29,"fixDate":"2015-03-14T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-14T15:00:00.000Z","halfTime":"2015-03-14T15:45:00.000Z","fullTime":"2015-03-14T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Manchester City","fixStadium":"Turf Moore","round":29,"fixDate":"2015-03-14T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-14T15:00:00.000Z","halfTime":"2015-03-14T15:45:00.000Z","fullTime":"2015-03-14T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Southampton","fixStadium":"Stamford Bridge","round":29,"fixDate":"2015-03-14T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-14T15:00:00.000Z","halfTime":"2015-03-14T15:45:00.000Z","fullTime":"2015-03-14T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Tottenham Hotspur","fixStadium":"St James' Park","round":29,"fixDate":"2015-03-14T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-14T15:00:00.000Z","halfTime":"2015-03-14T15:45:00.000Z","fullTime":"2015-03-14T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Liverpool","fixStadium":"Liberty Stadium","round":29,"fixDate":"2015-03-14T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-14T15:00:00.000Z","halfTime":"2015-03-14T15:45:00.000Z","fullTime":"2015-03-14T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"West Bromwich Albion","fixStadium":"Eithad Stadium","round":30,"fixDate":"2015-03-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-21T15:00:00.000Z","halfTime":"2015-03-21T15:45:00.000Z","fullTime":"2015-03-21T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Swansea City","fixStadium":"Villa Park","round":30,"fixDate":"2015-03-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-21T15:00:00.000Z","halfTime":"2015-03-21T15:45:00.000Z","fullTime":"2015-03-21T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Arsenal","fixStadium":"St James' Park","round":30,"fixDate":"2015-03-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-21T15:00:00.000Z","halfTime":"2015-03-21T15:45:00.000Z","fullTime":"2015-03-21T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Everton","fixStadium":"Loftus Road","round":30,"fixDate":"2015-03-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-21T15:00:00.000Z","halfTime":"2015-03-21T15:45:00.000Z","fullTime":"2015-03-21T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Burnley","fixStadium":"St Mary's Stadium","round":30,"fixDate":"2015-03-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-21T15:00:00.000Z","halfTime":"2015-03-21T15:45:00.000Z","fullTime":"2015-03-21T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Crystal Palace","fixStadium":"Britannia Stadium","round":30,"fixDate":"2015-03-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-21T15:00:00.000Z","halfTime":"2015-03-21T15:45:00.000Z","fullTime":"2015-03-21T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Leicester City","fixStadium":"White Hart Lane","round":30,"fixDate":"2015-03-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-21T15:00:00.000Z","halfTime":"2015-03-21T15:45:00.000Z","fullTime":"2015-03-21T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Sunderland","fixStadium":"Boleyn Ground","round":30,"fixDate":"2015-03-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-21T15:00:00.000Z","halfTime":"2015-03-21T15:45:00.000Z","fullTime":"2015-03-21T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Manchester United","fixStadium":"Anfield","round":30,"fixDate":"2015-03-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-21T15:00:00.000Z","halfTime":"2015-03-21T15:45:00.000Z","fullTime":"2015-03-21T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Chelsea","fixStadium":"KC Stadium","round":30,"fixDate":"2015-03-21T15:00:00.000Z","fixResult":0,"kickOff":"2015-03-21T15:00:00.000Z","halfTime":"2015-03-21T15:45:00.000Z","fullTime":"2015-03-21T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Liverpool","fixStadium":"Emirates Stadium","round":31,"fixDate":"2015-04-04T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-04T15:00:00.000Z","halfTime":"2015-04-04T15:45:00.000Z","fullTime":"2015-04-04T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Tottenham Hotspur","fixStadium":"Turf Moore","round":31,"fixDate":"2015-04-04T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-04T15:00:00.000Z","halfTime":"2015-04-04T15:45:00.000Z","fullTime":"2015-04-04T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Stoke City","fixStadium":"Stamford Bridge","round":31,"fixDate":"2015-04-04T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-04T15:00:00.000Z","halfTime":"2015-04-04T15:45:00.000Z","fullTime":"2015-04-04T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Manchester City","fixStadium":"Selhurst Park","round":31,"fixDate":"2015-04-04T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-04T15:00:00.000Z","halfTime":"2015-04-04T15:45:00.000Z","fullTime":"2015-04-04T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Southampton","fixStadium":"Goodison Park","round":31,"fixDate":"2015-04-04T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-04T15:00:00.000Z","halfTime":"2015-04-04T15:45:00.000Z","fullTime":"2015-04-04T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"West Ham United","fixStadium":"King Power Stadium","round":31,"fixDate":"2015-04-04T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-04T15:00:00.000Z","halfTime":"2015-04-04T15:45:00.000Z","fullTime":"2015-04-04T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Aston Villa","fixStadium":"Old Trafford","round":31,"fixDate":"2015-04-04T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-04T15:00:00.000Z","halfTime":"2015-04-04T15:45:00.000Z","fullTime":"2015-04-04T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Newcastle United","fixStadium":"Stadium of Light","round":31,"fixDate":"2015-04-04T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-04T15:00:00.000Z","halfTime":"2015-04-04T15:45:00.000Z","fullTime":"2015-04-04T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Hull City","fixStadium":"Liberty Stadium","round":31,"fixDate":"2015-04-04T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-04T15:00:00.000Z","halfTime":"2015-04-04T15:45:00.000Z","fullTime":"2015-04-04T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Queens Park Rangers","fixStadium":"The Hawthorns","round":31,"fixDate":"2015-04-04T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-04T15:00:00.000Z","halfTime":"2015-04-04T15:45:00.000Z","fullTime":"2015-04-04T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Arsenal","fixStadium":"Turf Moore","round":32,"fixDate":"2015-04-11T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-11T15:00:00.000Z","halfTime":"2015-04-11T15:45:00.000Z","fullTime":"2015-04-11T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Newcastle United","fixStadium":"Anfield","round":32,"fixDate":"2015-04-11T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-11T15:00:00.000Z","halfTime":"2015-04-11T15:45:00.000Z","fullTime":"2015-04-11T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Manchester City","fixStadium":"Old Trafford","round":32,"fixDate":"2015-04-11T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-11T15:00:00.000Z","halfTime":"2015-04-11T15:45:00.000Z","fullTime":"2015-04-11T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Chelsea","fixStadium":"Loftus Road","round":32,"fixDate":"2015-04-11T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-11T15:00:00.000Z","halfTime":"2015-04-11T15:45:00.000Z","fullTime":"2015-04-11T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Hull City","fixStadium":"St Mary's Stadium","round":32,"fixDate":"2015-04-11T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-11T15:00:00.000Z","halfTime":"2015-04-11T15:45:00.000Z","fullTime":"2015-04-11T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Crystal Palace","fixStadium":"Stadium of Light","round":32,"fixDate":"2015-04-11T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-11T15:00:00.000Z","halfTime":"2015-04-11T15:45:00.000Z","fullTime":"2015-04-11T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Everton","fixStadium":"Liberty Stadium","round":32,"fixDate":"2015-04-11T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-11T15:00:00.000Z","halfTime":"2015-04-11T15:45:00.000Z","fullTime":"2015-04-11T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Aston Villa","fixStadium":"White Hart Lane","round":32,"fixDate":"2015-04-11T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-11T15:00:00.000Z","halfTime":"2015-04-11T15:45:00.000Z","fullTime":"2015-04-11T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Leicester City","fixStadium":"The Hawthorns","round":32,"fixDate":"2015-04-11T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-11T15:00:00.000Z","halfTime":"2015-04-11T15:45:00.000Z","fullTime":"2015-04-11T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Stoke City","fixStadium":"Boleyn Ground","round":32,"fixDate":"2015-04-11T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-11T15:00:00.000Z","halfTime":"2015-04-11T15:45:00.000Z","fullTime":"2015-04-11T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Sunderland","fixStadium":"Emirates Stadium","round":33,"fixDate":"2015-04-18T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-18T15:00:00.000Z","halfTime":"2015-04-18T15:45:00.000Z","fullTime":"2015-04-18T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Queens Park Rangers","fixStadium":"Villa Park","round":33,"fixDate":"2015-04-18T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-18T15:00:00.000Z","halfTime":"2015-04-18T15:45:00.000Z","fullTime":"2015-04-18T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Manchester United","fixStadium":"Stamford Bridge","round":33,"fixDate":"2015-04-18T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-18T15:00:00.000Z","halfTime":"2015-04-18T15:45:00.000Z","fullTime":"2015-04-18T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"West Bromwich Albion","fixStadium":"Selhurst Park","round":33,"fixDate":"2015-04-18T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-18T15:00:00.000Z","halfTime":"2015-04-18T15:45:00.000Z","fullTime":"2015-04-18T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Burnley","fixStadium":"Goodison Park","round":33,"fixDate":"2015-04-18T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-18T15:00:00.000Z","halfTime":"2015-04-18T15:45:00.000Z","fullTime":"2015-04-18T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Liverpool","fixStadium":"KC Stadium","round":33,"fixDate":"2015-04-18T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-18T15:00:00.000Z","halfTime":"2015-04-18T15:45:00.000Z","fullTime":"2015-04-18T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Swansea City","fixStadium":"King Power Stadium","round":33,"fixDate":"2015-04-18T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-18T15:00:00.000Z","halfTime":"2015-04-18T15:45:00.000Z","fullTime":"2015-04-18T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"West Ham United","fixStadium":"Eithad Stadium","round":33,"fixDate":"2015-04-18T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-18T15:00:00.000Z","halfTime":"2015-04-18T15:45:00.000Z","fullTime":"2015-04-18T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Tottenham Hotspur","fixStadium":"St James' Park","round":33,"fixDate":"2015-04-18T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-18T15:00:00.000Z","halfTime":"2015-04-18T15:45:00.000Z","fullTime":"2015-04-18T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Southampton","fixStadium":"Britannia Stadium","round":33,"fixDate":"2015-04-18T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-18T15:00:00.000Z","halfTime":"2015-04-18T15:45:00.000Z","fullTime":"2015-04-18T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Chelsea","fixStadium":"Emirates Stadium","round":34,"fixDate":"2015-04-25T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-25T15:00:00.000Z","halfTime":"2015-04-25T15:45:00.000Z","fullTime":"2015-04-25T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Leicester City","fixStadium":"Turf Moore","round":34,"fixDate":"2015-04-25T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-25T15:00:00.000Z","halfTime":"2015-04-25T15:45:00.000Z","fullTime":"2015-04-25T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Hull City","fixStadium":"Selhurst Park","round":34,"fixDate":"2015-04-25T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-25T15:00:00.000Z","halfTime":"2015-04-25T15:45:00.000Z","fullTime":"2015-04-25T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Manchester United","fixStadium":"Goodison Park","round":34,"fixDate":"2015-04-25T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-25T15:00:00.000Z","halfTime":"2015-04-25T15:45:00.000Z","fullTime":"2015-04-25T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Aston Villa","fixStadium":"Eithad Stadium","round":34,"fixDate":"2015-04-25T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-25T15:00:00.000Z","halfTime":"2015-04-25T15:45:00.000Z","fullTime":"2015-04-25T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"Swansea City","fixStadium":"St James' Park","round":34,"fixDate":"2015-04-25T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-25T15:00:00.000Z","halfTime":"2015-04-25T15:45:00.000Z","fullTime":"2015-04-25T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"West Ham United","fixStadium":"Loftus Road","round":34,"fixDate":"2015-04-25T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-25T15:00:00.000Z","halfTime":"2015-04-25T15:45:00.000Z","fullTime":"2015-04-25T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Tottenham Hotspur","fixStadium":"St Mary's Stadium","round":34,"fixDate":"2015-04-25T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-25T15:00:00.000Z","halfTime":"2015-04-25T15:45:00.000Z","fullTime":"2015-04-25T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Sunderland","fixStadium":"Britannia Stadium","round":34,"fixDate":"2015-04-25T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-25T15:00:00.000Z","halfTime":"2015-04-25T15:45:00.000Z","fullTime":"2015-04-25T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Liverpool","fixStadium":"The Hawthorns","round":34,"fixDate":"2015-04-25T15:00:00.000Z","fixResult":0,"kickOff":"2015-04-25T15:00:00.000Z","halfTime":"2015-04-25T15:45:00.000Z","fullTime":"2015-04-25T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Everton","fixStadium":"Villa Park","round":35,"fixDate":"2015-05-02T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-02T15:00:00.000Z","halfTime":"2015-05-02T15:45:00.000Z","fullTime":"2015-05-02T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Crystal Palace","fixStadium":"Stamford Bridge","round":35,"fixDate":"2015-05-02T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-02T15:00:00.000Z","halfTime":"2015-05-02T15:45:00.000Z","fullTime":"2015-05-02T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Arsenal","fixStadium":"KC Stadium","round":35,"fixDate":"2015-05-02T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-02T15:00:00.000Z","halfTime":"2015-05-02T15:45:00.000Z","fullTime":"2015-05-02T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Newcastle United","fixStadium":"King Power Stadium","round":35,"fixDate":"2015-05-02T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-02T15:00:00.000Z","halfTime":"2015-05-02T15:45:00.000Z","fullTime":"2015-05-02T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Queens Park Rangers","fixStadium":"Anfield","round":35,"fixDate":"2015-05-02T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-02T15:00:00.000Z","halfTime":"2015-05-02T15:45:00.000Z","fullTime":"2015-05-02T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"West Bromwich Albion","fixStadium":"Old Trafford","round":35,"fixDate":"2015-05-02T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-02T15:00:00.000Z","halfTime":"2015-05-02T15:45:00.000Z","fullTime":"2015-05-02T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Southampton","fixStadium":"Stadium of Light","round":35,"fixDate":"2015-05-02T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-02T15:00:00.000Z","halfTime":"2015-05-02T15:45:00.000Z","fullTime":"2015-05-02T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Stoke City","fixStadium":"Liberty Stadium","round":35,"fixDate":"2015-05-02T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-02T15:00:00.000Z","halfTime":"2015-05-02T15:45:00.000Z","fullTime":"2015-05-02T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Manchester City","fixStadium":"The Hawthorns","round":35,"fixDate":"2015-05-02T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-02T15:00:00.000Z","halfTime":"2015-05-02T15:45:00.000Z","fullTime":"2015-05-02T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Burnley","fixStadium":"Boleyn Ground","round":35,"fixDate":"2015-05-02T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-02T15:00:00.000Z","halfTime":"2015-05-02T15:45:00.000Z","fullTime":"2015-05-02T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"Swansea City","fixStadium":"Emirates Stadium","round":36,"fixDate":"2015-05-09T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-09T15:00:00.000Z","halfTime":"2015-05-09T15:45:00.000Z","fullTime":"2015-05-09T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"West Ham United","fixStadium":"Villa Park","round":36,"fixDate":"2015-05-09T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-09T15:00:00.000Z","halfTime":"2015-05-09T15:45:00.000Z","fullTime":"2015-05-09T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Liverpool","fixStadium":"Stamford Bridge","round":36,"fixDate":"2015-05-09T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-09T15:00:00.000Z","halfTime":"2015-05-09T15:45:00.000Z","fullTime":"2015-05-09T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Manchester United","fixStadium":"Selhurst Park","round":36,"fixDate":"2015-05-09T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-09T15:00:00.000Z","halfTime":"2015-05-09T15:45:00.000Z","fullTime":"2015-05-09T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Sunderland","fixStadium":"Goodison Park","round":36,"fixDate":"2015-05-09T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-09T15:00:00.000Z","halfTime":"2015-05-09T15:45:00.000Z","fullTime":"2015-05-09T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Burnley","fixStadium":"KC Stadium","round":36,"fixDate":"2015-05-09T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-09T15:00:00.000Z","halfTime":"2015-05-09T15:45:00.000Z","fullTime":"2015-05-09T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Southampton","fixStadium":"King Power Stadium","round":36,"fixDate":"2015-05-09T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-09T15:00:00.000Z","halfTime":"2015-05-09T15:45:00.000Z","fullTime":"2015-05-09T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Queens Park Rangers","fixStadium":"Eithad Stadium","round":36,"fixDate":"2015-05-09T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-09T15:00:00.000Z","halfTime":"2015-05-09T15:45:00.000Z","fullTime":"2015-05-09T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"West Bromwich Albion","fixStadium":"St James' Park","round":36,"fixDate":"2015-05-09T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-09T15:00:00.000Z","halfTime":"2015-05-09T15:45:00.000Z","fullTime":"2015-05-09T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Tottenham Hotspur","fixStadium":"Britannia Stadium","round":36,"fixDate":"2015-05-09T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-09T15:00:00.000Z","halfTime":"2015-05-09T15:45:00.000Z","fullTime":"2015-05-09T16:45:00.000Z"},
    {"homeTeam":"Burnley","awayTeam":"Stoke City","fixStadium":"Turf Moore","round":37,"fixDate":"2015-05-16T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-16T15:00:00.000Z","halfTime":"2015-05-16T15:45:00.000Z","fullTime":"2015-05-16T16:45:00.000Z"},
    {"homeTeam":"Liverpool","awayTeam":"Crystal Palace","fixStadium":"Anfield","round":37,"fixDate":"2015-05-16T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-16T15:00:00.000Z","halfTime":"2015-05-16T15:45:00.000Z","fullTime":"2015-05-16T16:45:00.000Z"},
    {"homeTeam":"Manchester United","awayTeam":"Arsenal","fixStadium":"Old Trafford","round":37,"fixDate":"2015-05-16T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-16T15:00:00.000Z","halfTime":"2015-05-16T15:45:00.000Z","fullTime":"2015-05-16T16:45:00.000Z"},
    {"homeTeam":"Queens Park Rangers","awayTeam":"Newcastle United","fixStadium":"Loftus Road","round":37,"fixDate":"2015-05-16T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-16T15:00:00.000Z","halfTime":"2015-05-16T15:45:00.000Z","fullTime":"2015-05-16T16:45:00.000Z"},
    {"homeTeam":"Southampton","awayTeam":"Arsenal","fixStadium":"St Mary's Stadium","round":37,"fixDate":"2015-05-16T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-16T15:00:00.000Z","halfTime":"2015-05-16T15:45:00.000Z","fullTime":"2015-05-16T16:45:00.000Z"},
    {"homeTeam":"Sunderland","awayTeam":"Leicester City","fixStadium":"Stadium of Light","round":37,"fixDate":"2015-05-16T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-16T15:00:00.000Z","halfTime":"2015-05-16T15:45:00.000Z","fullTime":"2015-05-16T16:45:00.000Z"},
    {"homeTeam":"Swansea City","awayTeam":"Manchester City","fixStadium":"Liberty Stadium","round":37,"fixDate":"2015-05-16T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-16T15:00:00.000Z","halfTime":"2015-05-16T15:45:00.000Z","fullTime":"2015-05-16T16:45:00.000Z"},
    {"homeTeam":"Tottenham Hotspur","awayTeam":"Hull City","fixStadium":"White Hart Lane","round":37,"fixDate":"2015-05-16T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-16T15:00:00.000Z","halfTime":"2015-05-16T15:45:00.000Z","fullTime":"2015-05-16T16:45:00.000Z"},
    {"homeTeam":"West Bromwich Albion","awayTeam":"Chelsea","fixStadium":"The Hawthorns","round":37,"fixDate":"2015-05-16T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-16T15:00:00.000Z","halfTime":"2015-05-16T15:45:00.000Z","fullTime":"2015-05-16T16:45:00.000Z"},
    {"homeTeam":"West Ham United","awayTeam":"Everton","fixStadium":"Boleyn Ground","round":37,"fixDate":"2015-05-16T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-16T15:00:00.000Z","halfTime":"2015-05-16T15:45:00.000Z","fullTime":"2015-05-16T16:45:00.000Z"},
    {"homeTeam":"Arsenal","awayTeam":"West Bromwich Albion","fixStadium":"Emirates Stadium","round":38,"fixDate":"2015-05-24T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-24T15:00:00.000Z","halfTime":"2015-05-24T15:45:00.000Z","fullTime":"2015-05-24T16:45:00.000Z"},
    {"homeTeam":"Aston Villa","awayTeam":"Burnley","fixStadium":"Villa Park","round":38,"fixDate":"2015-05-24T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-24T15:00:00.000Z","halfTime":"2015-05-24T15:45:00.000Z","fullTime":"2015-05-24T16:45:00.000Z"},
    {"homeTeam":"Chelsea","awayTeam":"Sunderland","fixStadium":"Stamford Bridge","round":38,"fixDate":"2015-05-24T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-24T15:00:00.000Z","halfTime":"2015-05-24T15:45:00.000Z","fullTime":"2015-05-24T16:45:00.000Z"},
    {"homeTeam":"Crystal Palace","awayTeam":"Swansea City","fixStadium":"Selhurst Park","round":38,"fixDate":"2015-05-24T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-24T15:00:00.000Z","halfTime":"2015-05-24T15:45:00.000Z","fullTime":"2015-05-24T16:45:00.000Z"},
    {"homeTeam":"Everton","awayTeam":"Tottenham Hotspur","fixStadium":"Goodison Park","round":38,"fixDate":"2015-05-24T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-24T15:00:00.000Z","halfTime":"2015-05-24T15:45:00.000Z","fullTime":"2015-05-24T16:45:00.000Z"},
    {"homeTeam":"Hull City","awayTeam":"Manchester United","fixStadium":"KC Stadium","round":38,"fixDate":"2015-05-24T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-24T15:00:00.000Z","halfTime":"2015-05-24T15:45:00.000Z","fullTime":"2015-05-24T16:45:00.000Z"},
    {"homeTeam":"Leicester City","awayTeam":"Queens Park Rangers","fixStadium":"King Power Stadium","round":38,"fixDate":"2015-05-24T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-24T15:00:00.000Z","halfTime":"2015-05-24T15:45:00.000Z","fullTime":"2015-05-24T16:45:00.000Z"},
    {"homeTeam":"Manchester City","awayTeam":"Southampton","fixStadium":"Eithad Stadium","round":38,"fixDate":"2015-05-24T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-24T15:00:00.000Z","halfTime":"2015-05-24T15:45:00.000Z","fullTime":"2015-05-24T16:45:00.000Z"},
    {"homeTeam":"Newcastle United","awayTeam":"West Ham United","fixStadium":"St James' Park","round":38,"fixDate":"2015-05-24T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-24T15:00:00.000Z","halfTime":"2015-05-24T15:45:00.000Z","fullTime":"2015-05-24T16:45:00.000Z"},
    {"homeTeam":"Stoke City","awayTeam":"Liverpool","fixStadium":"Britannia Stadium","round":38,"fixDate":"2015-05-24T15:00:00.000Z","fixResult":0,"kickOff":"2015-05-24T15:00:00.000Z","halfTime":"2015-05-24T15:45:00.000Z","fullTime":"2015-05-24T16:45:00.000Z"}];

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

//PRIVATE FUNCTIONS

//todo: schedule function to clear out all old predictions and fixtures after the end of a season
function _CheckEndOfSeasonClearOut() {

    var today = moment();
    var seasonStart
    var seasonEndFromToday = moment([today.year(), 04, 24]); //assume the 24th, change this

    if (today.isAfter(seasonEndFromToday)) {

        //then the season has ended, clear out all old data
        seasonStart = moment([today.year(), 07, 01]);

        Fixture.remove({}, function () {
            console.log("Removed all old fixtures");
        });

        Predictions.remove({}, function () {
            console.log("Removed all old predictions");
        });
    }

}

//gets run everyday, to check for any new fixtures and ensure old fixtures are up to date with 3rd party game API
function _getNewUpdateExistingFixtures() {

    //these are decided automatically, so not supplied as parameters
    var fromDate;
    var today = moment();
    var seasonEnd =  moment([today.year(), 04, 24])

    //todo: dates here need work
    if (today.isAfter(seasonEnd)) {
        seasonEnd = moment([today.year() + 1, 04, 31]);
    }

    //set the seasonend

    //First check for any new fixtures which may have been scheduled

    //todo: implement this to allow for more leagues than just epl, e.g la liga
    //switch(competition){
    //    case "EPL":
    //        competitionCode = '1204';
    //        break;
    //    default:
    //        competitionCode = '1204'; //default to epl
    //        console.log("The supplied competition name does not map to any supported competition");
    //        break;
    //    //implement throwing exceptions here
    //    //add more cases as the app supports more competitions
    //}

    //just do this for the epl for now
    //todo: make this generic for other football leagues or even sports

    //if there are no existing fixtures, then get new fixtures from today or get from day after latest fixture
    Fixture.find({}).sort({'fixDate' : 1}).exec(function(error, fixtures) {
        if (fixtures.length > 0) {
            console.log("Fixtures already existed, setting dates based on these.")
            //then get to and from dates for the api query from existing
            //we only want new fixtures if there are any, so fromDate is the latest date in fixtures
            //THE RESULTS MUST BE SORTED FOR THIS LOGIC TO BE VALID
            console.log("Number of fixtures already existed: " + fixtures.length);

            fromDate = moment(fixtures[fixtures.length - 1].fixDate);

            //season end only used to check if we are trying to get matches from beyond the end of the season.
            if (fromDate.isSame(seasonEnd)|| fromDate.isAfter(seasonEnd)) {
                return console.log('No new fixtures to get, just checking existing ones are up to date!');
            } else {
                //increment from date by a day and get fixtures from this point onwards

                //FROM NEXT DAY IN SEASON - MID SEASON
                fromDate.add(1, 'day');
            }
        } else {
            //FROM TODAY

            //if no fixtures exist already, then  set default dates
            fromDate = moment(); //default getting fixtures from today
            //remember these all run async, need callbacks
        }

        //Check for season rollover
        if (today.isAfter(seasonEnd)) {
            seasonEnd = moment([today.year() + 1, 04, 31]);

            //set the from date to be the start of the new season
            fromDate = moment([today.year(), 07, 01]);
        }

        console.log("Now checking for new fixtures.");
        //want to check for new but ALWAYS  run update even if no new matches, regardless
        //to use promises to fix the callback hell that this has turned into

        var newFixtures = _checkForProcessNewFixtures(fromDate);

        //once the api request promise is fulfilled
        newFixtures.then(
            function(){
                //once any new fixtures have been added and found
                //todo: remove no new added into success reponse, to remove below promise reject function.

                console.log("TOP LEVEL: PROMISE FULFILLED - NEW FIXTURES ADDED - CHECKING FOR UPDATES TO EXISTING FIXTURES." )
                _compareAndUpdateFixtures();
            },
            function(error){
                //handle the error, just print to console and return
                console.log("Checking for new fixtures returned an no new fixtures or an error")

                //now check for updates to existing fixtures
                console.log("TOP LEVEL: PROMISE REJECTED - NO NEW FIXTURES FOUND - CHECKING FOR UPDATES TO EXISTING FIXTURES." )
                _compareAndUpdateFixtures();
            });
    });

}

//todo: write a wrapper function for the football api
//dates are moment dates
//will only ever call up to the end of the season
function _getFootballApiFixtures(fromDate) {

    var competitionCode = '1204';
    var deferred = Q.defer();

    //Sort out the date up to which we will retrieve fixtures, always to the end of the season
    //todo: make this generic for different leagues
    var today = new Date ();
    var thisYear = today.getFullYear();
    //toDate = moment([lastYear, 08, 13]); //this league ends 24 may this year
    var toDate = moment([thisYear, 04, 31]); //this league ends 24 may this year

    today = moment(); //cast today into moment date type
    //check that current season has not ended
    if (today.isAfter(toDate)) {
        //then the season has finished, use the end of next season
        console.log("This season has finished, moving the end range for dates to get fixtures between to next year, end of next season");
        toDate = moment([thisYear + 1, 04, 31]);

        //from date should now be the start of the next season
        console.log("Also moving the fromDate to be the start of the next season.");
        fromDate = moment([thisYear, 07, 01]);
    }

    console.log("Will be retrieving fixtures up to: " + toDate.toString());

    console.log("Now contacting 3rd party API football-api to get real-world fixture data.");

    //parse to and from dates to proper format
    var callFromDate = fromDate.format("DD.MM.YYYY");
    var callToDate = toDate.format("DD.MM.YYYY");
    console.log("The dates being sent in the API query are: " + callFromDate + " and " + callToDate);

    var options = {
        host: 'football-api.com',
        path: '/api/?Action=fixtures&APIKey=2760810b-be47-82d7-db48d00daa1c&comp_id=' + competitionCode +
        '&from_date=' + callFromDate + '&to_date=' + callToDate,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    var obj = {}; //variable to hold the returned json

    console.log("Now attempting to make API call to endpoint: " + options.path);

    //make the call to the football-api API
    http.get(options, function (response) {

        var output = '';
        var seasonFixtures = [];

        console.log(options.host + ':' + response.statusCode);
        response.setEncoding('utf8');

        response.on('data', function (chunk) {
            output += chunk;
        });

        response.on('end', function () {
            //process results from football-api
            obj = JSON.parse(output);
            //console.log("Results returned from server: " + JSON.stringify(obj));

            //if nothing went wrong, process returned fixtures
            //this is api specific
            if (obj.ERROR == 'OK') { //nothing went wrong
                seasonFixtures = obj.matches;

                //if user has also supplied a list of local fixtures to compare to,
                console.log("The callback is to UPDATE EXISTING FIXTURES");

                //if some new fixtures were found, return them
                deferred.resolve(seasonFixtures);
                //} else if(obj.ERROR == 'no matches found in that day') {
                //    console.log("No new matches were found, so just checking for updates to existing ones.");
                //    deferred.resolve();
            } else {
                console.log("API - ERROR OR NO NEW FIXTURES: \n\t " + obj.ERROR + " REJECTING PROMISE");
                //if no new fixtures, or there is an error, reject the promise
                deferred.reject(obj.ERROR);
            }
        });
    });

    //Always return the promise
    return deferred.promise;
}

//takes a list of fixtures from the api, parses them and adds them to the local database
function _checkForProcessNewFixtures(fromDate) {

    console.log("\nFUNCTION: CHECKING FOR NEW FIXTURES\n");

    var deferred = Q.defer();
    var fixturesToStore = [];
    var seasonEnd = moment('24.05.2015', 'DD.MM.YYYY'); //todo: maybe pass this is as a parameter

    //go and get any new fixtures from api
    var getAnyNewFixs = _getFootballApiFixtures(fromDate);

    //process any new fixtures into the database
    getAnyNewFixs.then(function(seasonFixtures) {
        //sort the results
        seasonFixtures = _sortByMomentDate(seasonFixtures, 'match_formatted_date');
        seasonFixtures.reverse(); //todo: replace this with sorting the properly (stop being lazy

        console.log("Fixtures from server have now been sorted by date");

        //loop over returned fixtures and parse into our format and store in db
        var currentFixture = null; //todo: check if better to initialize to null?
        var previousFixtureDate = seasonEnd;
        var previousFixtureRound = 38;
        var fixtureRound = 38;

        //get fixtures from today until end of season...
        for (var i = 0; i < seasonFixtures.length; i++) {

            //console.log("Iteration of fixtures: " + i);
            //for each fixture from the 3rd party api, extract relevant details, construct doc and save to db
            currentFixture = seasonFixtures[i];

            //make the returned fix date into a usable moment.js date
            var thisFixtureDate = moment(currentFixture.match_formatted_date, "DD.MM.YYYY");
            console.log("\nCurrent fixture date: " + thisFixtureDate.toString());

            //using moment.js, find the difference in weeks between the last game and this one
            //if there is a previous fixture (not the first fixture of season which goes in round 1)
            //then work out which round this fixture belongs in
            //assumes chain and order of fixtures. BE SURE TO SORT.
            if (previousFixtureDate) {
                //then work out this fixture's round based on the previous one

                //find the monday which follows the previous fixture

                //if the previous date is already a monday, this is the end of the previous fixtures' end
                var previousTuesdayFound = false;
                var previousTuesday;
                var tempNextDay = moment(previousFixtureDate); //clone date properly, new object, not new pointer

                //this loop should run until the monday after the previous fixture is found
                //console.log("Now looping to find the Tuesday which follows the previous fixture, which was: " +
                //previousFixtureDate.toString());

                while (!previousTuesdayFound) {
                    if (tempNextDay.day() == 2) { //if the date is a monday
                        //console.log("The previous Tuesday to the previous fixture has been found to be: " +
                        //tempNextDay.toString() + "\n Exiting while loop.");

                        //assign this date as following monday (end of previous round) - CLONE OBJECT
                        previousTuesday = moment(tempNextDay);

                        //close the loop
                        previousTuesdayFound = true;
                    } else {
                        //console.log("Day " + tempNextDay.day() + " was not a previous Tuesday, iterating")
                        tempNextDay.subtract(1, 'day');
                    }
                }

                //if current fixture is after this monday then place it in the next round else in same round
                if (thisFixtureDate < previousTuesday) {
                    //console.log("The previous (descending so in time, next) fixture round is: " + previousFixtureRound);
                    fixtureRound = previousFixtureRound - 1; //todo: check if ++ would mute original
                    //console.log("This fixture belongs in the previous round: " + fixtureRound);
                } else {
                    fixtureRound = previousFixtureRound;
                    //console.log("The previous (descending so in time, next) fixture round is: " + previousFixtureRound);
                    //console.log("This fixture belongs in the same round as the previous fixture: " + fixtureRound);
                }
            }

            //console.log("This fixture belongs to gameweek/round: " + fixtureRound);

            //todo: these are not being parsed properly
            //parse match times for storage
            var kickOffTime = moment(thisFixtureDate)

            //parse this differently
            console.log("Fixture match time: " + currentFixture.match_time);
            console.log("Fixture match hour: " + currentFixture.match_time.substr(0, 2));
            console.log("Fixture match minutes: " + currentFixture.match_time.substr(3, 4))
            kickOffTime.hours(currentFixture.match_time.substr(0, 2)); //todo: think misusing substr, fix
            kickOffTime.minutes(currentFixture.match_time.substr(3, 4));
            console.log("The proposed kick off time is: " + kickOffTime.toString());

            var halfTime = moment(kickOffTime);
            halfTime.add(45, 'minutes');
            console.log("This fixture have half time at: " + halfTime.toString());

            var fullTime = moment(kickOffTime);
            fullTime.add(90, 'minutes');
            console.log("The fixture should end at: " + fullTime.toString());

            //cast dates and times here first
            var convertedDate = thisFixtureDate.toDate();
            var kickOffSave = kickOffTime.toDate(); //check if mutable as others, if so delete variables
            var halfTimeSave = halfTime.toDate();
            var fullTimeSave = fullTime.toDate();

            //extract the result and put into usable form
            var tempAPIResult = currentFixture.match_ft_score;
            //console.log("The result of the relelvant fixture from the football-api.com API is: " + tempAPIResult);

            //todo: extract this out into a function as used in multiple places - Stay DRY!
            var homeTeamResult = tempAPIResult.charAt(1);
            var awayTeamResult = tempAPIResult.charAt(3);

            var localFixResult = 0;

            //Now process this result into a usable format for our server (1, 2 or 3)
            //1 = home win, 2 = away win, 3 = draw
            if (homeTeamResult > awayTeamResult) {
                //then this was a home win
                localFixResult = 1;
                //console.log("The match was a home win.");
            } else if (homeTeamResult < awayTeamResult) {
                //then this was an away win
                localFixResult = 2;
                //console.log("The match was an away win.");
            } else if (homeTeamResult == awayTeamResult) {
                //then this was a draw
                localFixResult = 3;
                //console.log("The match was a draw.");
            }

            //now construct new object to add
            //todo: decalre new fixture above and then redeclare on each iteration for efficiency?
            var newFixture = {
                homeTeam: currentFixture.match_localteam_name,
                awayTeam: currentFixture.match_visitorteam_name,
                round: fixtureRound,
                fixDate: convertedDate,
                fixResult: localFixResult, //for no current result
                kickOff: kickOffSave,
                halfTime: halfTimeSave,
                fullTime: fullTimeSave
            };

            //console.log("The fixture being added to the database is: \n" + JSON.stringify(newFixture));

            fixturesToStore.push(JSON.stringify(newFixture));

            //Now move on to the next fixture

            //Assign the previous fixture for the next iteration
            previousFixtureDate = thisFixtureDate;
            previousFixtureRound = fixtureRound;
        }

        //the new fixtures to get added to our database
        fixturesToStore = "[" + fixturesToStore + "]";
        //console.log("Fixtures about to be saved are: " + fixturesToStore);

        fixturesToStore = JSON.parse(fixturesToStore);

        //once the loop has run it's course and created the whole list of fixtures, save to db
        //need to access the MongoDB driver directly as large dataset crashes .create mongoose method
        Fixture.collection.insert(fixturesToStore, function (err, fixtures) {
            if (err) {
                console.log(err);
                //reject the promise, no data to return
                deferred.reject();
            }

            console.log("All of the new fixtures were saved to the database successfully!");

            console.log("Now scheduling these fixtures to have their scores calculated upon completion");
            //now iterate over each inserted fixture and for when finishing, to get results and tell users
            for (var i = 0; i < fixturesToStore.length; i++) {
                var fixture = fixturesToStore[i];

                console.log("Scheduling to check results and score users for fixture:" + fixture.fullTime);

                //todo: also schedule for before kick off and half time notifictions here
                agenda.schedule(fixture.fullTime, 'score fixture predictors', {fixture: fixture});
            }

            //fulfill the promise, no data to return
            deferred.resolve();
        });

        return deferred.promise;
    }, function(error) {

        console.log("\n\t FN: CHECKING FOR NEW FIXS: \n\tPROMISE WAS REJECTED ");

        //then reject the promise and return the error
        deferred.reject(error);
    });

    //always return a promise, regardless
    return deferred.promise;
}

//function to check existing fixtures and live schedule, to update any changes to fixtures
//SCHEDULE THIS TO BE RUN REGULARLY TO KEEP OUR FIXTURE DATA UP TO DATE.
//Given fixtures that have yet to be played, checks api for any changes to them.
//fixtures range from 45 prior to present moment up to end of season
function _compareAndUpdateFixtures() {

    console.log("\n FUNCTION: COMPARING AND UPDATING FIXTURES \n");

    //get all fixtures from our db FROM NOW, - 45 MINUTES AGO
    var fromDate = moment();
    fromDate.subtract(45, 'minutes'); //get games which may be altered whilst in play

    //get fixtures from the api
    var fetchFixtures = _getFootballApiFixtures(fromDate);

    fetchFixtures.then(function(APIFixtures)  {

        //get local fixtures

        Fixture.find({}, function(error, localFixtures) {
            //check to see that this is date is later than from date

            //for each fixture down from the api
            //always better to have declarations at scope start, the reassign as necessary
            var localFixture;
            var APIFixture;
            for (var i = 0; i < APIFixtures.length; i++) {
                APIFixture = APIFixtures[i];
                console.log("\nThe current fixture under comparison from the API is: \n" +
                    "\tMatch date : " + (APIFixture.match_formatted_date) +
                    "\n\tMatch time : " + (APIFixture.match_time));

                //find corresponding locally stored match in db using home and away team
                localFixture = underscore.findWhere(localFixtures, {
                    homeTeam: APIFixture.match_localteam_name,
                    awayTeam: APIFixture.match_visitorteam_name
                });

                var localFixDate = moment(localFixture.fixDate);

                //if none is found, throw an error
                if (!localFixture) {
                    console.log("ERROR, MATCHING LOCALLY STORED FIXTURE COULD NOT BE FOUND")
                    return "error" //LOOK up if there is a better way of doing this
                } else if (localFixDate.isBefore(fromDate)) {
                    console.log("ERROR, MATCHING LOCALLY STORED FIXTURE WAS IN THE PAST, ALREADY FINISHED")
                    return "error" //LOOK up if there is a better way of doing this
                } else {
                    console.log("The matching locally stored fixture to the current API fixture being compared to is: \n" +
                        "\tMatch date: " + localFixture.fixDate +
                        "\n\tMatch time: " + localFixture.kickOff);
                }

                //now perform comparison and see if the fixture needs to be updated in our local database

                //parse date and time of the api fixture
                var APIFixDate = moment(APIFixture.match_formatted_date, 'DD.MM.YYYY');
                var APIFixTime = moment(APIFixDate); //clone date
                APIFixTime.hours(APIFixture.match_time.substr(0,2));
                APIFixTime.minutes(APIFixture.match_time.substr(3,4));

                //parse the date and time of the matching locally stored fixture
                var localFixTime = moment(localFixture.kickOff);

                //if this api fixture has different date or time to locally stored one
                //perform check for date and time separately/intelligently so that both get updated.
                //if dates are different
                //OR if dates are same but TIMES have changed, then update
                if (!APIFixDate.isSame(localFixDate)) { //then t

                    console.log("STORED FIXTURE DIFFERS FROM SAME MATCH ON API - ON DIFFERENT DAY")
                    //update the date and time of the locally stored fixture and save changes (Fixture.update)
                    localFixture.fixDate = APIFixDate.toDate();

                    //update kick off, half time and fulltime
                    localFixture.kickOff = APIFixTime.toDate();
                    APIFixTime.add(45, 'minutes');
                    localFixture.halfTime = APIFixTime.toDate();
                    APIFixTime.add(45, 'minutes');
                    localFixture.fullTime = APIFixTime.toDate();

                    //now save the changes that have been made to the fixture to the local database
                    Fixture.update({"_id": localFixture._id}, localFixture, function (err) {

                        //if there is an error, simply return straight back to the user
                        if (err) return console.log("An error occurred: " + err);

                        //fixture should now have been given the correct result
                        console.log("The fixture with id: " + fixture.id + " has now been updated to the new date and time");

                        //once the fixture has been updated, invoke the callback function
                        console.log("The fixture has successfully been given the correct result, invoking callback");

                        //Now cancel and reschedule
                        //find and cancel the scheduled job(s) for the old date and time
                        agenda.cancel({"nextRunAt": localFixture.fullTime}, function (error, numRemoved) {
                            if (numRemoved != 1) {
                                console.log("ERROR: " + numRemoved + " jobs were cancelled, only 1 was supposed to be cancelled.");
                            }
                            console.log("Cancelled the job scheduled to run at original end of fixture");
                        });

                        //todo: schedule push notification for kick and half time
                        //reschedule the job(s) to score the fixture at it's new finishing time
                        agenda.schedule(localFixture.fullTime, 'score fixture predictors', {fixture: JSON.stringify(fixture)});

                        console.log("There was a scheduled change made to fixture, this change has been accounted for, fix updated.");

                    });

                } else if (APIFixDate.isSame(localFixDate) && !APIFixTime.isSame(localFixTime)) { //then t

                    console.log("STORED FIXTURE DIFFERS FROM SAME MATCH ON API - ON DIFFERENT TIME ON THE SAME DAY")

                    //update the date and time of the locally stored fixture and save changes (Fixture.update)
                    localFixture.fixDate = APIFixDate.toDate();

                    //update kick off, half time and fulltime
                    localFixture.kickOff = APIFixTime.toDate();
                    APIFixTime.add(45, 'minutes');
                    localFixture.halfTime = APIFixTime.toDate();
                    APIFixTime.add(45, 'minutes');
                    localFixture.fullTime = APIFixTime.toDate();

                    //now save the changes that have been made to the fixture to the local database
                    Fixture.update({"_id": localFixture._id}, localFixture, function (err) {

                        //if there is an error, simply return straight back to the user
                        if (err) return console.log("An error occurred: " + err);

                        //fixture should now have been given the correct result
                        console.log("The fixture with id: " + fixture.id + " has now been updated to the new date and time");

                        //once the fixture has been updated, invoke the callback function
                        console.log("The fixture has successfully been given the correct result, invoking callback");

                        //Now cancel and reschedule
                        //find and cancel the scheduled job(s) for the old date and time
                        agenda.cancel({"nextRunAt": localFixture.fullTime}, function (error, numRemoved) {
                            if (numRemoved != 1) {
                                console.log("ERROR: " + numRemoved + " jobs were cancelled, only 1 was supposed to be cancelled.");
                            }
                            console.log("Cancelled the job scheduled to run at original end of fixture");
                        });

                        //todo: schedule push notification for kick and half time
                        //reschedule the job(s) to score the fixture at it's new finishing time
                        agenda.schedule(localFixture.fullTime, 'score fixture predictors', {fixture: JSON.stringify(fixture)});

                        console.log("There was a scheduled change made to fixture, this change has been accounted for, fix updated.");

                    });
                } else {
                    console.log("LOCALLY STORED MATCH IS SAME AS THE ONE FROM API, NO UPDATE NEEDED.")
                }
            }
        });
    }); //todo: add error function for promise rejection in here.
}

//todo: make scheduler schedule 3 jobs per fixture.

//this function will be sheduled to run for each fixture.
//function to take a local fixture and retrieve the live result from 3rd party football-api
//once this has been tested, pass in a callback and test it upon success.
function _getFixtureResult(fixtureData, callback) {

    console.log("Now attempting to get the live result for the fixture: " + fixtureData);

    //1. Query the API to get matches on the given fixture date

    //parse the date into an object
    console.log("Now parsing the fixture into an object.");
    var fixture = JSON.parse(fixture);

    console.log("Now contacting 3rd party API football-api to get real-world fixture data.");

    var fixtureDate = _formattedDate(fixture.fixDate);
    console.log("The formatted date being sent in the API query is: " + fixtureDate);

    //check that the fixture occured in past, if not, exit
    var today = new Date();
    if (!fixtureDate <= fixture.fullTime) {
        //then the fixture has not finished, return an error
        return "The fixture has not yet taken place and can not have a result set for it"
    }

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

                    //todo: extract this out into a function
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
                        _scheduleScorePredictingUsers(fixture, callback);

                    });
                }
            }

            if (!fixFound) {
                return "No live results found for this fixture.";
            }
        });
    });
}

//find all users who made a prediction on a given fixture
//similar to the above function but only takes in a single fixture
function _scheduleScorePredictingUsers(fixture, callback) {

    //This should only return users who have made a prediction for the given fixture
    User.find({'predictions.fixture': fixture._id}, function (error, users) {
        if (error || users == null) {
            console.log("Error finding users who made predicitons: " + error);
            return
        } else {
            //for testing
            console.log("The number of returned users is: " + users.length);
            console.log("The users returned are: " + JSON.stringify(users));

            //invokes the score adder function passing in all users who are to be scored, the fixture
            _scoreAdder(0, users, fixture, function () {
                //feeds the callback method into the scoreadder method
                callback(null, 202); //this is fed in from the highest level
            });


        }
    });

    //At same time as above, asynchronously find all users who did not make a prediction for this fixture
    User.find({'predictions.fixture': {$ne: fixture._id}}, function (error, users) {
        if (error || users == null) {
            console.log("Error finding users who made no predicitons: " + error);
            return
        } else {
            //for testing
            console.log("The number of returned users is: " + users.length);
            console.log("The users returned are: " + JSON.stringify(users));

            //invokes the score adder function passing in all users who are to be scored, and all fixtures
            _scoreReducer(0, users, fixture, function () {
                //feeds the callback method into the scoreadder method
                console.log("All non-predicting users docked 6 points.");
            });
        }
    });
}

//FOR SINGLE FIXTURE
//used to recursively give all users who predicted an a given fixture a score when the result is determined
function _scoreAdder(i, users, fixture, callback) {
    if (i < users.length) {
        //place the current user's predictions into an array
        var preds = users[i].predictions;

        //get the current value of the user's score for season and round
        var seasonScore = users[i].OverallSeasonScore;
        console.log("The overall season score for this user is: %n", seasonScore);

        var roundScores = users[i].roundScores;
        console.log("The round of the fixture is: " + fixture.round);
        console.log("The round scores for this user are: " + JSON.stringify(roundScores));

        //If the user already has a score for this round

        var roundAlreadyExists = false;
        //Find the round score if exists - ALTER EXSITING
        for (var j = 0; j < roundScores.length; j++) {
            if (roundScores[j].roundNo == fixture.round) {
                //then we have found the round number, exit
                roundAlreadyExists = true; //set to be the position of the round in the roundNo array
                break;
            }
        }

        //Otherwise if the round score did not already exist, add it - ADD NEW
        if (!roundAlreadyExists) {
            roundScores.push({roundNo: fixture.round, roundScore: 0});
        }

        //for each user, loop over all of the user's predictions and compare to current fixture
        for (var k = 0; k < preds.length; k++) {

            //if the user made a prediction for this fixture.
            //if the prediction was correct, update the user's score!
            if (preds[k].prediction == fixture.fixResult) {
                seasonScore += preds[k].predictValue.correctPoints;

                //Manual search to always ensure the correct roundScore is getting updated
                for (var l = 0; l < roundScores.length; l++) {
                    if (roundScores[l].roundNo == fixture.round) {
                        roundScores[l].roundScore += preds[k].predictValue.correctPoints;
                        roundscores[l].correctPredictions++;
                        console.log("Now updated the round score with a correct prediction.");
                    }
                }

            } else {
                //Otherwise if the prediction was incorrect deduct the necessary amount of points
                seasonScore -= preds[k].predictValue.incorrectPoints;

                //Manual search to always ensure the correct roundScore is getting updated
                for (var l = 0; l < roundScores.length; l++) {
                    if (roundScores[l].roundNo == fixture.round) {
                        roundScores[l].roundScore -= preds[k].predictValue.incorrectPoints;
                        roundscores[l].incorrectPredictions++;
                        console.log("Now updated the round score with a correct prediction.");
                    }
                }
            }
        }

        //if the score has been updated
        if (seasonScore != users[i].score) {
            //then save the change made to the user's score and recurse, scoring the next user
            User.findByIdAndUpdate(users[i]._id, {$set: {'overallSeasonScore': seasonScore, 'roundScores': roundScores}}, function () {
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

//Recursive function to take 6 points from all users who don't make predictions
function _scoreReducer(i, users, fixture, callback) {
    if (i >= users.length) {
        //if the recursion should have ended as all user's given scores, run the callback.
        callback();
    } else {
        //get the current value of the user's score
        var score = users[i].score;

        //Deduct 6 points from the user for not making a prediction
        score -= 6;

        //if the score has been updated

        //then save the change made to the user's score and recurse, scoring the next user
        User.findByIdAndUpdate(users[i]._id, {$set: {'score': score}}, function () {
            //recurse, scoring the next user
            _scoreReducer(i + 1, users, fixture, callback);
        });
    }
}


//todo: allow for an asecending/descneding param, or just make descending if possible.
//handy array to quickly sort results
function _sortByMomentDate(array, key) {
    return array.sort(function(a, b) {

        var x = a[key];

        x = moment(x);

        var y = b[key];

        y = moment(y);

        //sort by ascending, swap comparisons to make desc

        //-1 for smaller, 1 for greater, 0 for equal.
        //return moment.utc(x.timeStamp).diff(moment.utc(y.timeStamp))
        return moment.utc(x.timeStamp).diff(moment.utc(y.timeStamp))
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



