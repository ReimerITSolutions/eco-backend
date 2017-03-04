var mongoose = require('mongoose');
var Q = require('q');
var util = require('util');
var EventEmitter = require('events').EventEmitter;


var appSettings = require('./appSettings.js');
var log = require('./log.js');



appSettings.mongoIDPConnection = mongoose.createConnection('mongodb://localhost' + ':' + appSettings.mongoPort + '/' +appSettings.mongooseIDPDB);
appSettings.mongoIDPConnection.on('error', console.error.bind(console, 'connection error:'));
appSettings.mongoIDPConnection.once('open', function callback (){
    log('Mongo IDP DB connected',true);

    appSettings.mongoBackendConnection  = mongoose.createConnection('mongodb://localhost' + ':' + appSettings.mongoPort + '/' +appSettings.mongooseBackendDB );
    appSettings.mongoBackendConnection.on('error', console.error.bind(console, 'connection error:'));
    appSettings.mongoBackendConnection.once('open', function callback (){
        log('Mongo Backend DB connected',true);

        utils = require('./utils.js');
        models=require('./models.js');
        util.inherits(userProcessor, EventEmitter);
        userProcessor = new userProcessor();
        userProcessor.process();
    });
});

function exit(msg){
        log(msg,true);
        mongoose.disconnect();
        process.exit(code=0);
}

var userProcessor = function(){
    var self=this;
    self.currentUserId=null;
    self.counter = 1;

    this.process=function(){
        // find first _id value
        models.EcoUser.find().sort({_id:1}).limit(1).exec(function(err, users){
            self.currentUserId = users[0]._id;
            updateUserProgress(self.currentUserId);
        })
    }

    function updateUserProgress(userId){
        log(self.counter + ": " + userId,true);
        self.counter++;
        utils.updateUserAllCoursesProgress(userId)
        .then(function(){
            self.emit('nextUser');
        })
        .fail(function(){
            self.emit('nextUser');
        })
    }

    this.on('nextUser', function(){
        // find next id
        models.EcoUser.find({_id: {$gt: self.currentUserId }}).limit(1).exec(function(err, users){
            if (users.length == 1){
              self.currentUserId = users[0]._id;
              updateUserProgress(self.currentUserId);
            } else {
                exit('Finshed!');
            }
        })
    })
}




