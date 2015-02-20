#!/bin/env node

var PORT = process.env.OPENSHIFT_INTERNAL_PORT || process.env.OPENSHIFT_NODEJS_PORT  || 8080;
var IPADDRESS = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

var express = require('express');
var fs      = require('fs');
var mongoose = require('mongoose');
var app = express();

mongoose.connect('mongodb://localhost/nodejs');
var db = mongoose.connection;
db.on('error', function() 
  throw new Error('Unable to connect to database');
});

app.configure(function() {
  app.use(express.bodyParser());
});

app.get('/', function(req, res)) {
  res.send(// JSON HERE)
});

app.listen(8080);



