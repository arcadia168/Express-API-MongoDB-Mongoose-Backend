var mongoose = require('mongoose');
var http = require('http');
var https = require('https');
var MiniSet = require('./miniset');
var Fixture = mongoose.model('Fixture');

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
    Fixture.find({}, function(err, results) {
        var data = JSON.parse(JSON.stringify(results));

        console.log('Parsing fixture data ' + results + ' into rounds');

        var newData = {rounds:[]};

        var set = new MiniSet();

        //for(var i = 0; i < data.length; i++) {
        //
        //    var obj = data[i];
        //
        //    // if this round already exists in the list add it else make a new JSON object
        //
        //    var roundNum = Number(obj.round.toString());
        //    console.log('Now working on round number: ' + roundNum);
        //
        //    if(set.has(roundNum)) {
        //        console.log('The set already has the round ' + roundNum + ' just adding in ' + JSON.stringify(obj));
        //        // there is a fatal flaw in which we assume the rounds[number] exists in order, fix later lol
        //        newData.rounds[roundNum-1].data.push(obj);
        //    } else {
        //        var stringData = JSON.stringify(obj);
        //        console.log('Round ' + roundNum + ' did not exist, creating it now and adding in object ' + stringData);
        //        var nextData = JSON.parse("{\"round\":\""+roundNum+"\",\"data\":["+stringData+"]}");
        //        newData.rounds.push(nextData);
        //        set.add(roundNum);
        //    }
        //}

        console.log('Now returning to the user: ' + JSON.stringify(newData));
        return res.jsonp(200);
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
    var req2 = http.get(options, function(res2)
    {
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

//TODO: Replace these with sensible fixtures from the spreadsheet!
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
exports.dummyData = function(req, res) {
    Fixture.create(examples,
        function(err) {
            if(err)
                return console.log(err);
            return res.jsonp(202);
        }
    );
};