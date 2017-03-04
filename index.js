var url = require('url');
var bodyParser = require('body-parser');
var methodOverride = require('method-override')();
var cors = require('cors');
var http = require('http');
var path = require('path');
var querystring = require('querystring');
var ejs = require('ejs');
var mongoose = require('mongoose');
var express = require('express');
var https = require('https');
var fs=require('fs');


var appSettings = require('./appSettings.js');

appSettings.mongoBackendConnection  = mongoose.createConnection('mongodb://'+ appSettings.mongoBackendDBUser + ":" + appSettings.mongoBackendDBPassword + '@' + appSettings.mongoHost + ':' + appSettings.mongoPort + '/' +appSettings.mongooseBackendDB);
appSettings.mongoIDPConnection = mongoose.createConnection('mongodb://'+ appSettings.mongoIDPDBUser + ":" + appSettings.mongoIDPDBPassword + '@' + appSettings.mongoHost + ':' + appSettings.mongoPort + '/' +appSettings.mongooseIDPDB);

appSettings.mongoBackendConnection.on('error', console.error.bind(console, 'connection error:'));
appSettings.mongoIDPConnection.once('open', function callback (){
    log('Backend MongoDB connected');
});

var models=require('./models.js');



var app = express();
app.set('view engine', 'ejs');
app.set('port', appSettings.port);
app.use(express.static(__dirname + '/static'));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(methodOverride);
var log = require('./log.js');



// define the routes....
require('./routes/index.js')(app);


app.get('*', function(req, res, next) {
  var err = new Error();
  err.status = 404;
  next(err);
});

require('./errorHandle.js')(app);

var server = app.listen(app.get('port'), function(){
      log('ECO Backend API ('+ appSettings.versionInfo +')  Listening on port ' + appSettings.port,true);
});




