var mongoose = require('mongoose');
var Q = require('q');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var async = require('async');


var appSettings = require('./appSettings.js');
var log = require('./log.js');

var moocUsageStats = new Array();



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
        util.inherits(courseProgressProcessor, EventEmitter);
        courseProgressProcessor = new courseProgressProcessor();

        models.courseStatistics.remove({}, function(err) {
            courseProgressProcessor.process();
        });

    });
});

function exit(msg){
        log(msg,true);
        mongoose.disconnect();
        process.exit(code=0);
}

var courseProgressProcessor = function(){
    var self=this;
    self.counter=1;
    self.currentUserCourseProgress = null;
    self.currentUser = null;

    this.process=function(){
        // find first _id value
        models.UserCourseProgress.find({}).sort({_id:1}).limit(1).exec(function(err, prs){
            self.currentUserCourseProgress = prs[0]
            models.EcoUser.findOne({_id: self.currentUserCourseProgress._user}).exec(function(err, theUser){
                self.currentUser = theUser;
                calc();
            });
        })
    }

    function calc(){
        log(self.counter + ": " + self.currentUserCourseProgress._id, true);
        self.counter++;
        if (self.currentUserCourseProgress.coursesProgress.length == 0){
            log("no courses",true);
            self.emit('next');
        } else {
            async.map(self.currentUserCourseProgress.coursesProgress,
                function(theCoursesProgress, callback){
                  models.EcoCourse.findOne(
                      { "_platform": self.currentUserCourseProgress._platform,
                        "identifier.entry" : theCoursesProgress.id
                      }
                  ).exec(function(err, theCourse){
                      if(theCourse){
                          log("course found",true);
                          // upsert coursestatistics
                          models.courseStatistics.findOne({_course: theCourse._id}).exec(function(err, theStats){
                            if(!theStats){  // no stats record yet available
                                var theStats=new models.courseStatistics();
                                theStats._course = theCourse._id
                            }

                            if(self.currentUser){
                              if(self.currentUser.language == 'en'){
                                  theStats.countUsersEn = theStats.countUsersEn +1;
                              }
                              if(self.currentUser.language == 'fr'){
                                  theStats.countUsersFr = theStats.countUsersFr +1;
                              }
                              if(self.currentUser.language == 'es'){
                                  theStats.countUsersEs = theStats.countUsersEs +1;
                              }
                              if(self.currentUser.language == 'de'){
                                  theStats.countUsersDe = theStats.countUsersDe +1;
                              }
                              if(self.currentUser.language == 'it'){
                                  theStats.countUsersIt = theStats.countUsersIt +1;
                              }
                              if(self.currentUser.language == 'pt'){
                                  theStats.countUsersPt = theStats.countUsersPt +1;
                              }
                            } else { // no user any more. count as english user
                                theStats.countUsersEn = theStats.countUsersEn +1;
                            }
                            theStats.save(function (err, s){
                                if (err) {
                                    log('Error saving stats. Error: ' + JSON.stringify(err),true);
                                }
                                callback(null);
                            });
                          });
                      } else {
                          log("course not found:" + self.currentUserCourseProgress._platform + "/" + theCoursesProgress.id,true);
                          callback(null);
                      }
                  })
                },
                function(err, results){
                    self.emit('next');
                }
            );
        }
    }

    this.on('next', function(){
        // find next id
        models.UserCourseProgress.find(
            {_id: {$gt: self.currentUserCourseProgress._id }
            }).limit(1).exec(function(err, prs){
            if (prs.length == 1){
              self.currentUserCourseProgress = prs[0]
              models.EcoUser.findOne({_id: self.currentUserCourseProgress._user}).exec(function(err, theUser){
                  self.currentUser = theUser;
                  calc();
              });
            } else {
                exit('Finshed!');
            }
        })
    })
}




