/**
 * Created by ***REMOVED*** on 21/05/15.
 */
var should = require('should');
var assert = require('assert');
var request = require('request');
var mongoose = require('mongoose');
var moment = require('moment');
var underscore = require('underscore');

//var winston = require('winston');
//var config = require('./config-debug');
var PORT = process.env.OPENSHIFT_INTERNAL_PORT || process.env.OPENSHIFT_NODEJS_PORT  || 8000;
var IPADDRESS = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var localUrl = 'http://127.0.0.1:8000:8000/';
var remoteUrl = 'http://nodejs-getin.rhcloud.com/api';

describe('Scoring', function() {
//    // within before() you can run all the operations that are needed to setup your tests. In this case
//    // I want to create a connection with the database, and when I'm done, I call done().
//    before(function(done) {
//        // In our tests we use the test db
//        //mongoose.connect(config.db.mongodb);
//        //establish connection to the mongo database
//
//        //Load in all of the mongoose data models
//        require('./mongo/models/usermodel');
//        require('./mongo/models/fixturemodel');
//        require('./mongo/models/privateleaguemodel');
//        var User = mongoose.model('User');
//        var PrivateLeague = mongoose.model('PrivateLeague');
//        var Fixture = mongoose.model('Fixture');
//
//        var mongoConnection = 'mongodb://'+IPADDRESS+'/nodejs';
//
//        //used to connect to the mongoDB on the openshift server. Overwrite only if running on production server.
//        if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
//            mongoConnection = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
//                process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
//                process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
//                process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
//                process.env.OPENSHIFT_APP_NAME;
//        }
//
//        mongoose.connect(mongoConnection);
//        var db = mongoose.connection;
//        db.on('error', function (err) {
//            console.error('MongoDB Error: %s', err);
//            throw new Error('unable to connect to database at ' + mongoConnection);
//        });
//
//        done();
//    });
    it('should invoke the test function on the server to see if users are scored correctly', function(done){

        //now set the the mongo id of this fixture
        //to test whole thing make this a fixture which users have predicted - so they'll get a score
        var id = mongoose.Types.ObjectId("556c8d82c8dd26e010885355");
        console.log("Fake document id is: " + id);

        var kickOff = moment();
        kickOff.add(1, 'minute');
        var halfTime = moment(kickOff);
        halfTime.add(45, 'minutes');
        var fullTime = moment(kickOff);
        fullTime.add(90, 'minutes');

        var postData =
        {
            "_id": id,
            "homeTeam": "Arsenal",
            "awayTeam": "Crystal Palace",
            "fixStadium": "Emirates Stadium",
            "round": 1,
            "kickOff": new Date("2014-08-18T16:00:00+0100"),
            "halfTime": new Date("2014-08-18T16:45:00+0100"),
            "fullTime": new Date("2014-08-18T17:45:00+0100"),
            "fixResult": {"fixResult": 0, "fixScore": 0},
            "fixDate": new Date("2014-08-18T16:00:00+0100"),
            "__v": 0
        };

        var options = {
            method: 'post',
            body: postData,
            json: true,
            url: localUrl + '/dummy/fixtures/testresult'
        };

        request(options, function (err, response, body) {
            if (err) {
                console.log(err + 'error posting json')
                return
            }
            var headers = response.headers
            var statusCode = response.statusCode
            expect(response.statusCode).toBe(200);
        });

        //request(localUrl)
        //    .post('/api/dummy/fixtures/testresult')
        //    .send(body)
        //    .expect('Content-Type', /json/)
        //    .expect(200) //Status code
        //    .end(function(err,response) {
        //        if (err) {
        //            throw err;
        //        }
        //
        //        // Should.js fluent syntax applied
        //        //res.body.should.have.property('_id');
        //        //res.body.firstName.should.equal('JP');
        //        //res.body.lastName.should.equal('Berd');
        //        //res.body.creationDate.should.not.equal(null);
        //
        //
        //        //User.find({'predictions.fixture': body._id}, function (error, users) {
        //        //    if (error || users == null) {
        //        //        console.log("Error finding users who made predicitons: " + error);
        //        //    } else {
        //        //        //for testing
        //        //        console.log("The number of returned users is: " + users.length);
        //        //        console.log("The users returned are: " + JSON.stringify(users));
        //        //
        //        //        //For each user check the expected results...
        //        //        // if user predicted x prediction result should be y
        //        //        underscore.each(users, function(user) {
        //        //
        //        //        });
        //        //    }
        //        //});
        //
        //        done();
        //    });
    });
});
