#!/bin/env node

var PORT = process.env.OPENSHIFT_INTERNAL_PORT || process.env.OPENSHIFT_NODEJS_PORT  || 8000;
var IPADDRESS = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

var mongoose = require('mongoose');
var express = require('express');
var fs = require('fs');
var bodyParser = require('body-parser');
var cors = require('cors');
var app = express();
var mongoConnection = 'mongodb://'+IPADDRESS+'/nodejs';
//configure auth0
var jwt = require('express-jwt');

var jwtCheck = jwt({
    secret: new Buffer('fpQpckeWWFKr444cvgx3ImOrnBQkjESj57QEkIsMxEWcjalZX8FVNxEFC_DeE8rk', 'base64'),
    audience: 'Ny44FwyaGBQvKOV9FxIRDX6JvogUm80j'
});


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

//try to enable cors
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    next();
});

//here I THINK we are stating that we wish to use the jwtCheck middleware on the specified routes for our API
//define this for each app route that is user specific
//app.use('/users/rounds', jwtCheck);
app.use('/users/rounds', jwtCheck);
//TODO: protect various endpoints here.

require('./mongo/models/usermodel');
require('./mongo/models/fixturemodel');
require('./mongo/models/privateleaguemodel');
require('./routes')(app);

//CHANGE THIS FOR LOCAL DEVELOPMENT
mongoose.connect(mongoConnection);
var db = mongoose.connection;
db.on('error', function (err) {
  console.error('MongoDB Error: %s', err);
  throw new Error('unable to connect to database at mongodb://localhost/nodejs');
});

app.get('/', function(req, res) {
  res.send('Yes!GetIn!');
});

app.listen(PORT, IPADDRESS, function() {
  console.log('%s: Node server started on %s:%d ...', Date(Date.now()), IPADDRESS, PORT);
});



