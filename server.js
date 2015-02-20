#!/bin/env node

var PORT = process.env.OPENSHIFT_INTERNAL_PORT || process.env.OPENSHIFT_NODEJS_PORT  || 8080;
var IPADDRESS = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
//
//var express = require('express');
//var fs      = require('fs');
//var mongoose = require('mongoose');
//var app = express();
//
//mongoose.connect('mongodb://localhost/nodejs');
//var db = mongoose.connection;
//db.on('error', function() {
//  throw new Error('Unable to connect to database');
//});
//app.configure(function() {
//  app.use(express.bodyParser());
//});
//
//app.get('/', function(req, res) {
//
//    // Some fake testing data
//    var rounds = [{
//        id: 0,
//        name: 'Round 1',
//        description: 'Here are the fixtures for Round 1',
//        fixtures: [
//            { id: 1,
//                name: 'Fixture 1',
//                description: 'Them vs. Those'
//            },
//            { id: 2,
//                name: 'Fixture 2',
//                description: 'Them vs. Those'
//            },
//            { id: 3,
//                name: 'Fixture 3',
//                description: 'Them vs. Those'
//            },
//            { id: 4,
//                name: 'Fixture 4 ',
//                description: 'Them vs. Those'
//            }
//        ]
//    }, {
//        id: 1,
//        name: 'Round 2',
//        description: 'Here are the fixtures for Round 2',
//        fixtures: [
//            { id: 1,
//                name: 'Fixture 1',
//                description: 'Them vs. Those'
//            },
//            { id: 2,
//                name: 'Fixture 2',
//                description: 'Them vs. Those'
//            },
//            { id: 3,
//                name: 'Fixture 3',
//                description: 'Them vs. Those'
//            },
//            { id: 4,
//                name: 'Fixture 4 ',
//                description: 'Them vs. Those'
//            }
//        ]
//    }, {
//        id: 2,
//        name: 'Round 3',
//        description: 'Here are the fixtures for Round 3',
//        fixtures: [
//            { id: 1,
//                name: 'Fixture 1',
//                description: 'Them vs. Those'
//            },
//            { id: 2,
//                name: 'Fixture 2',
//                description: 'Them vs. Those'
//            },
//            { id: 3,
//                name: 'Fixture 3',
//                description: 'Them vs. Those'
//            },
//            { id: 4,
//                name: 'Fixture 4 ',
//                description: 'Them vs. Those'
//            }
//        ]
//    }, {
//        id: 3,
//        name: 'Round 4',
//        description: 'Here are the fixtures for Round 4',
//        fixtures: [
//            { id: 1,
//                name: 'Fixture 1',
//                description: 'Them vs. Those'
//            },
//            { id: 2,
//                name: 'Fixture 2',
//                description: 'Them vs. Those'
//            },
//            { id: 3,
//                name: 'Fixture 3',
//                description: 'Them vs. Those'
//            },
//            { id: 4,
//                name: 'Fixture 4 ',
//                description: 'Them vs. Those'
//            }
//        ]
//    }, {
//        id: 4,
//        name: 'Round 5',
//        description: 'Here are the fixtures for Round 5',
//        fixtures: [
//            { id: 1,
//                name: 'Fixture 1',
//                description: 'Them vs. Those'
//            },
//            { id: 2,
//                name: 'Fixture 2',
//                description: 'Them vs. Those'
//            },
//            { id: 3,
//                name: 'Fixture 3',
//                description: 'Them vs. Those'
//            },
//            { id: 4,
//                name: 'Fixture 4 ',
//                description: 'Them vs. Those'
//            }
//        ]
//    }];
//
//    res.send(rounds);
//});
//
//app.listen(PORT);
//
//
//
var express = require('express');
var app = express();

app.get('/', function (req, res) {
    res.send('Hello World!')
});

var server = app.listen(PORT);