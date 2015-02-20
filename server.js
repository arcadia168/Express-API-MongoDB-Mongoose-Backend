#!/bin/env node

var PORT = process.env.OPENSHIFT_INTERNAL_PORT || process.env.OPENSHIFT_NODEJS_PORT  || 8080;
var IPADDRESS = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

var express = require('express');
var fs      = require('fs');
var mongoose = require('mongoose');
var app = express();
var bodyParser = require('body-parser');

//CHANGE THIS FOR LOCAL DEVELOPMENT
mongoose.connect('mongodb://localhost/nodejs');
var db = mongoose.connection;
/*
db.on('error', function(){
  throw new Error('Unable to connect to database');
});
*/

db.on('error', console.error.bind(console, "Connection error:"));

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', function(req, res) {

    // Some fake testing data
    var rounds = [{
        id: 0,
        name: 'Round 1',
        description: 'Here are the fixtures for Round 1',
        fixtures: [
            { id: 1,
                name: 'Fixture 1',
                description: 'Them vs. Those'
            },
            { id: 2,
                name: 'Fixture 2',
                description: 'Lads vs. Denchmans'
            },
            { id: 3,
                name: 'Fixture 3',
                description: 'Them vs. Those'
            },
            { id: 4,
                name: 'Fixture 4 ',
                description: 'Them vs. Those'
            }
        ]
    }, {
        id: 1,
        name: 'Round 2',
        description: 'Here are the fixtures for Round 2',
        fixtures: [
            { id: 1,
                name: 'Fixture 1',
                description: 'Them vs. Those'
            },
            { id: 2,
                name: 'Fixture 2',
                description: 'Them vs. Those'
            },
            { id: 3,
                name: 'Fixture 3',
                description: 'Them vs. Those'
            },
            { id: 4,
                name: 'Fixture 4 ',
                description: 'Them vs. Those'
            }
        ]
    }, {
        id: 2,
        name: 'Round 3',
        description: 'Here are the fixtures for Round 3',
        fixtures: [
            { id: 1,
                name: 'Fixture 1',
                description: 'Them vs. Those'
            },
            { id: 2,
                name: 'Fixture 2',
                description: 'Them vs. Those'
            },
            { id: 3,
                name: 'Fixture 3',
                description: 'Them vs. Those'
            },
            { id: 4,
                name: 'Fixture 4 ',
                description: 'Them vs. Those'
            }
        ]
    }, {
        id: 3,
        name: 'Round 4',
        description: 'Here are the fixtures for Round 4',
        fixtures: [
            { id: 1,
                name: 'Fixture 1',
                description: 'Them vs. Those'
            },
            { id: 2,
                name: 'Fixture 2',
                description: 'Them vs. Those'
            },
            { id: 3,
                name: 'Fixture 3',
                description: 'Them vs. Those'
            },
            { id: 4,
                name: 'Fixture 4 ',
                description: 'Them vs. Those'
            }
        ]
    }, {
        id: 4,
        name: 'Round 5',
        description: 'Here are the fixtures for Round 5',
        fixtures: [
            { id: 1,
                name: 'Fixture 1',
                description: 'Them vs. Those'
            },
            { id: 2,
                name: 'Fixture 2',
                description: 'Them vs. Those'
            },
            { id: 3,
                name: 'Fixture 3',
                description: 'Them vs. Those'
            },
            { id: 4,
                name: 'Fixture 4 ',
                description: 'Them vs. Those'
            }
        ]
    }];

  res.send(rounds);
});

app.listen(PORT, IPADDRESS, function() {
  console.log('%s: Node server started on %s:%d ...', Date(Date.now()), IPADDRESS, PORT);
});



