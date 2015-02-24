#!/bin/env node

var PORT = process.env.OPENSHIFT_INTERNAL_PORT || process.env.OPENSHIFT_NODEJS_PORT  || 8080;
var IPADDRESS = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

var mongoose = require('mongoose');
var express = require('express');
var fs = require('fs');
var bodyParser = require('body-parser');
var cors = require('cors');
var app = express();
var mongoConnection = 'mongodb://'+IPADDRESS+'/nodejs';

if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
    mongoConnection = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
    process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
    process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
    process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
    process.env.OPENSHIFT_APP_NAME;
}

require('./mongo/models/usermodel');
require('./mongo/models/fixturemodel');
var connect = require('connect');
require('./routes')(app);

//CHANGE THIS FOR LOCAL DEVELOPMENT
mongoose.connect(mongoConnection);
var db = mongoose.connection;
db.on('error', function () {
  throw new Error('unable to connect to database at mongodb://localhost/nodejs');
});

//Define middlewares

//try to enable cors
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    next();
});
app.use(cors());
app.use(app.router);
app.use(connect.bodyParser.json({ type : 'application/json' })); // for parsing application/json
app.use(connect.bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', function(req, res) {
  res.send('Yes!GetIn!');
});

app.listen(PORT, IPADDRESS, function() {
  console.log('%s: Node server started on %s:%d ...', Date(Date.now()), IPADDRESS, PORT);
});



