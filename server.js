#!/bin/env node

var PORT = process.env.OPENSHIFT_INTERNAL_PORT || process.env.OPENSHIFT_NODEJS_PORT  || 8080;
var IPADDRESS = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

var mongoose = require('mongoose');
var express = require('express');
var fs = require('fs');
var bodyParser = require('body-parser');
var cors = require('cors');
var app = express();

require('./mongo/models/usermodel');
require('./mongo/models/fixturemodel');
require('./routes')(app);

//CHANGE THIS FOR LOCAL DEVELOPMENT
mongoose.connect('mongodb://localhost/nodejs');
var db = mongoose.connection;
db.on('error', function () {
  throw new Error('unable to connect to database at mongodb://localhost/nodejs');
});

app.use(cors());
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', function(req, res) {
  res.send('Yes!GetIn!');
});

app.listen(PORT, IPADDRESS, function() {
  console.log('%s: Node server started on %s:%d ...', Date(Date.now()), IPADDRESS, PORT);
});



