var db = require('./dbConnection');
var express = require('express');
var app = express();
app.configure(function(){
    app.use(express.bodyParser());
});
app.get('/', function (req, res) {
  res.send('Hello New York\n');
}).listen(3001);