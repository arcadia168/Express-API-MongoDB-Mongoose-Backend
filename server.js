#!/bin/env node

//Set environment variables depending on the platform that server is running.
var PORT = process.env.OPENSHIFT_INTERNAL_PORT || process.env.OPENSHIFT_NODEJS_PORT  || 8000;
var IPADDRESS = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

var mongoose = require('mongoose');
var express = require('express');
var fs = require('fs');
var bodyParser = require('body-parser');
var cors = require('cors');
var app = express();
var mongoConnection = 'mongodb://'+IPADDRESS+'/nodejs';
var jwt = require('express-jwt'); //configure auth0
var jwtCheck = jwt({ //configure this server for use with Auth0 server, to authenticate users. Auth0 account specific
    secret: new Buffer('fpQpckeWWFKr444cvgx3ImOrnBQkjESj57QEkIsMxEWcjalZX8FVNxEFC_DeE8rk', 'base64'),
    audience: 'Ny44FwyaGBQvKOV9FxIRDX6JvogUm80j'
});

//used to connect to the mongoDB on the openshift server. Overwrite only if running on production server.
if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
    mongoConnection = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
    process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
    process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
    process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
    process.env.OPENSHIFT_APP_NAME;
}

//Define middlewares
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(cors());

//enable cors todo: test use without
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    next();
});

//baton down the hatches
app.use('/api/', jwtCheck); //does indeed protect all sub-routes, this is the only statement needed.

//Load in all of the mongoose data models
require('./mongo/models/usermodel');
require('./mongo/models/fixturemodel');
require('./mongo/models/privateleaguemodel');
require('./routes')(app);

//establish connection to the mongo database
mongoose.connect(mongoConnection);
var db = mongoose.connection;
db.on('error', function (err) {
  console.error('MongoDB Error: %s', err);
  throw new Error('unable to connect to database at ' + mongoConnection);
});

//Default response for the root (just use to get server status if anything...)
app.get('/', function(req, res) {
  res.send('Yes!GetIn!');
});

//Fire up the server
app.listen(PORT, IPADDRESS, function() {
  console.log('%s: Node server started on %s:%d ...', Date(Date.now()), IPADDRESS, PORT);
});



