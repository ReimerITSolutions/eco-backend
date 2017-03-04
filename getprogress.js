var mongoose = require('mongoose');
var async=require('async');
var Q=require('q');

var appSettings = require('./appSettings.js');
var log = require('./log.js');


appSettings.mongoIDPConnection     = mongoose.createConnection('mongodb://localhost' + ':' + appSettings.mongoPort + '/' +appSettings.mongooseIDPDB);
appSettings.mongoBackendConnection  = mongoose.createConnection('mongodb://localhost' + ':' + appSettings.mongoPort + '/' +appSettings.mongooseBackendDB );
appSettings.mongoBackendConnection.on('error', console.error.bind(console, 'connection error:'));
appSettings.mongoBackendConnection.once('open', function callback (){
    debugger;
    log('Backend MongoDB connected');
    var utils = require('./utils.js');
    var models=require('./models.js');

    log('start');

    var ecoUserId = '54f64ea65396b98c247faf3a'; //kjeld
    var ecoUserId = '542982d1a7b64b1343a994a0'; // javier
    utils.updateUserAllCoursesProgress(ecoUserId)
    .then(function(){ log('done')});



    /*
    var counter=1;
    models.EcoUser.find().exec(function(err,ecoUsers){
        async.eachSeries(ecoUsers,
          function(ecoUser,callback){
              log(counter++ + ':' + ecoUser._id.toHexString());
              utils.updateUserAllCoursesProgress(ecoUser._id.toHexString())
              .then(function(){
                  callback();
              })
              .fail(function(){
                  callback();
              })
          },
          function(err){
              log('done');
          }
        );
    });
    */

});
